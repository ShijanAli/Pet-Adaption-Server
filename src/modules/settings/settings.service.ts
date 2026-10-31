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
    // a setting added in a newer release works before `db:seed` has run: its default is served
    const defaults = Object.entries(SETTING_DEFINITIONS)
      .filter(([, def]) => def.isPublic)
      .map(([key, def]) => [key, def.default] as const);
    return {
      ...Object.fromEntries(defaults),
      ...Object.fromEntries(rows.map((r) => [r.key, r.value])),
    };
  },

  async getAll(group?: string) {
    const rows = (
      await prisma.setting.findMany({
        where: group ? { group } : undefined,
        orderBy: [{ group: 'asc' }, { key: 'asc' }],
      })
    )
      // "__"-prefixed rows are internal (e.g. the demo seeder's manifest). Filtered here, not in SQL:
      // Prisma's startsWith becomes LIKE, where "_" is a wildcard.
      .filter((r) => !r.key.startsWith('__'));
    const stored = new Set(rows.map((r) => r.key));
    // definitions without a row yet (new setting, seed not run) still show up with their default
    const missing = Object.entries(SETTING_DEFINITIONS)
      .filter(([key, def]) => !stored.has(key) && (!group || def.group === group))
      .map(([key, def]) => ({
        id: null,
        key,
        value: def.default,
        group: def.group,
        isPublic: def.isPublic,
        createdAt: null,
        updatedAt: null,
      }));
    return [...rows, ...missing].map((r) => ({ ...r, ...describe(r.key) }));
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
