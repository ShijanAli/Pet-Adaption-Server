import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { emailService } from '@/shared/services/email.service';
import { notificationService } from '@/shared/services/notification.service';
import { round2, toNumber } from '@/shared/utils/money';
import { dateOnly, nowInBusinessTz, toDateString } from '@/shared/utils/time';
import type { AuthUser } from '@/shared/types/auth';
import {
  adminAdoptionInclude,
  adminAdoptionQueryConfig,
  adoptionDetailInclude,
  adoptionInclude,
  myAdoptionQueryConfig,
} from './adoptions.constant';
import type {
  AdoptionListQuery,
  CompleteAdoptionInput,
  UpdateAdoptionInput,
} from './adoptions.validation';

const mine = createCrudService({
  delegate: () => prisma.adoption,
  entityName: 'Adoption',
  queryConfig: myAdoptionQueryConfig,
  include: adoptionInclude,
});

const all = createCrudService({
  delegate: () => prisma.adoption,
  entityName: 'Adoption',
  queryConfig: adminAdoptionQueryConfig,
  include: adminAdoptionInclude,
});

type Dated = {
  adoptionDate: Date;
  followUpDate: Date | null;
  feeAmount: unknown;
  feePaid: unknown;
};

/** @db.Date → "YYYY-MM-DD" and the outstanding fee */
const toDto = <T extends Dated>(a: T) => ({
  ...a,
  adoptionDate: toDateString(a.adoptionDate),
  followUpDate: a.followUpDate ? toDateString(a.followUpDate) : null,
  feeDue: Math.max(0, round2(toNumber(a.feeAmount as number) - toNumber(a.feePaid as number))),
});

const mapPage = (page: { data: unknown; meta: unknown }) => ({
  data: (page.data as Dated[]).map(toDto),
  meta: page.meta as never,
});

const getDetail = async (where: Record<string, unknown>) => {
  const adoption = await prisma.adoption.findFirst({ where, include: adoptionDetailInclude });
  if (!adoption) throw AppError.notFound('Adoption');
  return toDto(adoption);
};

const getInProgress = async (id: number) => {
  const adoption = await prisma.adoption.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, email: true } },
      adoptionPet: { select: { id: true, name: true } },
      application: { select: { id: true, applicationNo: true } },
    },
  });
  if (!adoption) throw AppError.notFound('Adoption');
  if (adoption.status !== 'in_progress') {
    throw AppError.conflict(`This adoption is already ${adoption.status.replace('_', ' ')}`);
  }
  return adoption;
};

export const AdoptionService = {
  getMine: async (userId: number, query: AdoptionListQuery) =>
    mapPage(await mine.getAll(query, { userId })),

  getMineById: (userId: number, id: number) => getDetail({ id, userId }),

  getAll: async (query: AdoptionListQuery) => mapPage(await all.getAll(query)),

  getById: (id: number) => getDetail({ id }),

  async update(id: number, input: UpdateAdoptionInput) {
    const adoption = await prisma.adoption.findUnique({ where: { id } });
    if (!adoption) throw AppError.notFound('Adoption');
    if (adoption.status === 'cancelled')
      throw AppError.conflict('A cancelled adoption cannot be edited');
    await prisma.adoption.update({ where: { id }, data: input });
    return getDetail({ id });
  },

  /** Handover done: requires the full fee, marks the pet as adopted */
  async complete(id: number, input: CompleteAdoptionInput) {
    const adoption = await getInProgress(id);
    const due = round2(toNumber(adoption.feeAmount) - toNumber(adoption.feePaid));
    if (due > 0) {
      throw AppError.badRequest(`The adoption fee is not fully paid yet (due ${due} BDT)`);
    }

    const adoptionDate = input.adoptionDate ?? dateOnly(nowInBusinessTz().date);
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.adoption.updateMany({
        where: { id, status: 'in_progress' },
        data: {
          status: 'completed',
          completedAt: new Date(),
          adoptionDate,
          ...(input.contractFile && { contractFile: input.contractFile }),
          ...(input.followUpDate && { followUpDate: input.followUpDate }),
        },
      });
      if (count === 0) throw AppError.conflict('Adoption changed in the meantime, please reload');
      await tx.adoptionPet.updateMany({
        where: { id: adoption.adoptionPetId, status: 'pending' },
        data: { status: 'adopted', isFeatured: false },
      });
    });

    emailService.queue(
      { email: adoption.user.email, name: adoption.user.firstName },
      'ADOPTION_COMPLETED',
      {
        name: adoption.user.firstName,
        petName: adoption.adoptionPet.name,
        adoptionDate: toDateString(adoptionDate),
      },
    );
    notificationService.notify(adoption.userId, {
      type: 'adoption.completed',
      title: `${adoption.adoptionPet.name} is officially yours!`,
      message: 'The adoption is complete. Thank you for adopting.',
      data: { adoptionId: id },
    });
    return getDetail({ id });
  },

  /** Backs out of an approved adoption: pet becomes available again */
  async cancel(actor: AuthUser, id: number, reason: string) {
    const adoption = await getInProgress(id);
    if (toNumber(adoption.feePaid) > 0) {
      throw AppError.conflict(
        'Part of the fee was paid. Refund it first (POST /payments/:id/refund)',
      );
    }

    await prisma.$transaction(async (tx) => {
      const { count } = await tx.adoption.updateMany({
        where: { id, status: 'in_progress' },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason },
      });
      if (count === 0) throw AppError.conflict('Adoption changed in the meantime, please reload');
      await tx.adoptionApplication.update({
        where: { id: adoption.applicationId },
        data: {
          status: 'cancelled',
          adminNote: reason,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
      await tx.adoptionPet.updateMany({
        where: { id: adoption.adoptionPetId, status: 'pending' },
        data: { status: 'available' },
      });
    });

    emailService.queue(
      { email: adoption.user.email, name: adoption.user.firstName },
      'ADOPTION_APPLICATION_STATUS',
      {
        name: adoption.user.firstName,
        applicationNo: adoption.application.applicationNo,
        petName: adoption.adoptionPet.name,
        status: 'cancelled',
        note: reason,
      },
    );
    return getDetail({ id });
  },
};
