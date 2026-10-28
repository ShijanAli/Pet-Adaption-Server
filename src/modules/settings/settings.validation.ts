import { z } from 'zod';

export const SettingValidation = {
  listQuery: z.object({
    group: z.enum(['general', 'payment', 'booking', 'notification']).optional(),
  }),

  update: z.object({
    values: z
      .record(z.string(), z.unknown())
      .refine((v) => Object.keys(v).length > 0, 'Send at least one setting'),
  }),
};
