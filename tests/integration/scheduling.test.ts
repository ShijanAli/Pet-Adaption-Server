import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { dateOnly } from '@/shared/utils/time';
import { API, api, bearer, createAndLogin, createUser, loginAsSuperAdmin } from '../helpers';
import { createBooking, createService, daysFromToday, setSchedule } from '../helpers/fixtures';

let admin: string;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

const slotsFor = async (serviceId: number, date: string, query: Record<string, unknown> = {}) =>
  (
    await api()
      .get(`${API}/services/${serviceId}/availability`)
      .query({ date, ...query })
      .expect(200)
  ).body.data;

const startTimes = (data: { slots: { startTime: string }[] }) => data.slots.map((s) => s.startTime);

describe('Staff schedules', () => {
  it('validates and replaces the weekly schedule', async () => {
    const staff = await createUser('staff');
    const url = `${API}/staff/${staff.id}/schedules`;

    await api()
      .put(url)
      .set(bearer(admin))
      .send({ schedules: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }] })
      .expect(422);
    await api()
      .put(url)
      .set(bearer(admin))
      .send({
        schedules: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 1, startTime: '10:00', endTime: '12:00' },
        ],
      })
      .expect(422);
    await api()
      .put(url)
      .set(bearer(admin))
      .send({ schedules: [{ dayOfWeek: 1, startTime: '9:00', endTime: '17:00' }] })
      .expect(422);

    const ok = await api()
      .put(url)
      .set(bearer(admin))
      .send({
        schedules: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '10:00', endTime: '14:00' },
        ],
      })
      .expect(200);
    expect(ok.body.data.schedules.map((s: { dayOfWeek: number }) => s.dayOfWeek)).toEqual([0, 2]);

    // staff can read their own schedule
    const { accessToken } = await createAndLogin('staff');
    await api().get(`${API}/staff/me/schedule`).set(bearer(accessToken)).expect(200);
  });

  it('cannot set a schedule for a customer', async () => {
    const customer = await createUser('customer');
    await api()
      .put(`${API}/staff/${customer.id}/schedules`)
      .set(bearer(admin))
      .send({ schedules: [] })
      .expect(404);
  });
});

describe('Blocked dates', () => {
  it('rejects past and duplicate dates', async () => {
    const staff = await createUser('staff');
    await api()
      .post(`${API}/blocked-dates`)
      .set(bearer(admin))
      .send({ staffId: staff.id, date: '2020-01-01' })
      .expect(422);

    const date = daysFromToday(10);
    await api()
      .post(`${API}/blocked-dates`)
      .set(bearer(admin))
      .send({ staffId: staff.id, date, reason: 'Leave' })
      .expect(201);
    await api()
      .post(`${API}/blocked-dates`)
      .set(bearer(admin))
      .send({ staffId: staff.id, date })
      .expect(409);

    const list = await api()
      .get(`${API}/blocked-dates`)
      .query({ staffId: staff.id, from: date, to: date })
      .set(bearer(admin))
      .expect(200);
    expect(list.body.meta.total).toBe(1);
  });
});

describe('Availability', () => {
  it('builds slots from the schedule, duration and slot interval', async () => {
    const date = daysFromToday(3);
    const staff = await createUser('staff');
    await setSchedule(staff.id, date, '09:00', '12:00');
    const service = await createService({ durationMinutes: 60, staffIds: [staff.id] });

    const data = await slotsFor(service.id, date);
    expect(data.closed).toBe(false);
    expect(startTimes(data)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(data.slots[0]).toMatchObject({ endTime: '10:00', staff: [{ id: staff.id }] });
  });

  it('removes slots that overlap open bookings (cancelled ones free the slot)', async () => {
    const date = daysFromToday(3);
    const staff = await createUser('staff');
    const customer = await createUser('customer');
    await setSchedule(staff.id, date, '09:00', '12:00');
    const service = await createService({ durationMinutes: 60, staffIds: [staff.id] });

    await createBooking({
      userId: customer.id,
      serviceId: service.id,
      staffId: staff.id,
      date,
      startTime: '10:00',
    });
    await createBooking({
      userId: customer.id,
      serviceId: service.id,
      staffId: staff.id,
      date,
      startTime: '09:00',
      status: 'cancelled',
    });

    expect(startTimes(await slotsFor(service.id, date))).toEqual(['09:00', '11:00']);
  });

  it('merges staff per slot and respects staff days off', async () => {
    const date = daysFromToday(3);
    const a = await createUser('staff');
    const b = await createUser('staff');
    await setSchedule(a.id, date, '09:00', '10:00');
    await setSchedule(b.id, date, '09:00', '11:00');
    const service = await createService({ durationMinutes: 60, staffIds: [a.id, b.id] });

    const data = await slotsFor(service.id, date);
    expect(data.slots).toHaveLength(3);
    expect(data.slots[0].staff.map((s: { id: number }) => s.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );

    expect(startTimes(await slotsFor(service.id, date, { staffId: a.id }))).toEqual(['09:00']);

    await prisma.blockedDate.create({ data: { staffId: b.id, date: dateOnly(date) } });
    const afterLeave = await slotsFor(service.id, date);
    expect(
      afterLeave.slots.flatMap((s: { staff: { id: number }[] }) => s.staff.map((x) => x.id)),
    ).not.toContain(b.id);
  });

  it('returns closed when the whole business is blocked', async () => {
    const date = daysFromToday(4);
    const staff = await createUser('staff');
    await setSchedule(staff.id, date, '09:00', '12:00');
    const service = await createService({ staffIds: [staff.id] });

    await api()
      .post(`${API}/blocked-dates`)
      .set(bearer(admin))
      .send({ date, reason: 'Eid holiday' })
      .expect(201);

    const data = await slotsFor(service.id, date);
    expect(data).toMatchObject({ closed: true, reason: 'Eid holiday', slots: [] });
  });

  it('rejects past dates, too-far dates and inactive services', async () => {
    const service = await createService();
    await api().get(`${API}/services/${service.id}/availability?date=2020-01-01`).expect(400);
    await api()
      .get(`${API}/services/${service.id}/availability?date=${daysFromToday(400)}`)
      .expect(400);
    await api().get(`${API}/services/${service.id}/availability?date=bad`).expect(422);

    const inactive = await createService({ status: 'inactive' });
    await api()
      .get(`${API}/services/${inactive.id}/availability?date=${daysFromToday(1)}`)
      .expect(404);
  });
});
