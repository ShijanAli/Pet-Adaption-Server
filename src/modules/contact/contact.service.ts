import type { ContactStatus } from '@generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { createCrudService } from '@/shared/crud/crud.factory';
import { emailService } from '@/shared/services/email.service';
import { settingsService } from '@/shared/services/settings.service';
import type { ContactInput, ContactListQuery } from './contact.validation';

const crud = createCrudService({
  delegate: () => prisma.contactMessage,
  entityName: 'Message',
  queryConfig: {
    searchableFields: ['name', 'email', 'subject', 'message'],
    filterableFields: ['status'],
  },
});

export const ContactService = {
  async create(input: ContactInput) {
    const message = await prisma.contactMessage.create({ data: input });
    const adminEmail = await settingsService.get('admin_notification_email');
    emailService.queue({ email: adminEmail }, 'CONTACT_RECEIVED', input);
    return { id: message.id };
  },

  getAll: (query: ContactListQuery) => crud.getAll(query),

  /** Opening a new message marks it as read */
  async getById(id: number) {
    await crud.getById(id); // 404 when missing
    await prisma.contactMessage.updateMany({
      where: { id, status: 'new' },
      data: { status: 'read' },
    });
    return crud.getById(id);
  },

  updateStatus: (id: number, status: ContactStatus) => crud.update(id, { status }),

  remove: crud.remove,
};
