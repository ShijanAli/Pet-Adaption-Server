import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { API, api, bearer, createAndLogin, loginAsSuperAdmin } from '../helpers';

let admin: string;
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

beforeAll(async () => {
  admin = (await loginAsSuperAdmin()).accessToken;
});

const newCategory = async (body: Record<string, unknown> = {}) =>
  (
    await api()
      .post(`${API}/blog/categories`)
      .set(bearer(admin))
      .send({ name: `Care ${stamp()}`, ...body })
      .expect(201)
  ).body.data;

const newPost = (body: Record<string, unknown>) =>
  api()
    .post(`${API}/blog/posts`)
    .set(bearer(admin))
    .send({
      title: `Post ${stamp()}`,
      content: 'Brush your dog twice a week to keep the coat healthy and shiny.',
      ...body,
    });

describe('Blog', () => {
  it('shows only published posts whose time has come, without content in lists', async () => {
    const category = await newCategory();
    const published = (await newPost({ categoryId: category.id, status: 'published' }).expect(201))
      .body.data;
    const draft = (await newPost({ categoryId: category.id }).expect(201)).body.data;
    const scheduled = (
      await newPost({
        categoryId: category.id,
        status: 'published',
        publishedAt: new Date(Date.now() + 86_400_000).toISOString(),
      }).expect(201)
    ).body.data;

    expect(published.publishedAt).not.toBeNull();
    expect(published.author.firstName).toBe('Super');
    expect(draft.publishedAt).toBeNull();

    const list = await api()
      .get(`${API}/blog/posts`)
      .query({ category: category.slug })
      .expect(200);
    expect(list.body.data.map((p: { id: number }) => p.id)).toEqual([published.id]);
    expect(list.body.data[0].content).toBeUndefined();

    const detail = await api().get(`${API}/blog/posts/${published.slug}`).expect(200);
    expect(detail.body.data).toMatchObject({
      readingTimeMinutes: 1,
      category: { slug: category.slug },
    });
    await api().get(`${API}/blog/posts/${draft.slug}`).expect(404);
    await api().get(`${API}/blog/posts/${scheduled.slug}`).expect(404);

    const adm = await api()
      .get(`${API}/blog/posts`)
      .query({ category: category.slug })
      .set(bearer(admin))
      .expect(200);
    expect(adm.body.meta.total).toBe(3);

    // publishing a draft stamps publishedAt
    const live = await api()
      .patch(`${API}/blog/posts/${draft.id}`)
      .set(bearer(admin))
      .send({ status: 'published' })
      .expect(200);
    expect(live.body.data.publishedAt).not.toBeNull();
  });

  it('hides posts of inactive categories and protects categories with posts', async () => {
    const category = await newCategory();
    const post = (await newPost({ categoryId: category.id, status: 'published' }).expect(201)).body
      .data;

    await api()
      .patch(`${API}/blog/categories/${category.id}`)
      .set(bearer(admin))
      .send({ status: 'inactive' })
      .expect(200);
    await api().get(`${API}/blog/posts/${post.slug}`).expect(404);
    await api().get(`${API}/blog/categories/${category.slug}`).expect(404);

    await api().delete(`${API}/blog/categories/${category.id}`).set(bearer(admin)).expect(409);
    await api().delete(`${API}/blog/posts/${post.id}`).set(bearer(admin)).expect(200);
    await api().delete(`${API}/blog/categories/${category.id}`).set(bearer(admin)).expect(409); // soft-deleted post still references it
  });

  it('customers cannot write posts', async () => {
    const { accessToken } = await createAndLogin();
    await api().post(`${API}/blog/posts`).set(bearer(accessToken)).send({}).expect(403);
  });
});

describe('FAQs & testimonials', () => {
  it('groups active FAQs by category for the FAQ page', async () => {
    const cat = `cat${stamp()}`;
    for (const [question, sortOrder] of [
      ['How do I adopt a pet?', 2],
      ['Is there an adoption fee?', 1],
    ] as const) {
      await api()
        .post(`${API}/faqs`)
        .set(bearer(admin))
        .send({ question, answer: 'See our adoption page.', category: cat, sortOrder })
        .expect(201);
    }
    await api()
      .post(`${API}/faqs`)
      .set(bearer(admin))
      .send({ question: 'Hidden question?', answer: 'Nope', category: cat, status: 'inactive' })
      .expect(201);

    const res = await api().get(`${API}/faqs`).query({ grouped: true, category: cat }).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].faqs.map((f: { question: string }) => f.question)).toEqual([
      'Is there an adoption fee?',
      'How do I adopt a pet?',
    ]);
    expect(res.body.meta).toBeUndefined();

    const paged = await api()
      .get(`${API}/faqs`)
      .query({ category: cat })
      .set(bearer(admin))
      .expect(200);
    expect(paged.body.meta.total).toBe(3);
  });

  it('lists featured testimonials and validates links', async () => {
    const name = `Rina ${stamp()}`;
    await api()
      .post(`${API}/testimonials`)
      .set(bearer(admin))
      .send({ name, content: 'Adopting Milo changed our family!', isFeatured: true })
      .expect(201);
    await api()
      .post(`${API}/testimonials`)
      .set(bearer(admin))
      .send({ name: 'Ghost', content: 'This adoption does not exist.', adoptionId: 999999 })
      .expect(400);

    const res = await api()
      .get(`${API}/testimonials`)
      .query({ isFeatured: true, searchTerm: name })
      .expect(200);
    expect(res.body.data[0]).toMatchObject({ name, rating: 5 });
  });
});

describe('Contact & newsletter', () => {
  it('stores contact messages, emails the admin and marks them read when opened', async () => {
    const { emailOutbox } = await import('@/shared/services/email.service');
    const subject = `Grooming question ${stamp()}`;
    const res = await api()
      .post(`${API}/contact`)
      .send({
        name: 'Karim',
        email: 'karim@test.com',
        subject,
        message: 'Do you groom large dogs on Fridays?',
      })
      .expect(201);

    await new Promise((r) => setTimeout(r, 20));
    expect(
      emailOutbox.some(
        (m) =>
          m.template === 'CONTACT_RECEIVED' &&
          m.to.email === 'admin@petadoption.com' &&
          m.subject.includes(subject),
      ),
    ).toBe(true);

    const opened = await api()
      .get(`${API}/contact/${res.body.data.id}`)
      .set(bearer(admin))
      .expect(200);
    expect(opened.body.data.status).toBe('read');

    const { accessToken } = await createAndLogin();
    await api().get(`${API}/contact`).set(bearer(accessToken)).expect(403);
  });

  it('subscribes idempotently and unsubscribes only with the signed link', async () => {
    const { emailOutbox } = await import('@/shared/services/email.service');
    const email = `news.${stamp()}@test.com`;

    await api().post(`${API}/newsletter/subscribe`).send({ email }).expect(200);
    await api().post(`${API}/newsletter/subscribe`).send({ email }).expect(200);
    await new Promise((r) => setTimeout(r, 20));
    const welcomes = emailOutbox.filter(
      (m) => m.to.email === email && m.template === 'NEWSLETTER_WELCOME',
    );
    expect(welcomes).toHaveLength(1);

    const link = new URL(
      welcomes[0].html.match(/href="([^"]+unsubscribe[^"]+)"/)![1].replace(/&amp;/g, '&'),
    );
    await api()
      .post(`${API}/newsletter/unsubscribe`)
      .send({ email, token: 'x'.repeat(40) })
      .expect(400);
    await api()
      .post(`${API}/newsletter/unsubscribe`)
      .send({ email, token: link.searchParams.get('token') })
      .expect(200);
    expect((await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).status).toBe(
      'unsubscribed',
    );

    const csv = await api()
      .get(`${API}/newsletter/subscribers/export?status=unsubscribed`)
      .set(bearer(admin))
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(`"${email}"`);
  });
});
