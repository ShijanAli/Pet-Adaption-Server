import type { ApplicationStatus } from '@generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { emailService } from '@/shared/services/email.service';
import { notificationService } from '@/shared/services/notification.service';
import { generateReferenceNo } from '@/shared/utils/common';
import { formatMoney, toNumber } from '@/shared/utils/money';
import { dateOnly, nowInBusinessTz } from '@/shared/utils/time';
import { serializableTransaction } from '@/shared/utils/transaction';
import { whereIdOr } from '@/shared/utils/validation';
import type { AuthUser } from '@/shared/types/auth';
import {
  adminApplicationInclude,
  adminApplicationQueryConfig,
  myApplicationInclude,
  myApplicationQueryConfig,
  OPEN_APPLICATION_STATUSES,
  REVIEW_TRANSITIONS,
} from './adoption-applications.constant';
import type {
  ApplicationListQuery,
  CreateApplicationInput,
  ReviewInput,
} from './adoption-applications.validation';

const OPEN = [...OPEN_APPLICATION_STATUSES];

const mine = createCrudService({
  delegate: () => prisma.adoptionApplication,
  entityName: 'Application',
  queryConfig: myApplicationQueryConfig,
  include: myApplicationInclude,
});

const all = createCrudService({
  delegate: () => prisma.adoptionApplication,
  entityName: 'Application',
  queryConfig: adminApplicationQueryConfig,
  include: adminApplicationInclude,
});

type Notifiable = {
  applicationNo: string;
  user: { id: number; firstName: string; email: string };
  adoptionPet: { name: string };
};

const notifyStatus = (
  app: Notifiable,
  status: ApplicationStatus,
  note?: string | null,
  fee?: number | null,
) => {
  emailService.queue(
    { email: app.user.email, name: app.user.firstName },
    'ADOPTION_APPLICATION_STATUS',
    {
      name: app.user.firstName,
      applicationNo: app.applicationNo,
      petName: app.adoptionPet.name,
      status,
      note,
      fee: fee ? formatMoney(fee) : null,
    },
  );
  notificationService.notify(app.user.id, {
    type: `adoption_application.${status}`,
    title: `Application ${app.applicationNo} ${status.replace('_', ' ')}`,
    message: `Your application for ${app.adoptionPet.name} is now ${status.replace('_', ' ')}`,
    data: { applicationNo: app.applicationNo },
  });
};

const withParties = {
  user: { select: { id: true, firstName: true, email: true } },
  adoptionPet: { select: { id: true, name: true, adoptionFee: true } },
} as const;

export const ApplicationService = {
  async apply(user: AuthUser, input: CreateApplicationInput) {
    const pet = await prisma.adoptionPet.findUnique({ where: { id: input.adoptionPetId } });
    if (!pet) throw AppError.notFound('Adoption pet');
    if (pet.status !== 'available') {
      throw AppError.badRequest('This pet is not accepting applications right now');
    }

    const existing = await prisma.adoptionApplication.findFirst({
      where: { userId: user.id, adoptionPetId: pet.id, status: { in: OPEN } },
      select: { applicationNo: true },
    });
    if (existing) {
      throw AppError.conflict(
        `You already have an open application (${existing.applicationNo}) for this pet`,
      );
    }

    const created = await prisma.adoptionApplication.create({
      data: { ...input, userId: user.id, applicationNo: generateReferenceNo('AD') },
      include: myApplicationInclude,
    });

    emailService.queue(
      { email: user.email, name: user.firstName },
      'ADOPTION_APPLICATION_RECEIVED',
      {
        name: user.firstName,
        applicationNo: created.applicationNo,
        petName: pet.name,
      },
    );
    notificationService.notify(user.id, {
      type: 'adoption_application.created',
      title: `Application ${created.applicationNo} received`,
      message: `We received your application for ${pet.name}`,
      data: { applicationNo: created.applicationNo },
    });
    return created;
  },

  /* ───── customer ───── */

  getMine: (userId: number, query: ApplicationListQuery) => mine.getAll(query, { userId }),

  getMineByIdOrNo: (userId: number, idOrNo: string) =>
    mine.getOne({ ...whereIdOr('applicationNo', idOrNo), userId }),

  async cancelMine(userId: number, idOrNo: string, reason?: string) {
    const app = await prisma.adoptionApplication.findFirst({
      where: { ...whereIdOr('applicationNo', idOrNo), userId },
      include: withParties,
    });
    if (!app) throw AppError.notFound('Application');
    if (!OPEN.includes(app.status as (typeof OPEN)[number])) {
      throw AppError.badRequest(
        `A ${app.status.replace('_', ' ')} application cannot be cancelled`,
      );
    }
    const { count } = await prisma.adoptionApplication.updateMany({
      where: { id: app.id, status: app.status },
      data: {
        status: 'cancelled',
        adminNote: reason ? `Cancelled by applicant: ${reason}` : 'Cancelled by applicant',
      },
    });
    if (count === 0) throw AppError.conflict('Application changed in the meantime, please reload');
    return mine.getById(app.id);
  },

  /* ───── admin ───── */

  getAll: (query: ApplicationListQuery) => all.getAll(query),

  getById: (id: number) => all.getById(id),

  /**
   * Review decision. Approving:
   *  - locks the pet (available → pending) so nobody else can be approved
   *  - creates the adoption record with a snapshot of the fee
   *  - auto-rejects every other open application for the pet
   */
  async review(actor: AuthUser, id: number, { status, adminNote }: ReviewInput) {
    const app = await prisma.adoptionApplication.findUnique({
      where: { id },
      include: withParties,
    });
    if (!app) throw AppError.notFound('Application');
    if (!REVIEW_TRANSITIONS[app.status].includes(status)) {
      throw AppError.badRequest(`Cannot change an application from ${app.status} to ${status}`);
    }

    const reviewed = {
      reviewedById: actor.id,
      reviewedAt: new Date(),
      adminNote: adminNote ?? null,
    };

    if (status !== 'approved') {
      const { count } = await prisma.adoptionApplication.updateMany({
        where: { id, status: app.status },
        data: { status, ...reviewed },
      });
      if (count === 0)
        throw AppError.conflict('Application changed in the meantime, please reload');
      notifyStatus(app, status, adminNote);
      return all.getById(id);
    }

    const fee = toNumber(app.adoptionPet.adoptionFee);
    const others = await serializableTransaction(async (tx) => {
      const locked = await tx.adoptionPet.updateMany({
        where: { id: app.adoptionPetId, status: 'available' },
        data: { status: 'pending' },
      });
      if (locked.count === 0) {
        throw AppError.conflict(
          'This pet is no longer available (another application may have been approved)',
        );
      }

      const { count } = await tx.adoptionApplication.updateMany({
        where: { id, status: app.status },
        data: { status: 'approved', ...reviewed },
      });
      if (count === 0)
        throw AppError.conflict('Application changed in the meantime, please reload');

      await tx.adoption.create({
        data: {
          applicationId: id,
          adoptionPetId: app.adoptionPetId,
          userId: app.userId,
          adoptionDate: dateOnly(nowInBusinessTz().date),
          feeAmount: fee,
        },
      });

      const competing = await tx.adoptionApplication.findMany({
        where: { adoptionPetId: app.adoptionPetId, status: { in: OPEN }, NOT: { id } },
        include: withParties,
      });
      await tx.adoptionApplication.updateMany({
        where: { id: { in: competing.map((c) => c.id) } },
        data: {
          status: 'rejected',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          adminNote: 'Another applicant was approved for this pet',
        },
      });
      return competing;
    });

    notifyStatus(app, 'approved', adminNote, fee);
    for (const other of others) {
      notifyStatus(other, 'rejected', 'Another applicant was approved for this pet');
    }
    return all.getById(id);
  },
};
