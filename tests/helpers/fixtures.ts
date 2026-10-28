import { prisma } from '@/lib/prisma';
import { slugify } from '@/shared/utils/common';
import {
  dateOnly,
  dayOfWeek,
  nowInBusinessTz,
  timeToMinutes,
  minutesToTime,
} from '@/shared/utils/time';

let seq = 0;
const unique = (label: string) => `${label} ${Date.now()}-${++seq}`;

/** "YYYY-MM-DD" n days from today in the business timezone */
export const daysFromToday = (n: number) => {
  const d = dateOnly(nowInBusinessTz().date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const petTypeId = async (slug = 'dog') =>
  (await prisma.petType.findUniqueOrThrow({ where: { slug } })).id;

export const createCategory = async (
  overrides: Partial<{ parentId: number; status: 'active' | 'inactive' }> = {},
) => {
  const name = unique('Category');
  return prisma.serviceCategory.create({ data: { name, slug: slugify(name), ...overrides } });
};

export const createService = async (
  overrides: Partial<{
    categoryId: number;
    name: string;
    price: number;
    durationMinutes: number;
    status: 'active' | 'inactive';
    staffIds: number[];
    petTypeSlugs: string[];
  }> = {},
) => {
  const categoryId = overrides.categoryId ?? (await createCategory()).id;
  const name = overrides.name ?? unique('Service');
  const petTypeIds = await Promise.all((overrides.petTypeSlugs ?? ['dog']).map(petTypeId));
  return prisma.service.create({
    data: {
      categoryId,
      name,
      slug: slugify(name),
      price: overrides.price ?? 1000,
      durationMinutes: overrides.durationMinutes ?? 60,
      status: overrides.status ?? 'active',
      petTypes: { create: petTypeIds.map((id) => ({ petTypeId: id })) },
      staff: { create: (overrides.staffIds ?? []).map((staffId) => ({ staffId })) },
    },
  });
};

export const setSchedule = (staffId: number, date: string, startTime: string, endTime: string) =>
  prisma.staffSchedule.upsert({
    where: { staffId_dayOfWeek: { staffId, dayOfWeek: dayOfWeek(date) } },
    update: { startTime, endTime, isActive: true },
    create: { staffId, dayOfWeek: dayOfWeek(date), startTime, endTime },
  });

export const createPet = async (userId: number) =>
  prisma.pet.create({ data: { userId, petTypeId: await petTypeId('dog'), name: unique('Pet') } });

/** Inserts a booking directly (the booking API arrives in Phase 3) */
export const createBooking = async (params: {
  userId: number;
  serviceId: number;
  staffId?: number;
  date: string;
  startTime: string;
  durationMinutes?: number;
  status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
}) => {
  const pet = await createPet(params.userId);
  return prisma.booking.create({
    data: {
      bookingNo: unique('BK').replace(/\s/g, '-'),
      userId: params.userId,
      petId: pet.id,
      serviceId: params.serviceId,
      assignedStaffId: params.staffId,
      bookingDate: dateOnly(params.date),
      startTime: params.startTime,
      endTime: minutesToTime(timeToMinutes(params.startTime) + (params.durationMinutes ?? 60)),
      servicePrice: 1000,
      totalAmount: 1000,
      status: params.status ?? 'confirmed',
    },
  });
};

/**
 * Everything needed to book through the API:
 * a staff member working 09:00–13:00 on `date`, a service they provide, and a customer with a dog.
 */
export const bookableSetup = async (
  options: {
    daysAhead?: number;
    price?: number;
    durationMinutes?: number;
    staffCount?: number;
  } = {},
) => {
  const { createUser, createAndLogin } = await import('./index');
  const date = daysFromToday(options.daysAhead ?? 5);
  const staff = [];
  for (let i = 0; i < (options.staffCount ?? 1); i++) {
    const s = await createUser('staff');
    await setSchedule(s.id, date, '09:00', '13:00');
    staff.push(s);
  }
  const service = await createService({
    price: options.price ?? 1000,
    durationMinutes: options.durationMinutes ?? 60,
    staffIds: staff.map((s) => s.id),
  });
  const customer = await createAndLogin('customer');
  const pet = await prisma.pet.create({
    data: {
      userId: customer.user.id,
      petTypeId: await petTypeId('dog'),
      name: 'Buddy',
      isVaccinated: true,
    },
  });
  return { date, staff, service, customer, pet };
};

export const createAdoptionPet = async (
  overrides: Partial<{
    name: string;
    petTypeSlug: string;
    adoptionFee: number;
    status: 'available' | 'pending' | 'adopted' | 'on_hold';
    ageMonths: number;
    gender: 'male' | 'female';
  }> = {},
) => {
  const name = overrides.name ?? unique('Adoptable');
  return prisma.adoptionPet.create({
    data: {
      name,
      slug: slugify(name),
      petTypeId: await petTypeId(overrides.petTypeSlug ?? 'dog'),
      gender: overrides.gender ?? 'male',
      ageMonths: overrides.ageMonths ?? 12,
      description: 'A lovely, friendly companion looking for a home.',
      adoptionFee: overrides.adoptionFee ?? 0,
      status: overrides.status ?? 'available',
    },
  });
};

export const applicationBody = (adoptionPetId: number, extra: Record<string, unknown> = {}) => ({
  adoptionPetId,
  homeType: 'house',
  hasYard: true,
  reason: 'We have a big garden and lots of love to give to a pet.',
  ...extra,
});
