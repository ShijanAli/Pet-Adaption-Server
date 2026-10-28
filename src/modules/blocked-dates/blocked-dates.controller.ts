import { createCrudController } from '@/shared/crud/crud.factory';
import { BlockedDateService } from './blocked-dates.service';

export const BlockedDateController = createCrudController(BlockedDateService, {
  singular: 'Blocked date',
  plural: 'Blocked dates',
});
