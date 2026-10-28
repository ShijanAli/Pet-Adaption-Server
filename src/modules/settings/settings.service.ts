import { prisma } from '@/lib/prisma';
import { AppError, type ErrorDetail } from '@/shared/errors/AppError';
import { isSettingKey, SETTING_DEFINITIONS } from '@/shared/constants/settings';
import { settingsService } from '@/shared/services/settings.service';

const describe = (key: string) => {
  const def = isSettingKey(key) ? SETTING_DEFINITIONS[key] : undefined;
  return {
    description: def?.description ?? null,
    readonly: Boolean(def && 'readonly' in def && def.readonly),
  };
};

export const SettingService = {
  /** `{ site_name: '…', usd_exchange_rate: 122, … }` — safe for the public site */
  async getPublic() {
    const rows = await prisma.setting.findMany({
      where: { isPublic: true },
      orderBy: { key: 'asc' },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  async getAll(group?: string) {
    const rows = await prisma.setting.findMany({
      where: group ? { group } : undefined,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    return rows.map((r) => ({ ...r, ...describe(r.key) }));
  },

  /** Validates every value against its definition, then saves them all or nothing */
  async update(values: Record<string, unknown>) {
    const errors: ErrorDetail[] = [];
    const clean: [string, unknown][] = [];

    for (const [key, value] of Object.entries(values)) {
      if (!isSettingKey(key)) {
        errors.push({ path: `values.${key}`, message: 'Unknown setting' });
        continue;
      }
      const def = SETTING_DEFINITIONS[key];
      if ('readonly' in def && def.readonly) {
        errors.push({ path: `values.${key}`, message: 'This setting is read-only' });
        continue;
      }
      const parsed = def.schema.safeParse(value);
      if (!parsed.success) {
        errors.push({
          path: `values.${key}`,
          message: parsed.error.issues[0]?.message ?? 'Invalid value',
        });
        continue;
      }
      clean.push([key, parsed.data]);
    }
    if (errors.length) throw AppError.unprocessable('Some settings are invalid', errors);

    await prisma.$transaction(
      clean.map(([key, value]) => {
        const def = SETTING_DEFINITIONS[key as keyof typeof SETTING_DEFINITIONS];
        return prisma.setting.upsert({
          where: { key },
          update: { value: value as object },
          create: { key, value: value as object, group: def.group, isPublic: def.isPublic },
        });
      }),
    );
    settingsService.invalidate();
    return SettingService.getAll();
  },
};
