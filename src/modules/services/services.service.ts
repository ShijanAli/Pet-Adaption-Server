import type { ActiveStatus } from '@generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { assertIdsExist } from '@/shared/utils/db';
import { whereIdOrSlug } from '@/shared/utils/validation';
import {
  NON_PROVIDER_ROLE,
  OPEN_BOOKING_STATUSES,
  serviceDetailInclude,
  serviceListInclude,
  serviceQueryConfig,
} from './services.constant';
import type {
  CreateServiceInput,
  ListServicesQuery,
  UpdateServiceInput,
} from './services.validation';

const crud = createCrudService({
  delegate: () => prisma.service,
  entityName: 'Service',
  softDelete: true,
  queryConfig: serviceQueryConfig,
  listInclude: serviceListInclude,
});

/** What the public site may see */
const PUBLIC_WHERE = {
  status: 'active',
  category: { status: 'active', deletedAt: null },
} as const;

type WithJoins = {
  petTypes?: { petType: unknown }[];
  staff?: { staff: unknown }[];
};

/** `petTypes: [{ petType: {...} }]` → `petTypes: [{...}]` (same for staff) */
const toDto = <T extends WithJoins>(service: T) => ({
  ...service,
  ...(service.petTypes && { petTypes: service.petTypes.map((p) => p.petType) }),
  ...(service.staff && { staff: service.staff.map((s) => s.staff) }),
});

const assertCategory = async (categoryId?: number) => {
  if (categoryId === undefined) return;
  await assertIdsExist(prisma.serviceCategory, [categoryId], 'category');
};

const assertPetTypes = (ids?: number[]) =>
  ids ? assertIdsExist(prisma.petType, ids, 'pet type', { status: 'active' }) : undefined;

const assertProviders = (ids?: number[]) =>
  ids
    ? assertIdsExist(prisma.user, ids, 'staff', {
        status: 'active',
        role: { slug: { not: NON_PROVIDER_ROLE } },
      })
    : undefined;

const getDetail = async (where: Record<string, unknown>) => {
  const service = await prisma.service.findFirst({ where, include: serviceDetailInclude });
  if (!service) throw AppError.notFound('Service');
  return toDto(service);
};

const countOpenBookings = (serviceId: number) =>
  prisma.booking.count({ where: { serviceId, status: { in: [...OPEN_BOOKING_STATUSES] } } });

export const ServiceService = {
  async getAll(query: ListServicesQuery, canManage: boolean) {
    const { data, meta } = await crud.getAll(
      canManage ? query : { ...query, status: undefined },
      canManage ? {} : PUBLIC_WHERE,
    );
    return { data: (data as WithJoins[]).map(toDto), meta };
  },

  getByIdOrSlug: (idOrSlug: string, canManage: boolean) =>
    getDetail({ ...whereIdOrSlug(idOrSlug), ...(!canManage && PUBLIC_WHERE) }),

  async create(actorId: number, { petTypeIds, staffIds, slug, ...input }: CreateServiceInput) {
    await Promise.all([
      assertCategory(input.categoryId),
      assertPetTypes(petTypeIds),
      assertProviders(staffIds),
    ]);

    const created = await prisma.service.create({
      data: {
        ...input,
        slug: await crud.ensureUniqueSlug(slug ?? input.name),
        createdById: actorId,
        petTypes: { create: petTypeIds.map((petTypeId) => ({ petTypeId })) },
        staff: { create: staffIds.map((staffId) => ({ staffId })) },
      },
    });
    return getDetail({ id: created.id });
  },

  async update(
    actorId: number,
    id: number,
    { petTypeIds, staffIds, slug, ...input }: UpdateServiceInput,
  ) {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Service');

    // validate the discount against whichever price will be stored
    const price = input.price ?? Number(existing.price);
    const discount =
      input.discountPrice === undefined ? existing.discountPrice : input.discountPrice;
    if (discount != null && Number(discount) >= price) {
      throw AppError.unprocessable('Discount price must be lower than the price', [
        { path: 'discountPrice', message: 'Must be lower than the price' },
      ]);
    }

    if (input.durationMinutes && input.durationMinutes !== existing.durationMinutes) {
      if (await countOpenBookings(id)) {
        throw AppError.conflict('Duration cannot change while the service has open bookings');
      }
    }

    await Promise.all([
      assertCategory(input.categoryId),
      assertPetTypes(petTypeIds),
      assertProviders(staffIds),
    ]);

    await prisma.service.update({
      where: { id },
      data: {
        ...input,
        ...(slug && { slug: await crud.ensureUniqueSlug(slug, id) }),
        updatedById: actorId,
        ...(petTypeIds && {
          petTypes: { deleteMany: {}, create: petTypeIds.map((petTypeId) => ({ petTypeId })) },
        }),
        ...(staffIds && {
          staff: { deleteMany: {}, create: staffIds.map((staffId) => ({ staffId })) },
        }),
      },
    });
    return getDetail({ id });
  },

  updateStatus: (actorId: number, id: number, status: ActiveStatus) =>
    ServiceService.update(actorId, id, { status }),

  setPetTypes: (actorId: number, id: number, petTypeIds: number[]) =>
    ServiceService.update(actorId, id, { petTypeIds }),

  setStaff: (actorId: number, id: number, staffIds: number[]) =>
    ServiceService.update(actorId, id, { staffIds }),

  async remove(actorId: number, id: number) {
    await crud.getById(id);
    const open = await countOpenBookings(id);
    if (open) {
      throw AppError.conflict(`Service has ${open} open booking(s). Deactivate it instead`);
    }
    await prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actorId, status: 'inactive' },
    });
  },
};
