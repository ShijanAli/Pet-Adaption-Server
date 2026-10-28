/** Prisma Decimal | number | string → number */
export const toNumber = (value: { toString(): string } | number | string | null | undefined) =>
  value == null ? 0 : Number(value.toString());

/** Round to 2 decimals without floating point surprises (1.005 → 1.01) */
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const sumBy = <T>(items: T[], pick: (item: T) => number) =>
  round2(items.reduce((total, item) => total + pick(item), 0));

export const formatMoney = (amount: number, currency: 'BDT' | 'USD' = 'BDT') =>
  currency === 'USD' ? `$${amount.toFixed(2)}` : `৳${amount.toFixed(2)}`;
