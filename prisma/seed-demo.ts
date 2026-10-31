/* eslint-disable no-console */
/**
 * Demo data for local development, staging and client demos.
 *
 *   npm run db:seed:demo            → add demo data (runs the base seed first)
 *   npm run db:seed:demo -- --reset → remove previous demo data, then add it again
 *   npm run db:seed:demo -- --remove→ only remove demo data
 *
 * Writes through Prisma (not the API) so it can create history: past bookings, payments,
 * refunds, reviews and adoptions over the last ~4 months, which the dashboard charts need.
 * Everything it creates is recorded in the `__demo_seed` settings row, so --reset/--remove
 * delete exactly that — never your own data. Demo emails use @demo.petplex.dev (no real inbox).
 * Refuses to run with NODE_ENV=production unless --force is passed.
 */
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import type { BookingStatus, PaymentMethod, PaymentStatus, Prisma } from '@generated/prisma/client';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { SYSTEM_ROLES } from '@/shared/constants/roles';
import { nowInBusinessTz } from '@/shared/utils/time';
import * as D from './demo/data';
import { seed as baseSeed } from './seed';

const MANIFEST_KEY = '__demo_seed';

/* ───────────────────────── deterministic randomness ───────────────────────── */

/** mulberry32 — same data on every run, so screenshots and tests are reproducible */
function rngFrom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rngFrom(20261031);
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const weighted = <T>(items: readonly T[], weight: (t: T) => number): T => {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let r = rand() * total;
  for (const i of items) if ((r -= weight(i)) <= 0) return i;
  return items[items.length - 1];
};
const hex = (n = 6) =>
  Array.from({ length: n }, () => '0123456789ABCDEF'[Math.floor(rand() * 16)]).join('');

/* ───────────────────────── dates (business time zone) ───────────────────────── */

const TODAY = nowInBusinessTz().date; // "YYYY-MM-DD"
const NOW = new Date();
const dayStr = (offset: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const dateOnly = (d: string) => new Date(`${d}T00:00:00.000Z`);
/** wall-clock time in Dhaka → instant */
const at = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00+06:00`);
const daysAgo = (
  n: number,
  hhmm = `${String(int(9, 20)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}`,
) => at(dayStr(-n), hhmm);
const clampPast = (d: Date) => (d > NOW ? new Date(NOW.getTime() - int(5, 120) * 60_000) : d);
const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const weekday = (d: string) => dateOnly(d).getUTCDay();

const used = new Set<string>();
/** Same shape as the API's generateReferenceNo: BK-20261027-4F9A2C */
const ref = (prefix: string, date: Date) => {
  let v: string;
  do v = `${prefix}-${ymd(date)}-${hex()}`;
  while (used.has(v));
  used.add(v);
  return v;
};
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const IMAGE_BASE = (
  process.env.DEMO_IMAGE_BASE_URL ?? `${env.CLIENT_URL.replace(/\/$/, '')}/images`
).replace(/\/$/, '');
const img = (file: string) => `${IMAGE_BASE}/${file}`;

/* ───────────────────────── manifest ───────────────────────── */

interface Manifest {
  createdAt: string;
  users: number[];
  categories: number[];
  services: number[];
  promotions: number[];
  adoptionPets: number[];
  blogCategories: number[];
  blogPosts: number[];
  faqs: number[];
  testimonials: number[];
  albums: number[];
  galleryItems: number[];
  contacts: number[];
  subscribers: number[];
  blockedDates: number[];
}

const readManifest = async () => {
  const row = await prisma.setting.findUnique({ where: { key: MANIFEST_KEY } });
  return (row?.value as unknown as Manifest | undefined) ?? null;
};

/* ───────────────────────── remove ───────────────────────── */

async function removeDemo() {
  const m = await readManifest();
  // fallback for a lost manifest: demo accounts are recognisable by their email domain
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${D.DEMO_DOMAIN}` }, deletedAt: undefined },
    select: { id: true },
  });
  const userIds = [...new Set([...(m?.users ?? []), ...users.map((u) => u.id)])];
  if (!m && !userIds.length) return console.log('No demo data found — nothing to remove.');

  const ids = (k: keyof Omit<Manifest, 'createdAt'>) => m?.[k] ?? [];
  const inUsers = { in: userIds };
  const kept: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      // history first (FKs are RESTRICT): refunds → payments → usages → reviews → bookings
      await tx.payment.deleteMany({ where: { userId: inUsers, type: 'refund' } });
      await tx.payment.deleteMany({ where: { userId: inUsers } });
      await tx.promotionUsage.deleteMany({ where: { userId: inUsers } });
      await tx.review.deleteMany({ where: { userId: inUsers } });
      await tx.booking.deleteMany({ where: { userId: inUsers } });
      await tx.testimonial.deleteMany({
        where: { OR: [{ id: { in: ids('testimonials') } }, { userId: inUsers }] },
      });
      await tx.adoption.deleteMany({ where: { userId: inUsers } });
      await tx.adoptionApplication.deleteMany({ where: { userId: inUsers } });
      await tx.pet.deleteMany({ where: { userId: inUsers, deletedAt: undefined } });
      await tx.activityLog.deleteMany({ where: { userId: inUsers } });

      // content the seeder created — unless real data now points at it
      for (const id of ids('adoptionPets')) {
        const refs = await tx.adoptionApplication.count({ where: { adoptionPetId: id } });
        if (refs) {
          await tx.adoptionPet.update({ where: { id }, data: { status: 'on_hold' } });
          kept.push(`adoption pet #${id} (has real applications) → put on hold`);
        } else await tx.adoptionPet.deleteMany({ where: { id, deletedAt: undefined } });
      }
      await tx.galleryItem.deleteMany({ where: { id: { in: ids('galleryItems') } } });
      for (const id of ids('albums')) {
        if (await tx.galleryItem.count({ where: { albumId: id } }))
          kept.push(`album #${id} (has your photos)`);
        else await tx.galleryAlbum.delete({ where: { id } });
      }
      await tx.blogPost.deleteMany({
        where: { id: { in: ids('blogPosts') }, deletedAt: undefined },
      });
      for (const id of ids('blogCategories')) {
        if (await tx.blogPost.count({ where: { categoryId: id, deletedAt: undefined } }))
          kept.push(`blog category #${id} (has your posts)`);
        else await tx.blogCategory.delete({ where: { id } });
      }
      await tx.promotion.deleteMany({ where: { id: { in: ids('promotions') } } });
      for (const id of ids('services')) {
        if (await tx.booking.count({ where: { serviceId: id } })) {
          await tx.service.update({ where: { id }, data: { status: 'inactive' } });
          kept.push(`service #${id} (has real bookings) → deactivated`);
        } else await tx.service.deleteMany({ where: { id, deletedAt: undefined } });
      }
      for (const id of ids('categories')) {
        if (await tx.service.count({ where: { categoryId: id, deletedAt: undefined } }))
          kept.push(`category #${id} (has your services)`);
        else await tx.serviceCategory.deleteMany({ where: { id, deletedAt: undefined } });
      }
      await tx.faq.deleteMany({ where: { id: { in: ids('faqs') } } });
      await tx.contactMessage.deleteMany({
        where: {
          OR: [{ id: { in: ids('contacts') } }, { email: { endsWith: `@${D.DEMO_DOMAIN}` } }],
        },
      });
      await tx.newsletterSubscriber.deleteMany({
        where: {
          OR: [{ id: { in: ids('subscribers') } }, { email: { endsWith: `@${D.DEMO_DOMAIN}` } }],
        },
      });
      await tx.blockedDate.deleteMany({ where: { id: { in: ids('blockedDates') } } });
      // users last (schedules, staff services, tokens, notifications, favourites cascade)
      await tx.user.deleteMany({ where: { id: inUsers, deletedAt: undefined } });
      await tx.setting.deleteMany({ where: { key: MANIFEST_KEY } });
    },
    { timeout: 120_000 },
  );

  await recalcRatings();
  console.log(
    `🧹 Removed demo data (${userIds.length} demo accounts and everything linked to them).`,
  );
  kept.forEach((k) => console.log(`   kept: ${k}`));
}

/** services.avg_rating / reviews_count from approved reviews (same rule as the API) */
async function recalcRatings() {
  await prisma.$executeRaw`
    UPDATE services s SET
      avg_rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.service_id = s.id AND r.status = 'approved'), 0),
      reviews_count = (SELECT COUNT(*) FROM reviews r WHERE r.service_id = s.id AND r.status = 'approved')`;
}

/* ───────────────────────── create ───────────────────────── */

async function createDemo() {
  if (await readManifest()) {
    console.log(
      'Demo data is already there. Use `npm run db:seed:demo -- --reset` to recreate it.',
    );
    return;
  }
  await baseSeed(); // permissions, roles, super admin, pet types, settings

  const m: Manifest = {
    createdAt: new Date().toISOString(),
    users: [],
    categories: [],
    services: [],
    promotions: [],
    adoptionPets: [],
    blogCategories: [],
    blogPosts: [],
    faqs: [],
    testimonials: [],
    albums: [],
    galleryItems: [],
    contacts: [],
    subscribers: [],
    blockedDates: [],
  };
  const roles = new Map((await prisma.role.findMany()).map((r) => [r.slug, r.id]));
  const petTypes = new Map((await prisma.petType.findMany()).map((t) => [t.slug, t.id]));
  const password = await bcrypt.hash(D.DEMO_PASSWORD, env.BCRYPT_SALT_ROUNDS);
  const email = (first: string, last: string, n = '') =>
    `${first}.${last}${n}@${D.DEMO_DOMAIN}`.toLowerCase();
  const phone = () =>
    `+8801${pick(['3', '5', '6', '7', '8', '9'])}${String(int(10_000_000, 99_999_999))}`;
  const address = () => `House ${int(1, 99)}, Road ${int(1, 40)}, ${pick(D.AREAS)}, Dhaka`;

  /* users ------------------------------------------------------------------ */
  const manager = await prisma.user.create({
    data: {
      roleId: roles.get(SYSTEM_ROLES.ADMIN)!,
      firstName: 'Farhana',
      lastName: 'Manager',
      email: `manager@${D.DEMO_DOMAIN}`,
      password,
      phone: phone(),
      emailVerifiedAt: daysAgo(200),
      lastLoginAt: daysAgo(0),
      createdAt: daysAgo(200),
      bio: 'Studio manager — content, adoptions and the team.',
    },
  });
  m.users.push(manager.id);

  const staff = await prisma.user.createManyAndReturn({
    data: D.STAFF.map((s, i) => ({
      roleId: roles.get(SYSTEM_ROLES.STAFF)!,
      firstName: s.firstName,
      lastName: s.lastName,
      email: email(s.firstName, s.lastName),
      password,
      phone: phone(),
      bio: s.bio,
      emailVerifiedAt: daysAgo(180 - i),
      lastLoginAt: daysAgo(int(0, 3)),
      createdAt: daysAgo(180 - i),
    })),
  });
  m.users.push(...staff.map((s) => s.id));
  // Sat–Thu 09:00–18:00, Friday off (one staff covers Friday afternoons)
  await prisma.staffSchedule.createMany({
    data: staff.flatMap((s, i) =>
      [0, 1, 2, 3, 4, 5, 6]
        .filter((d) => d !== 5 || i === 3)
        .map((d) => ({
          staffId: s.id,
          dayOfWeek: d,
          startTime: d === 5 ? '14:00' : '09:00',
          endTime: d === 5 ? '18:00' : '18:00',
        })),
    ),
  });

  const CUSTOMERS = 42;
  const customers = await prisma.user.createManyAndReturn({
    data: Array.from({ length: CUSTOMERS }, (_, i) => {
      const first = D.FIRST_NAMES[i % D.FIRST_NAMES.length];
      const last = pick(D.LAST_NAMES);
      // most joined over the last 6 months, ~8 this month (dashboard "new customers")
      const joined = i < 8 ? int(0, 25) : int(30, 190);
      return {
        roleId: roles.get(SYSTEM_ROLES.CUSTOMER)!,
        firstName: first,
        lastName: last,
        email: email(first, last, String(i + 1)),
        password,
        phone: phone(),
        address: address(),
        createdAt: daysAgo(joined),
        emailVerifiedAt: chance(0.9) ? daysAgo(Math.max(0, joined - 1)) : null,
        lastLoginAt: chance(0.85) ? daysAgo(int(0, Math.min(joined, 30))) : null,
        status:
          i === 40 ? ('inactive' as const) : i === 41 ? ('blocked' as const) : ('active' as const),
      };
    }),
  });
  m.users.push(...customers.map((c) => c.id));
  const activeCustomers = customers.filter((c) => c.status === 'active');

  /* catalog ------------------------------------------------------------------ */
  const categoryId = new Map<D.CategoryKey, number>();
  for (const [i, c] of D.CATEGORIES.entries()) {
    const slug = slugify(c.name);
    const existing = await prisma.serviceCategory.findFirst({ where: { slug } });
    const row =
      existing ??
      (await prisma.serviceCategory.create({
        data: {
          name: c.name,
          slug,
          description: c.description,
          icon: c.icon,
          image: img(c.image),
          sortOrder: i + 1,
        },
      }));
    if (!existing) m.categories.push(row.id);
    categoryId.set(c.key, row.id);
  }

  type Svc = (typeof D.SERVICES)[number] & { id: number; unitPrice: number };
  const services: Svc[] = [];
  for (const [i, s] of D.SERVICES.entries()) {
    const slug = slugify(s.name);
    let row = await prisma.service.findFirst({ where: { slug } });
    if (!row) {
      row = await prisma.service.create({
        data: {
          categoryId: categoryId.get(s.category)!,
          name: s.name,
          slug,
          shortDescription: s.short,
          description: s.description,
          price: s.price,
          discountPrice: s.discount ?? null,
          durationMinutes: s.minutes,
          image: img(s.image),
          isFeatured: !!s.featured,
          sortOrder: i + 1,
          requiresVaccination: !!s.vaccination,
          maxPetsPerBooking: s.category === 'sitting' ? 3 : 1,
          createdById: manager.id,
          createdAt: daysAgo(170),
          petTypes: {
            create: s.pets
              .filter((p) => petTypes.has(p))
              .map((p) => ({ petTypeId: petTypes.get(p)! })),
          },
        },
      });
      m.services.push(row.id);
    }
    services.push({ ...s, id: row.id, unitPrice: Number(row.discountPrice ?? row.price) });
  }
  const skilled = (cat: D.CategoryKey) =>
    staff.filter((_, i) => (D.STAFF[i].skills as readonly string[]).includes(cat));
  await prisma.staffService.createMany({
    data: services.flatMap((s) =>
      skilled(s.category).map((st) => ({ staffId: st.id, serviceId: s.id })),
    ),
    skipDuplicates: true,
  });

  /* customer pets ------------------------------------------------------------ */
  const petRows: Prisma.PetCreateManyInput[] = [];
  for (const c of customers) {
    for (let k = 0; k < weighted([1, 1, 1, 2, 2, 3], () => 1); k++) {
      const type = weighted(
        ['dog', 'cat', 'rabbit', 'bird'] as const,
        (t) => ({ dog: 55, cat: 35, rabbit: 5, bird: 5 })[t],
      );
      const size = type === 'dog' ? pick(['small', 'medium', 'large'] as const) : 'small';
      const ageDays = int(120, 3600);
      petRows.push({
        userId: c.id,
        petTypeId: petTypes.get(type)!,
        name: pick(D.PET_NAMES[type]),
        breed: pick(D.BREEDS[type]),
        gender: pick(['male', 'female'] as const),
        size,
        dateOfBirth: dateOnly(dayStr(-ageDays)),
        weightKg:
          type === 'dog'
            ? { small: int(3, 9), medium: int(10, 22), large: int(23, 40) }[size]
            : type === 'cat'
              ? int(3, 6)
              : 1,
        isVaccinated: chance(0.8),
        photo: D.PHOTOS[type].length && chance(0.55) ? img(pick(D.PHOTOS[type])) : null,
        notes: chance(0.2)
          ? pick([
              'Nervous around dryers',
              'Allergic to chicken treats',
              'Loves belly rubs',
              'Pulls on the leash',
            ])
          : null,
        createdAt: c.createdAt,
      });
    }
  }
  const pets = await prisma.pet.createManyAndReturn({ data: petRows });
  const typeSlug = new Map([...petTypes].map(([slug, id]) => [id, slug]));
  const petsOf = new Map<number, typeof pets>();
  pets.forEach((p) => petsOf.set(p.userId, [...(petsOf.get(p.userId) ?? []), p]));

  /* promotions --------------------------------------------------------------- */
  const promoDefs = [
    {
      title: 'Welcome offer',
      code: 'WELCOME10',
      description: '10% off your first booking.',
      discountType: 'percentage' as const,
      discountValue: 10,
      maxDiscountAmount: 300,
      appliesTo: 'all' as const,
      startsAt: daysAgo(90, '00:00'),
      endsAt: at(dayStr(60), '23:59'),
      usageLimit: 1000,
      perUserLimit: 1,
    },
    {
      title: 'Spa week',
      code: 'SPA15',
      description: '15% off every spa treatment.',
      discountType: 'percentage' as const,
      discountValue: 15,
      maxDiscountAmount: 500,
      appliesTo: 'specific_categories' as const,
      startsAt: daysAgo(20, '00:00'),
      endsAt: at(dayStr(25), '23:59'),
      usageLimit: null,
      perUserLimit: 2,
      categories: ['spa'] as D.CategoryKey[],
    },
    {
      title: 'Monsoon care',
      code: 'MONSOON200',
      description: '৳200 off orders over ৳1,000.',
      discountType: 'fixed' as const,
      discountValue: 200,
      minOrderAmount: 1000,
      appliesTo: 'all' as const,
      startsAt: daysAgo(150, '00:00'),
      endsAt: daysAgo(95, '23:59'),
      usageLimit: 200,
      perUserLimit: 1,
    },
    {
      title: 'Winter grooming week',
      code: 'WINTER20',
      description: '20% off grooming in December.',
      discountType: 'percentage' as const,
      discountValue: 20,
      maxDiscountAmount: 400,
      appliesTo: 'specific_categories' as const,
      startsAt: at(dayStr(10), '00:00'),
      endsAt: at(dayStr(45), '23:59'),
      usageLimit: 300,
      perUserLimit: 1,
      categories: ['grooming'] as D.CategoryKey[],
    },
  ];
  const promos: { id: number; def: (typeof promoDefs)[number] }[] = [];
  for (const p of promoDefs) {
    if (await prisma.promotion.findFirst({ where: { code: p.code } })) continue; // keep your own code
    const { categories, ...data } = p as typeof p & { categories?: D.CategoryKey[] };
    const row = await prisma.promotion.create({
      data: {
        ...data,
        createdById: manager.id,
        bannerImage: img('service-spa.jpg'),
        ...(categories && {
          categories: { create: categories.map((c) => ({ categoryId: categoryId.get(c)! })) },
        }),
      },
    });
    m.promotions.push(row.id);
    promos.push({ id: row.id, def: p });
  }
  const promoFor = (svc: Svc, when: Date) =>
    promos.find(
      ({ def }) =>
        def.startsAt <= when &&
        def.endsAt >= when &&
        (def.appliesTo === 'all' ||
          (def as { categories?: D.CategoryKey[] }).categories?.includes(svc.category)) &&
        svc.unitPrice >= ((def as { minOrderAmount?: number }).minOrderAmount ?? 0),
    );

  /* bookings, payments, reviews --------------------------------------------- */
  type Plan = Prisma.BookingCreateManyInput & {
    _logs: {
      from: BookingStatus | null;
      to: BookingStatus;
      at: Date;
      by: number | null;
      note?: string;
    }[];
    _pay?: { method: PaymentMethod; at: Date; refundAt?: Date };
    _promo?: { id: number; amount: number };
    _svc: Svc;
  };
  const plans: Plan[] = [];
  const busy = new Map<string, [number, number][]>(); // staffId|date → booked intervals
  let freshPending = 0;
  const free = (staffId: number, date: string, s: number, e: number) =>
    !(busy.get(`${staffId}|${date}`) ?? []).some(([a, b]) => s < b && e > a);

  for (let offset = -120; offset <= 14; offset++) {
    const date = dayStr(offset);
    const dow = weekday(date);
    // busier on weekends (Fri/Sat in BD), growing towards today so the revenue chart trends up
    const base = dow === 5 ? 1 : dow === 6 ? 5 : 3;
    const growth = offset < -60 ? 0 : offset < -20 ? 1 : 2;
    const count = offset > 0 ? int(1, 3) : int(base - 1, base + 1) + growth;

    for (let n = 0; n < count; n++) {
      const svc = weighted(services, (s) => s.popularity);
      const owners = activeCustomers.filter((c) =>
        (petsOf.get(c.id) ?? []).some((p) => svc.pets.includes(typeSlug.get(p.petTypeId)!)),
      );
      if (!owners.length) continue;
      const customer = pick(owners);
      const pet = pick(
        (petsOf.get(customer.id) ?? []).filter((p) =>
          svc.pets.includes(typeSlug.get(p.petTypeId)!),
        ),
      );
      const team = skilled(svc.category).filter((s) => {
        const i = staff.indexOf(s);
        return dow !== 5 || i === 3;
      });
      if (!team.length) continue;

      const dayStart = dow === 5 ? 14 * 60 : 9 * 60;
      const latest = 18 * 60 - Math.min(svc.minutes, 18 * 60 - dayStart);
      let slot: { staffId: number; s: number } | null = null;
      for (let tries = 0; tries < 12 && !slot; tries++) {
        const member = pick(team);
        const s = dayStart + int(0, Math.max(0, Math.floor((latest - dayStart) / 30))) * 30;
        if (free(member.id, date, s, s + svc.minutes)) slot = { staffId: member.id, s };
      }
      if (!slot) continue;
      busy.set(`${slot.staffId}|${date}`, [
        ...(busy.get(`${slot.staffId}|${date}`) ?? []),
        [slot.s, slot.s + svc.minutes],
      ]);

      const startTime = toTime(slot.s);
      const endTime = toTime(Math.min(slot.s + svc.minutes, 23 * 60 + 59));
      // Unpaid "pending" bookings are auto-cancelled by the API after booking_payment_timeout_minutes,
      // so only a few just-made ones are pending; everything else upcoming is confirmed.
      const fresh = offset > 1 && freshPending < 3 && chance(0.3);
      if (fresh) freshPending++;
      const createdAt = fresh
        ? new Date(NOW.getTime() - int(2, 10) * 60_000)
        : clampPast(at(dayStr(offset - int(1, 9)), toTime(int(8, 22) * 60 + int(0, 59))));
      const startAt = at(date, startTime);
      const endAt = at(date, endTime);
      const promo = chance(0.14) ? promoFor(svc, createdAt) : undefined;
      const discount = promo
        ? Math.min(
            promo.def.discountType === 'percentage'
              ? Math.round((svc.unitPrice * promo.def.discountValue) / 100)
              : promo.def.discountValue,
            promo.def.maxDiscountAmount ?? Infinity,
            svc.unitPrice,
          )
        : 0;

      // status story
      let status: BookingStatus;
      const past = endAt < NOW;
      if (past)
        status = weighted(
          ['completed', 'cancelled', 'no_show'] as const,
          (s) => ({ completed: 86, cancelled: 9, no_show: 5 })[s],
        );
      else if (startAt < NOW) status = 'in_progress';
      else status = fresh ? 'pending' : 'confirmed';

      const online = chance(0.5);
      const method: PaymentMethod = online
        ? 'sslcommerz'
        : weighted(
            ['cash', 'mobile_banking', 'card'] as const,
            (x) => ({ cash: 5, mobile_banking: 4, card: 2 })[x],
          );
      let paymentStatus: PaymentStatus = 'unpaid';
      let pay: Plan['_pay'];
      const cancelledAt =
        status === 'cancelled'
          ? clampPast(new Date(Math.min(startAt.getTime() - int(2, 48) * 3_600_000, NOW.getTime())))
          : null;
      if (status === 'completed') {
        paymentStatus = 'paid';
        pay = { method, at: online ? new Date(createdAt.getTime() + 5 * 60_000) : endAt };
      } else if (online && status !== 'pending') {
        // paid online at checkout; cancelled → refunded
        paymentStatus = status === 'cancelled' ? 'refunded' : 'paid';
        pay = {
          method: 'sslcommerz',
          at: new Date(createdAt.getTime() + 5 * 60_000),
          ...(status === 'cancelled' && {
            refundAt: clampPast(new Date(cancelledAt!.getTime() + 3_600_000)),
          }),
        };
      }

      const by = slot.staffId;
      const logs: Plan['_logs'] = [{ from: null, to: 'pending', at: createdAt, by: customer.id }];
      if (status !== 'pending') {
        if (status === 'cancelled') {
          logs.push({
            from: 'pending',
            to: 'cancelled',
            at: cancelledAt!,
            by: chance(0.7) ? customer.id : manager.id,
            note: 'Cancelled by the customer',
          });
        } else {
          logs.push({
            from: 'pending',
            to: 'confirmed',
            at: new Date(Math.min(createdAt.getTime() + 3_600_000, NOW.getTime())),
            by: manager.id,
          });
          if (status === 'no_show') logs.push({ from: 'confirmed', to: 'no_show', at: endAt, by });
          if (status === 'in_progress' || status === 'completed')
            logs.push({ from: 'confirmed', to: 'in_progress', at: startAt, by });
          if (status === 'completed')
            logs.push({ from: 'in_progress', to: 'completed', at: endAt, by });
        }
      }

      plans.push({
        bookingNo: ref('BK', createdAt),
        userId: customer.id,
        petId: pet.id,
        serviceId: svc.id,
        assignedStaffId: slot.staffId,
        promotionId: promo?.id ?? null,
        bookingDate: dateOnly(date),
        startTime,
        endTime,
        servicePrice: svc.unitPrice,
        discountAmount: discount,
        totalAmount: svc.unitPrice - discount,
        status,
        paymentStatus,
        customerNote: chance(0.15)
          ? pick([
              'Please be gentle with her ears.',
              'He is nervous around dryers.',
              'Short summer cut please.',
              'Can you trim around the eyes?',
            ])
          : null,
        cancelledAt,
        cancelReason:
          status === 'cancelled'
            ? pick(['Change of plans', 'Pet is unwell', 'Travelling that day'])
            : null,
        createdAt,
        updatedAt: logs[logs.length - 1].at,
        _logs: logs,
        _pay: pay,
        _promo: promo && discount ? { id: promo.id, amount: discount } : undefined,
        _svc: svc,
      });
    }
  }

  const bookings = await prisma.booking.createManyAndReturn({
    data: plans.map(({ _logs, _pay, _promo, _svc, ...b }) => b),
    select: { id: true, bookingNo: true },
  });
  const bookingId = new Map(bookings.map((b) => [b.bookingNo, b.id]));
  const withId = plans.map((p) => ({ ...p, id: bookingId.get(p.bookingNo)! }));

  await prisma.bookingStatusLog.createMany({
    data: withId.flatMap((b) =>
      b._logs.map((l) => ({
        bookingId: b.id,
        fromStatus: l.from,
        toStatus: l.to,
        changedById: l.by,
        note: l.note ?? null,
        createdAt: l.at,
      })),
    ),
  });
  await prisma.promotionUsage.createMany({
    data: withId
      .filter((b) => b._promo)
      .map((b) => ({
        promotionId: b._promo!.id,
        userId: b.userId,
        bookingId: b.id,
        discountAmount: b._promo!.amount,
        createdAt: b.createdAt as Date,
      })),
  });
  for (const p of promos) {
    await prisma.promotion.update({
      where: { id: p.id },
      data: { usedCount: withId.filter((b) => b._promo?.id === p.id).length },
    });
  }

  const paymentRow = (b: (typeof withId)[number]) => {
    const online = b._pay!.method === 'sslcommerz';
    return {
      userId: b.userId,
      bookingId: b.id,
      amount: b.totalAmount,
      baseAmount: b.totalAmount,
      currency: 'BDT' as const,
      exchangeRate: 1,
      method: b._pay!.method,
      gateway: online ? 'sslcommerz' : null,
      transactionId: ref(online ? 'TXN' : 'CASH', b._pay!.at),
      valId: online ? `VAL${hex(10)}` : null,
      bankTranId: online ? `BTX${hex(10)}` : null,
      type: 'payment' as const,
      status: b._pay!.refundAt ? ('refunded' as const) : ('success' as const),
      gatewayResponse: online
        ? {
            card_type: pick([
              'BKASH-BKash',
              'NAGAD-Nagad',
              'VISA-Dutch Bangla',
              'MASTER-City Bank',
            ]),
            status: 'VALID',
          }
        : undefined,
      note: online ? null : 'Paid at the counter',
      paidAt: b._pay!.at,
      createdAt: b._pay!.at,
      updatedAt: b._pay!.refundAt ?? b._pay!.at,
    };
  };
  const payable = withId.filter((b) => b._pay);
  const payments = await prisma.payment.createManyAndReturn({
    data: payable.map(paymentRow),
    select: { id: true, bookingId: true },
  });
  const paymentOf = new Map(payments.map((p) => [p.bookingId!, p.id]));
  await prisma.payment.createMany({
    data: payable
      .filter((b) => b._pay!.refundAt)
      .map((b) => ({
        userId: b.userId,
        bookingId: b.id,
        amount: b.totalAmount,
        baseAmount: b.totalAmount,
        currency: 'BDT' as const,
        exchangeRate: 1,
        method: 'sslcommerz' as const,
        gateway: 'sslcommerz',
        transactionId: ref('RF', b._pay!.refundAt!),
        type: 'refund' as const,
        status: 'success' as const,
        refundOfId: paymentOf.get(b.id)!,
        note: 'Booking cancelled in time — full refund',
        paidAt: b._pay!.refundAt!,
        createdAt: b._pay!.refundAt!,
      })),
  });

  // reviews: ~45% of completed visits; recent ones may still wait for moderation
  const reviewRows: Prisma.ReviewCreateManyInput[] = [];
  for (const b of withId.filter((x) => x.status === 'completed' && chance(0.45))) {
    const endAt = at((b.bookingDate as Date).toISOString().slice(0, 10), b.endTime);
    const createdAt = clampPast(new Date(endAt.getTime() + int(2, 72) * 3_600_000));
    const recent = NOW.getTime() - createdAt.getTime() < 6 * 86_400_000;
    const t = weighted(
      D.REVIEW_TEXT,
      (r) => ({ 5: 10, 4: 5, 3: 1.5, 2: 0.6, 1: 0.2 })[r.rating as 1 | 2 | 3 | 4 | 5],
    );
    const status =
      recent && chance(0.6) ? 'pending' : t.rating <= 2 && chance(0.3) ? 'rejected' : 'approved';
    const replied = status === 'approved' && chance(0.3);
    reviewRows.push({
      bookingId: b.id,
      userId: b.userId,
      serviceId: b.serviceId,
      rating: t.rating,
      title: t.title,
      comment: t.comment,
      status,
      adminReply: replied
        ? t.rating >= 4
          ? pick(D.ADMIN_REPLIES.slice(0, 2))
          : pick(D.ADMIN_REPLIES.slice(2))
        : null,
      repliedAt: replied ? clampPast(new Date(createdAt.getTime() + int(1, 30) * 3_600_000)) : null,
      createdAt,
      updatedAt: createdAt,
    });
  }
  const reviews = await prisma.review.createManyAndReturn({
    data: reviewRows,
    select: { id: true, rating: true, serviceId: true },
  });
  const serviceImage = new Map(services.map((s) => [s.id, s.image]));
  await prisma.reviewImage.createMany({
    data: reviews
      .filter((r) => r.rating >= 4 && chance(0.12))
      .map((r) => ({
        reviewId: r.id,
        image: img(serviceImage.get(r.serviceId) ?? 'service-grooming.jpg'),
      })),
  });
  await recalcRatings();

  /* adoption ----------------------------------------------------------------- */
  const adoptionPets = [];
  for (const p of D.ADOPTION_PETS) {
    let slug = slugify(p.name);
    for (
      let k = 2;
      await prisma.adoptionPet.findFirst({ where: { slug, deletedAt: undefined } });
      k++
    )
      slug = `${slugify(p.name)}-${k}`;
    const row = await prisma.adoptionPet.create({
      data: {
        petTypeId: petTypes.get(p.type)!,
        name: p.name,
        slug,
        breed: p.breed,
        gender: p.gender,
        ageMonths: p.ageMonths,
        size: p.size,
        color: p.color,
        description: p.story,
        healthStatus: p.health,
        isVaccinated: p.vaccinated,
        isNeutered: p.neutered,
        adoptionFee: p.fee,
        status: p.status,
        isFeatured: !!p.featured,
        createdById: manager.id,
        createdAt: daysAgo(int(20, 120)),
        images: {
          create: p.images.map((f, i) => ({ imageUrl: img(f), isPrimary: i === 0, sortOrder: i })),
        },
      },
    });
    m.adoptionPets.push(row.id);
    adoptionPets.push({ ...row, def: p });
  }

  const applicants = [...activeCustomers];
  const reasons = [
    'We have a big house with a garden and our kids have wanted a dog for years.',
    'I work from home and would love a calm companion. I have had cats all my life.',
    'Our family lost our old dog last year and we are ready to give a rescue a home.',
    'I live alone in a pet-friendly apartment and can give lots of time and attention.',
  ];
  const application = async (
    petId: number,
    status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'cancelled',
    createdAt: Date,
  ) => {
    const user = applicants.splice(int(0, applicants.length - 1), 1)[0] ?? pick(activeCustomers);
    const reviewed = status !== 'pending' && status !== 'cancelled';
    return prisma.adoptionApplication.create({
      data: {
        applicationNo: ref('AD', createdAt),
        adoptionPetId: petId,
        userId: user.id,
        homeType: pick(['house', 'apartment'] as const),
        hasYard: chance(0.4),
        hasOtherPets: chance(0.3),
        otherPetsDetails: null,
        hasChildren: chance(0.5),
        experience: chance(0.7) ? 'Grew up with dogs and cats.' : null,
        reason: pick(reasons),
        status,
        createdAt,
        reviewedById: reviewed ? manager.id : null,
        reviewedAt: reviewed
          ? clampPast(new Date(createdAt.getTime() + int(1, 4) * 86_400_000))
          : null,
        adminNote:
          status === 'rejected'
            ? 'Home visit showed the space is not suitable for a large dog right now.'
            : status === 'approved'
              ? 'Lovely family, great fit.'
              : null,
      },
    });
  };

  const adoptionPayments: Prisma.PaymentCreateManyInput[] = [];
  let toby: number | null = null;
  for (const p of adoptionPets) {
    const listed = p.createdAt;
    const after = (days: number) => clampPast(new Date(listed.getTime() + days * 86_400_000));
    if (p.def.status === 'available') {
      for (let k = int(0, 2); k > 0; k--)
        await application(
          p.id,
          pick(['pending', 'pending', 'under_review', 'rejected'] as const),
          after(int(2, 15)),
        );
    } else if (p.def.status === 'on_hold') {
      if (chance(0.5)) await application(p.id, 'cancelled', after(int(3, 10)));
    } else {
      // pending → approved + adoption in progress; adopted → approved + completed (+ fee paid)
      const app = await application(p.id, 'approved', after(int(3, 12)));
      if (chance(0.5)) await application(p.id, 'rejected', after(int(4, 14)));
      const done = p.def.status === 'adopted';
      const adoptionDate = done ? after(int(15, 25)) : at(dayStr(int(2, 7)), '11:00');
      const adoption = await prisma.adoption.create({
        data: {
          applicationId: app.id,
          adoptionPetId: p.id,
          userId: app.userId,
          status: done ? 'completed' : 'in_progress',
          adoptionDate: dateOnly(adoptionDate.toISOString().slice(0, 10)),
          feeAmount: p.def.fee,
          feePaid: done ? p.def.fee : 0,
          followUpDate: done
            ? dateOnly(
                new Date(adoptionDate.getTime() + 30 * 86_400_000).toISOString().slice(0, 10),
              )
            : null,
          completedAt: done ? adoptionDate : null,
          createdAt: app.reviewedAt ?? app.createdAt,
        },
      });
      if (p.def.name === 'Toby') toby = adoption.id;
      if (done && p.def.fee > 0) {
        const online = chance(0.5);
        adoptionPayments.push({
          userId: app.userId,
          adoptionId: adoption.id,
          amount: p.def.fee,
          baseAmount: p.def.fee,
          currency: 'BDT',
          exchangeRate: 1,
          method: online ? 'sslcommerz' : 'cash',
          gateway: online ? 'sslcommerz' : null,
          transactionId: ref(online ? 'TXN' : 'CASH', adoptionDate),
          type: 'payment',
          status: 'success',
          note: 'Adoption fee',
          paidAt: adoptionDate,
          createdAt: adoptionDate,
        });
      }
    }
  }
  await prisma.payment.createMany({ data: adoptionPayments });

  // favourites
  const favs = new Set<string>();
  const openPets = adoptionPets.filter(
    (p) => p.def.status === 'available' || p.def.status === 'pending',
  );
  for (let k = 0; k < 70; k++) favs.add(`${pick(activeCustomers).id}|${pick(openPets).id}`);
  await prisma.favorite.createMany({
    data: [...favs].map((f) => ({
      userId: Number(f.split('|')[0]),
      adoptionPetId: Number(f.split('|')[1]),
      createdAt: daysAgo(int(0, 60)),
    })),
    skipDuplicates: true,
  });

  /* website content ------------------------------------------------------------ */
  const blogCat = new Map<string, number>();
  for (const c of D.BLOG_CATEGORIES) {
    const existing = await prisma.blogCategory.findFirst({ where: { slug: c.slug } });
    const row = existing ?? (await prisma.blogCategory.create({ data: c }));
    if (!existing) m.blogCategories.push(row.id);
    blogCat.set(c.slug, row.id);
  }
  for (const p of D.BLOG_POSTS) {
    const slug = slugify(p.title.replace(/^Draft:\s*/, ''));
    if (await prisma.blogPost.findFirst({ where: { slug, deletedAt: undefined } })) continue;
    const publishedAt =
      p.daysAgo === null
        ? null
        : p.daysAgo < 0
          ? at(dayStr(-p.daysAgo), '09:00')
          : daysAgo(p.daysAgo, '10:00');
    const row = await prisma.blogPost.create({
      data: {
        categoryId: blogCat.get(p.category)!,
        authorId: manager.id,
        title: p.title.replace(/^Draft:\s*/, ''),
        slug,
        excerpt: p.excerpt,
        content: p.content,
        coverImage: img(p.cover),
        status: p.daysAgo === null ? 'draft' : 'published',
        publishedAt,
        metaDescription: p.excerpt,
        createdAt: p.daysAgo !== null && p.daysAgo > 0 ? daysAgo(p.daysAgo + 1) : daysAgo(1),
      },
    });
    m.blogPosts.push(row.id);
  }

  const faqs = await prisma.faq.createManyAndReturn({
    data: D.FAQS.map((f, i) => ({
      question: f.q,
      answer: f.a,
      category: f.category,
      sortOrder: i,
    })),
  });
  m.faqs.push(...faqs.map((f) => f.id));

  const testimonials = await prisma.testimonial.createManyAndReturn({
    data: D.TESTIMONIALS.map((t, i) => ({
      name: t.name,
      content: t.content,
      rating: t.rating,
      isFeatured: t.featured,
      createdAt: daysAgo(10 + i * 9),
      adoptionId: t.name === 'Nusrat Jahan' ? toby : null,
    })),
  });
  m.testimonials.push(...testimonials.map((t) => t.id));

  const serviceByImage = (file: string) => services.find((s) => s.image === file)?.id ?? null;
  for (const [i, a] of D.GALLERY_ALBUMS.entries()) {
    const existing = await prisma.galleryAlbum.findFirst({ where: { slug: a.slug } });
    const album =
      existing ??
      (await prisma.galleryAlbum.create({
        data: {
          title: a.title,
          slug: a.slug,
          description: a.description,
          coverImage: img(a.cover),
          sortOrder: i,
        },
      }));
    if (!existing) m.albums.push(album.id);
    const items = await prisma.galleryItem.createManyAndReturn({
      data: a.items.map(([file, title], k) => ({
        albumId: album.id,
        serviceId: serviceByImage(file),
        title,
        altText: title,
        fileUrl: img(file),
        sortOrder: k,
        isFeatured: k < 2,
        uploadedById: manager.id,
        createdAt: daysAgo(int(5, 90)),
        beforeImageUrl: a.slug === 'grooming-day' && k === 0 ? img('gallery-collie.jpg') : null,
      })),
    });
    m.galleryItems.push(...items.map((x) => x.id));
  }

  const contacts = await prisma.contactMessage.createManyAndReturn({
    data: D.CONTACT_SUBJECTS.map(([subject, message], i) => {
      const first = pick(D.FIRST_NAMES);
      const last = pick(D.LAST_NAMES);
      return {
        name: `${first} ${last}`,
        email: email(first, last, `.c${i}`),
        phone: chance(0.6) ? phone() : null,
        subject,
        message,
        status: i < 4 ? ('new' as const) : i < 7 ? ('read' as const) : ('replied' as const),
        createdAt: daysAgo(i * 2 + int(0, 1)),
      };
    }),
  });
  m.contacts.push(...contacts.map((c) => c.id));

  const subscriberEmails = [
    ...customers.filter(() => chance(0.6)).map((c) => c.email),
    ...Array.from({ length: 40 }, (_, i) => `reader${i + 1}@${D.DEMO_DOMAIN}`),
  ];
  const subscribers = await prisma.newsletterSubscriber.createManyAndReturn({
    data: subscriberEmails.map((e, i) => {
      const unsub = i % 11 === 0;
      const since = int(1, 170);
      return {
        email: e,
        status: unsub ? ('unsubscribed' as const) : ('subscribed' as const),
        subscribedAt: daysAgo(since),
        unsubscribedAt: unsub ? daysAgo(int(0, since - 1 < 0 ? 0 : since - 1)) : null,
      };
    }),
    skipDuplicates: true,
  });
  m.subscribers.push(...subscribers.map((s) => s.id));

  // closed days: next Victory Day (16 Dec) for everyone + one staff day off next week
  const year = Number(TODAY.slice(0, 4));
  const victory = `${TODAY.slice(5) > '12-16' ? year + 1 : year}-12-16`;
  const blocked = await prisma.blockedDate.createManyAndReturn({
    data: [
      { date: dateOnly(victory), reason: 'Victory Day — studio closed', staffId: null },
      { date: dateOnly(dayStr(8)), reason: 'Annual leave', staffId: staff[0].id },
    ],
  });
  m.blockedDates.push(...blocked.map((b) => b.id));

  /* notifications ------------------------------------------------------------ */
  const notes: Prisma.NotificationCreateManyInput[] = [];
  for (const b of withId.filter(
    (x) => (x.createdAt as Date).getTime() > NOW.getTime() - 30 * 86_400_000,
  )) {
    const last = b._logs[b._logs.length - 1];
    const titles: Partial<Record<BookingStatus, [string, string]>> = {
      pending: ['Booking received', `We received your booking ${b.bookingNo} for ${b._svc.name}.`],
      confirmed: ['Booking confirmed', `Your ${b._svc.name} booking ${b.bookingNo} is confirmed.`],
      completed: [
        'Thanks for visiting!',
        `${b._svc.name} is done — tell us how it went with a review.`,
      ],
      cancelled: ['Booking cancelled', `Booking ${b.bookingNo} was cancelled.`],
      no_show: [
        'We missed you',
        `You did not make it to booking ${b.bookingNo}. Book again any time.`,
      ],
      in_progress: ['Your pet is with us', `${b._svc.name} has started.`],
    };
    const [title, message] = titles[b.status as BookingStatus] ?? titles.pending!;
    const old = NOW.getTime() - last.at.getTime() > 3 * 86_400_000;
    notes.push({
      userId: b.userId,
      type: `booking.${b.status}`,
      title,
      message,
      data: { bookingNo: b.bookingNo },
      createdAt: last.at,
      readAt: old && chance(0.8) ? new Date(last.at.getTime() + 3_600_000) : null,
    });
  }
  await prisma.notification.createMany({ data: notes });

  /* manifest + summary -------------------------------------------------------- */
  await prisma.setting.upsert({
    where: { key: MANIFEST_KEY },
    update: { value: m as unknown as Prisma.InputJsonValue },
    create: {
      key: MANIFEST_KEY,
      value: m as unknown as Prisma.InputJsonValue,
      group: 'system',
      isPublic: false,
    },
  });

  const count = (s: BookingStatus) => withId.filter((b) => b.status === s).length;
  const revenue =
    payable.filter((b) => !b._pay!.refundAt).reduce((s, b) => s + Number(b.totalAmount), 0) +
    adoptionPayments.reduce((s, p) => s + Number(p.amount), 0);
  console.log(`
✅ Demo data ready
   Accounts     : 1 manager, ${staff.length} staff, ${customers.length} customers (password: ${D.DEMO_PASSWORD})
   Catalog      : ${m.categories.length} categories, ${m.services.length} services, ${m.promotions.length} promotions
   Customer pets: ${pets.length}
   Bookings     : ${withId.length} (${count('completed')} completed, ${count('cancelled')} cancelled, ${count('no_show')} no-show, ${count('confirmed') + count('pending') + count('in_progress')} upcoming/today)
   Payments     : ${payable.length + adoptionPayments.length} (+ ${payable.filter((b) => b._pay!.refundAt).length} refunds) · net ৳${revenue.toLocaleString('en-IN')}
   Reviews      : ${reviews.length}
   Adoption     : ${adoptionPets.length} pets, ${adoptionPayments.length} paid adoptions, ${favs.size} favourites
   Content      : ${m.blogPosts.length} posts, ${m.faqs.length} FAQs, ${m.testimonials.length} testimonials, ${m.galleryItems.length} gallery items
   Inbox        : ${m.contacts.length} messages, ${m.subscribers.length} subscribers, ${notes.length} notifications
   Images from  : ${IMAGE_BASE}  (set DEMO_IMAGE_BASE_URL to change)

   Sign in as   : manager@${D.DEMO_DOMAIN} (admin) · ${staff[0].email} (staff) · ${customers[0].email} (customer)
   Remove later : npm run db:seed:demo -- --remove
`);
}

/* ───────────────────────── entry ───────────────────────── */

export async function seedDemo(args: string[] = []) {
  if (env.NODE_ENV === 'production' && !args.includes('--force')) {
    throw new Error(
      'Refusing to add demo data with NODE_ENV=production (pass --force if you really mean it).',
    );
  }
  if (args.includes('--remove') || args.includes('--reset')) await removeDemo();
  if (!args.includes('--remove')) await createDemo();
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  seedDemo(process.argv.slice(2))
    .catch((e) => {
      console.error('❌ Demo seed failed:', e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
