import { z } from 'zod';

type Definition<T extends z.ZodType> = {
  schema: T;
  default: z.infer<T>;
  group: 'general' | 'payment' | 'booking' | 'notification';
  /** exposed through GET /settings/public */
  isPublic: boolean;
  /** cannot be changed through the API */
  readonly?: boolean;
  description: string;
};

const define = <T extends z.ZodType>(d: Definition<T>) => d;

/**
 * Every setting the app understands — single source of truth for
 * defaults (seed), validation (PATCH /settings) and typed reads (settingsService).
 */
export const SETTING_DEFINITIONS = {
  site_name: define({
    schema: z.string().trim().min(1).max(100),
    default: 'Pet Adoption',
    group: 'general',
    isPublic: true,
    description: 'Shown in the header, emails and page titles',
  }),
  contact_email: define({
    schema: z.email(),
    default: 'support@petadoption.com',
    group: 'general',
    isPublic: true,
    description: 'Public support email',
  }),
  contact_phone: define({
    schema: z.string().trim().max(30),
    default: '+8801000000000',
    group: 'general',
    isPublic: true,
    description: 'Public phone number',
  }),
  contact_address: define({
    schema: z.string().trim().max(255),
    default: 'Dhaka, Bangladesh',
    group: 'general',
    isPublic: true,
    description: 'Shop address',
  }),
  social_links: define({
    schema: z
      .object({ facebook: z.url(), instagram: z.url(), youtube: z.url(), tiktok: z.url() })
      .partial()
      .strict(),
    default: {},
    group: 'general',
    isPublic: true,
    description: 'Social media profile URLs',
  }),
  base_currency: define({
    schema: z.literal('BDT'),
    default: 'BDT',
    group: 'payment',
    isPublic: true,
    readonly: true,
    description: 'Prices are stored in this currency',
  }),
  supported_currencies: define({
    schema: z.array(z.enum(['BDT', 'USD'])),
    default: ['BDT', 'USD'],
    group: 'payment',
    isPublic: true,
    readonly: true,
    description: 'Currencies customers can pay with',
  }),
  usd_exchange_rate: define({
    schema: z.number().positive().max(10_000),
    default: 122,
    group: 'payment',
    isPublic: true,
    description: '1 USD = x BDT (used for USD payments)',
  }),
  booking_slot_interval_minutes: define({
    schema: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
    default: 30,
    group: 'booking',
    isPublic: false,
    description: 'Gap between bookable start times',
  }),
  booking_cancel_before_hours: define({
    schema: z.number().int().min(0).max(720),
    default: 24,
    group: 'booking',
    isPublic: true,
    description: 'Customers can cancel until this many hours before the start',
  }),
  booking_advance_days: define({
    schema: z.number().int().min(1).max(365),
    default: 30,
    group: 'booking',
    isPublic: true,
    description: 'How many days ahead customers can book',
  }),
  booking_payment_timeout_minutes: define({
    schema: z.number().int().min(0).max(1440),
    default: 30,
    group: 'booking',
    isPublic: true,
    description: 'Unpaid pending bookings are cancelled after this many minutes (0 = never)',
  }),
  admin_notification_email: define({
    schema: z.email(),
    default: 'admin@petadoption.com',
    group: 'notification',
    isPublic: false,
    description: 'Receives contact form messages',
  }),
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_DEFINITIONS)[K]['schema']>;

export const isSettingKey = (key: string): key is SettingKey => key in SETTING_DEFINITIONS;
