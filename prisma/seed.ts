/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { PERMISSION_DEFINITIONS } from '@/shared/constants/permissions';
import { SETTING_DEFINITIONS } from '@/shared/constants/settings';
import {
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLES,
} from '@/shared/constants/roles';

const PET_TYPES = [
  { name: 'Dog', slug: 'dog', icon: 'dog' },
  { name: 'Cat', slug: 'cat', icon: 'cat' },
  { name: 'Bird', slug: 'bird', icon: 'bird' },
  { name: 'Rabbit', slug: 'rabbit', icon: 'rabbit' },
  { name: 'Fish', slug: 'fish', icon: 'fish' },
];

export async function seed() {
  // 1. Permissions (upsert keeps it idempotent)
  for (const p of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { name: p.name, module: p.module },
      create: p,
    });
  }
  const permissions = await prisma.permission.findMany({ select: { id: true, slug: true } });
  const permissionIdBySlug = new Map(permissions.map((p) => [p.slug, p.id]));

  // 2. System roles + default permissions
  for (const r of SYSTEM_ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { slug: r.slug },
      update: { isSystem: true },
      create: { ...r, isSystem: true },
    });

    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    // only assign defaults the first time, so admin changes are not overwritten on re-seed
    if (existing === 0 || r.slug === SYSTEM_ROLES.SUPER_ADMIN) {
      const ids = DEFAULT_ROLE_PERMISSIONS[r.slug]
        .map((slug) => permissionIdBySlug.get(slug))
        .filter((id): id is number => id !== undefined);
      await prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }

  // 3. Super admin user
  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { slug: SYSTEM_ROLES.SUPER_ADMIN },
  });
  const email = env.SEED_SUPER_ADMIN_EMAIL.toLowerCase();
  const exists = await prisma.user.findFirst({ where: { email, deletedAt: undefined } });
  if (!exists) {
    await prisma.user.create({
      data: {
        firstName: 'Super',
        lastName: 'Admin',
        email,
        password: await bcrypt.hash(env.SEED_SUPER_ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS),
        roleId: superAdminRole.id,
        emailVerifiedAt: new Date(),
      },
    });
  }

  // 4. Pet types
  for (const t of PET_TYPES) {
    await prisma.petType.upsert({ where: { slug: t.slug }, update: {}, create: t });
  }

  // 5. Settings (never overwrite values an admin already changed)
  for (const [key, def] of Object.entries(SETTING_DEFINITIONS)) {
    await prisma.setting.upsert({
      where: { key },
      update: { group: def.group, isPublic: def.isPublic },
      create: { key, value: def.default as object, group: def.group, isPublic: def.isPublic },
    });
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seed()
    .then(() => console.log('✅ Database seeded'))
    .catch((e) => {
      console.error('❌ Seed failed', e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
