import { prisma } from '@/lib/prisma';
import {
  SETTING_DEFINITIONS,
  type SettingKey,
  type SettingValue,
} from '@/shared/constants/settings';

const TTL_MS = 60 * 1000;
let cache: { values: Map<string, unknown>; expiresAt: number } | null = null;

const load = async () => {
  if (cache && cache.expiresAt > Date.now()) return cache.values;
  const rows = await prisma.setting.findMany({ select: { key: true, value: true } });
  cache = { values: new Map(rows.map((r) => [r.key, r.value])), expiresAt: Date.now() + TTL_MS };
  return cache.values;
};

/**
 * Typed access to the `settings` table with a short in-memory cache.
 * Falls back to the default from SETTING_DEFINITIONS when a row is missing or invalid.
 */
export const settingsService = {
  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const def = SETTING_DEFINITIONS[key];
    const values = await load();
    const parsed = def.schema.safeParse(values.get(key));
    return (parsed.success ? parsed.data : def.default) as SettingValue<K>;
  },

  /** Numeric settings (rates, minutes, hours …) */
  async getNumber(key: SettingKey): Promise<number> {
    return Number(await settingsService.get(key));
  },

  invalidate() {
    cache = null;
  },
};
