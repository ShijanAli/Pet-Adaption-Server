import { describe, expect, it } from 'vitest';
import {
  dayOfWeek,
  diffInDays,
  minutesToTime,
  nowInBusinessTz,
  rangesOverlap,
  timeToMinutes,
} from '@/shared/utils/time';

describe('time utils', () => {
  it('converts HH:mm ↔ minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('detects overlapping ranges (end is exclusive)', () => {
    expect(rangesOverlap(600, 660, 630, 690)).toBe(true);
    expect(rangesOverlap(600, 660, 660, 720)).toBe(false);
    expect(rangesOverlap(600, 720, 630, 660)).toBe(true);
  });

  it('computes weekday and day differences from date strings', () => {
    expect(dayOfWeek('2026-11-01')).toBe(0); // Sunday
    expect(diffInDays('2026-10-30', '2026-11-02')).toBe(3);
  });

  it('reads "now" in the business timezone (Asia/Dhaka = UTC+6)', () => {
    // 2026-10-27 20:30 UTC = 2026-10-28 02:30 in Dhaka
    expect(nowInBusinessTz(new Date('2026-10-27T20:30:00Z'))).toEqual({
      date: '2026-10-28',
      minutes: 150,
    });
  });
});
