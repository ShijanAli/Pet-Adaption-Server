import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { SettingController } from './settings.controller';
import { SettingValidation } from './settings.validation';

const r = createModuleRouter('/settings', 'Settings', 'Site configuration (typed key/value)');

r.get(
  '/public',
  { summary: 'Public settings as a key → value object', access: 'public' },
  SettingController.getPublic,
);

r.get(
  '/',
  {
    summary: 'All settings with descriptions',
    access: { permissions: [P.SETTING.VIEW] },
    query: SettingValidation.listQuery,
  },
  SettingController.getAll,
);

r.patch(
  '/',
  {
    summary: 'Update settings',
    description:
      'Send only the keys you change: `{ "values": { "usd_exchange_rate": 121.5, "booking_cancel_before_hours": 12 } }`. ' +
      'Every value is validated; nothing is saved if one is invalid.',
    access: { permissions: [P.SETTING.UPDATE] },
    body: SettingValidation.update,
  },
  SettingController.update,
);

export const settingRoutes = r;
