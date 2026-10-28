import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { TIME_REGEX, timeToMinutes } from '@/shared/utils/time';

const time = z.string().regex(TIME_REGEX, 'Use 24h HH:mm');

const scheduleItem = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6).describe('0 = Sunday … 6 = Saturday'),
    startTime: time,
    endTime: time,
    isActive: z.boolean().default(true),
  })
  .refine((s) => timeToMinutes(s.startTime) < timeToMinutes(s.endTime), {
    path: ['endTime'],
    message: 'End time must be after start time',
  });

export const StaffValidation = {
  listQuery: listQuerySchema(
    ['firstName', 'createdAt'] as const,
    {
      serviceId: z.coerce.number().int().positive().optional(),
    },
    { sortBy: 'firstName', sortOrder: 'asc' },
  ),

  setSchedules: z.object({
    schedules: z
      .array(scheduleItem)
      .max(7)
      .refine((items) => new Set(items.map((i) => i.dayOfWeek)).size === items.length, {
        message: 'Each day can appear only once',
      }),
  }),
};

export type ListStaffQuery = z.infer<typeof StaffValidation.listQuery>;
export type ScheduleInput = z.infer<typeof StaffValidation.setSchedules>['schedules'];
