import { AppError } from '@/shared/errors/AppError';

type Countable = { count(args: { where: Record<string, unknown> }): Promise<unknown> };

/**
 * Throws 400 when any of the ids does not exist (optionally with extra conditions).
 * @example await assertIdsExist(prisma.petType, body.petTypeIds, 'pet type', { status: 'active' })
 */
export const assertIdsExist = async (
  delegate: Countable,
  ids: number[],
  entity: string,
  where: Record<string, unknown> = {},
) => {
  if (!ids.length) return;
  const found = Number(await delegate.count({ where: { ...where, id: { in: ids } } }));
  if (found !== ids.length) {
    throw AppError.badRequest(`One or more ${entity} ids are invalid or inactive`);
  }
};
