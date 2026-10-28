import { z } from 'zod';
import { booleanQuery } from '@/shared/utils/validation';

export const PermissionValidation = {
  listQuery: z.object({
    module: z.string().trim().optional(),
    grouped: booleanQuery.describe('Group permissions by module'),
  }),
};

export type ListPermissionsQuery = z.infer<typeof PermissionValidation.listQuery>;
