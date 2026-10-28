import { prisma } from '@/lib/prisma';
import { createCrudService } from '@/shared/crud/crud.factory';
import type { FaqListQuery } from './faqs.validation';

const crud = createCrudService({
  delegate: () => prisma.faq,
  entityName: 'FAQ',
  queryConfig: {
    searchableFields: ['question', 'answer'],
    filterableFields: ['category', 'status'],
  },
});

export const FaqService = {
  ...crud,

  async getAll({ grouped, ...query }: FaqListQuery, canManage: boolean) {
    const scoped = canManage ? query : { ...query, status: 'active' as const };
    if (!grouped) return crud.getAll(scoped);

    // FAQ page: every FAQ grouped by category
    const faqs = await prisma.faq.findMany({
      where: {
        ...(scoped.status && { status: scoped.status }),
        ...(scoped.category && { category: scoped.category }),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const groups = new Map<string, typeof faqs>();
    for (const faq of faqs) {
      const key = faq.category ?? 'general';
      groups.set(key, [...(groups.get(key) ?? []), faq]);
    }
    return {
      data: [...groups].map(([category, items]) => ({ category, faqs: items })),
      meta: undefined,
    };
  },

  getVisible: (id: number, canManage: boolean) =>
    crud.getOne({ id, ...(!canManage && { status: 'active' }) }),
};
