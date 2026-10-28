import { env } from '@/config/env';

/** "HH:mm" 24h */
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** "YYYY-MM-DD" */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** "2026-11-05" → Date at UTC midnight (how Prisma stores @db.Date) */
export const dateOnly = (date: string) => new Date(`${date}T00:00:00.000Z`);

/** Date → "2026-11-05" (UTC based, matches @db.Date values) */
export const toDateString = (date: Date) => date.toISOString().slice(0, 10);

/** 0 = Sunday … 6 = Saturday for a "YYYY-MM-DD" string */
export const dayOfWeek = (date: string) => dateOnly(date).getUTCDay();

/** Current date + minutes-since-midnight in the business timezone */
export const nowInBusinessTz = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
};

/** Days between two "YYYY-MM-DD" strings (b - a) */
export const diffInDays = (a: string, b: string) =>
  Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86_400_000);

/** [aStart, aEnd) overlaps [bStart, bEnd) — all in minutes */
export const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

/** Minutes from now (business timezone) until a "YYYY-MM-DD" + "HH:mm" moment (negative = past) */
export const minutesUntil = (date: string, time: string, now = nowInBusinessTz()) =>
  diffInDays(now.date, date) * 1440 + timeToMinutes(time) - now.minutes;

/** Offset (minutes) of the business timezone from UTC at a given instant */
const businessOffsetMinutes = (at: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.BUSINESS_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
};

/** "2026-11-01" (business timezone) → the UTC instant that day starts */
export const startOfBusinessDay = (date: string) => {
  const guess = dateOnly(date);
  return new Date(guess.getTime() - businessOffsetMinutes(guess) * 60_000);
};

/** "2026-11-15" → "2026-11-01" */
export const startOfMonthString = (date: string) => `${date.slice(0, 7)}-01`;

/** "2026-11-15" → "2026-10-01" */
export const previousMonthStart = (date: string) => {
  const d = dateOnly(startOfMonthString(date));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return toDateString(d);
};
