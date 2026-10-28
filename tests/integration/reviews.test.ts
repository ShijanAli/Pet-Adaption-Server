import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { API, api, bearer, createAndLogin, loginAsSuperAdmin } from '../helpers';
import { createBooking, createService, daysFromToday } from '../helpers/fixtures';

let admin: string;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

/** A customer with a completed booking for `serviceId` */
const completedBooking = async (
  serviceId: number,
  status: 'completed' | 'confirmed' = 'completed',
) => {
  const session = await createAndLogin();
  const booking = await createBooking({
    userId: session.user.id,
    serviceId,
    date: daysFromToday(1),
    startTime: '10:00',
    status,
  });
  return { ...session, booking };
};

const write = (token: string, body: Record<string, unknown>) =>
  api().post(`${API}/reviews`).set(bearer(token)).send(body);

const moderate = (id: number, status: string) =>
  api().patch(`${API}/reviews/${id}/status`).set(bearer(admin)).send({ status });

describe('Writing reviews', () => {
  it('only allows one review per completed booking of your own', async () => {
    const service = await createService();
    const { accessToken, booking } = await completedBooking(service.id);
    const stranger = await createAndLogin();

    await write(stranger.accessToken, { bookingId: booking.id, rating: 5 }).expect(404);
    await write(accessToken, { bookingId: booking.id, rating: 6 }).expect(422);

    const res = await write(accessToken, {
      bookingId: booking.id,
      rating: 5,
      title: 'Super gentle groomer',
      comment: 'Tommy came back happy and fluffy.',
      images: ['https://res.cloudinary.com/demo/image/upload/reviews/1.jpg'],
    }).expect(201);
    expect(res.body.data).toMatchObject({
      status: 'pending',
      rating: 5,
      service: { id: service.id },
    });
    expect(res.body.data.images).toHaveLength(1);

    await write(accessToken, { bookingId: booking.id, rating: 4 }).expect(409);

    const open = await completedBooking(service.id, 'confirmed');
    await write(open.accessToken, { bookingId: open.booking.id, rating: 4 }).expect(400);
  });

  it('pending / rejected reviews can be edited (re-moderated), approved ones cannot', async () => {
    const service = await createService();
    const { accessToken, booking } = await completedBooking(service.id);
    const { id } = (await write(accessToken, { bookingId: booking.id, rating: 2 }).expect(201)).body
      .data;

    await moderate(id, 'rejected').expect(200);
    const edited = await api()
      .patch(`${API}/me/reviews/${id}`)
      .set(bearer(accessToken))
      .send({ rating: 4, comment: 'Edited' })
      .expect(200);
    expect(edited.body.data).toMatchObject({ status: 'pending', rating: 4 });

    await moderate(id, 'approved').expect(200);
    await api()
      .patch(`${API}/me/reviews/${id}`)
      .set(bearer(accessToken))
      .send({ rating: 1 })
      .expect(400);

    const other = await createAndLogin();
    await api().delete(`${API}/me/reviews/${id}`).set(bearer(other.accessToken)).expect(404);
  });
});

describe('Moderation & ratings', () => {
  it('only approved reviews count towards the rating and are public', async () => {
    const service = await createService();
    const reviews = [];
    for (const rating of [5, 4, 2]) {
      const { accessToken, booking } = await completedBooking(service.id);
      reviews.push(
        (await write(accessToken, { bookingId: booking.id, rating }).expect(201)).body.data,
      );
    }

    // nothing public yet
    expect(
      (await api().get(`${API}/services/${service.slug}/reviews`).expect(200)).body.meta.total,
    ).toBe(0);

    await moderate(reviews[0].id, 'approved').expect(200);
    await moderate(reviews[1].id, 'approved').expect(200);
    await moderate(reviews[2].id, 'rejected').expect(200);

    const stored = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(Number(stored.avgRating)).toBe(4.5);
    expect(stored.reviewsCount).toBe(2);

    const list = await api()
      .get(`${API}/services/${service.slug}/reviews?sortBy=rating&sortOrder=asc`)
      .expect(200);
    expect(list.body.data.map((r: { rating: number }) => r.rating)).toEqual([4, 5]);
    expect(list.body.data[0].user).toEqual({ firstName: 'Test', profilePhoto: null }); // no email leaked

    const summary = await api().get(`${API}/services/${service.id}/rating-summary`).expect(200);
    expect(summary.body.data).toEqual({
      serviceId: service.id,
      averageRating: 4.5,
      totalReviews: 2,
      breakdown: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });

    // un-approving / deleting recalculates
    await moderate(reviews[0].id, 'rejected').expect(200);
    expect(
      Number((await prisma.service.findUniqueOrThrow({ where: { id: service.id } })).avgRating),
    ).toBe(4);
    await api().delete(`${API}/reviews/${reviews[1].id}`).set(bearer(admin)).expect(200);
    const after = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect([Number(after.avgRating), after.reviewsCount]).toEqual([0, 0]);
  });

  it('admins reply publicly; customers cannot moderate', async () => {
    const service = await createService();
    const { accessToken, booking } = await completedBooking(service.id);
    const { id } = (await write(accessToken, { bookingId: booking.id, rating: 3 }).expect(201)).body
      .data;

    await moderate(id, 'approved').expect(200);
    await api()
      .patch(`${API}/reviews/${id}/reply`)
      .set(bearer(admin))
      .send({ reply: 'Thanks, we will improve!' })
      .expect(200);

    const pub = await api().get(`${API}/services/${service.id}/reviews`).expect(200);
    expect(pub.body.data[0].adminReply).toBe('Thanks, we will improve!');

    await api()
      .patch(`${API}/reviews/${id}/status`)
      .set(bearer(accessToken))
      .send({ status: 'approved' })
      .expect(403);

    const queue = await api()
      .get(`${API}/reviews?status=approved&serviceId=${service.id}`)
      .set(bearer(admin))
      .expect(200);
    expect(queue.body.data[0].user.email).toBeDefined();
  });

  it('hides reviews of inactive services', async () => {
    const service = await createService({ status: 'inactive' });
    await api().get(`${API}/services/${service.id}/reviews`).expect(404);
  });
});
