import crypto from 'node:crypto';

/** "Dog Grooming & Spa!" → "dog-grooming-spa" */
export const slugify = (value: string) =>
  value
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Random URL-safe token (sent to the user) */
export const generateToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/** One-way hash for tokens stored in the DB */
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** Human friendly reference numbers: BK-20261027-4F9A2C */
export const generateReferenceNo = (prefix: string, date = new Date()) => {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
};

export const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

/** Picks only the given keys from an object (undefined values are dropped). */
export const pick = <T extends object, K extends keyof T>(obj: T, keys: readonly K[]) =>
  keys.reduce(
    (acc, key) => {
      if (obj[key] !== undefined) acc[key] = obj[key];
      return acc;
    },
    {} as Pick<T, K>,
  );

/** Deterministic signature for links that must not be guessable (e.g. newsletter unsubscribe) */
export const signValue = (value: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(value).digest('hex').slice(0, 40);

export const verifySignature = (value: string, signature: string, secret: string) => {
  const expected = Buffer.from(signValue(value, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};
