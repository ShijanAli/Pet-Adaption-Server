import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadClient = async () => {
  vi.resetModules();
  vi.stubEnv('SSLCOMMERZ_STORE_ID', 'teststore');
  vi.stubEnv('SSLCOMMERZ_STORE_PASSWORD', 'secret@ssl');
  return import('@/lib/sslcommerz');
};

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe('SSLCommerz client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('creates a session with a form-encoded request to the sandbox', async () => {
    const { sslcommerz } = await loadClient();
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'SUCCESS',
        GatewayPageURL: 'https://sandbox.sslcommerz.com/pay',
        sessionkey: 'S1',
      }),
    );

    const res = await sslcommerz.initSession({
      tranId: 'TXN-1',
      amount: 1000,
      currency: 'BDT',
      productName: 'Grooming',
      productCategory: 'pet-care-service',
      customer: { name: 'Rahim', email: 'r@test.com' },
    });

    expect(res.gatewayUrl).toBe('https://sandbox.sslcommerz.com/pay');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.sslcommerz.com/gwprocess/v4/api.php');
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get('store_id')).toBe('teststore');
    expect(body.get('total_amount')).toBe('1000.00');
    expect(body.get('success_url')).toBe(
      'http://localhost:5000/api/v1/payments/sslcommerz/success',
    );
    expect(body.get('ipn_url')).toBe('http://localhost:5000/api/v1/payments/sslcommerz/ipn');
  });

  it('turns a failed session into a 502', async () => {
    const { sslcommerz } = await loadClient();
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'FAILED', failedreason: 'Store Credential Error' }),
    );
    await expect(
      sslcommerz.initSession({
        tranId: 'T',
        amount: 10,
        currency: 'BDT',
        productName: 'x',
        productCategory: 'x',
        customer: { name: 'a', email: 'a@b.com' },
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: expect.stringContaining('Store Credential Error'),
    });
  });

  it('URL-encodes validation and refund parameters', async () => {
    const { sslcommerz } = await loadClient();
    fetchMock.mockResolvedValue(jsonResponse({ status: 'VALID', APIConnect: 'DONE' }));

    await sslcommerz.validate('VAL 1');
    expect(fetchMock.mock.calls[0][0]).toContain(
      'val_id=VAL+1&store_id=teststore&store_passwd=secret%40ssl',
    );

    await sslcommerz.refund({
      bankTranId: 'B1',
      amount: 50,
      remarks: 'Customer & request',
      refId: 'RF1',
    });
    expect(fetchMock.mock.calls[1][0]).toContain('refund_remarks=Customer+%26+request');
  });

  it('refuses to run without credentials', async () => {
    vi.resetModules();
    vi.stubEnv('SSLCOMMERZ_STORE_ID', '');
    vi.stubEnv('SSLCOMMERZ_STORE_PASSWORD', '');
    const { sslcommerz } = await import('@/lib/sslcommerz');
    await expect(sslcommerz.validate('x')).rejects.toMatchObject({ statusCode: 503 });
  });
});
