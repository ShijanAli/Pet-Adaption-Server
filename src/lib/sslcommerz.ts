import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { AppError } from '@/shared/errors/AppError';

/**
 * Minimal typed SSLCommerz v4 client (sandbox / live).
 * Docs: https://developer.sslcommerz.com/doc/v4/
 */
const BASE_URL = env.SSLCOMMERZ_IS_LIVE
  ? 'https://securepay.sslcommerz.com'
  : 'https://sandbox.sslcommerz.com';

export const isSslcommerzConfigured = () =>
  Boolean(env.SSLCOMMERZ_STORE_ID && env.SSLCOMMERZ_STORE_PASSWORD);

const credentials = () => {
  if (!isSslcommerzConfigured()) {
    throw AppError.serviceUnavailable('Online payment is not configured on the server');
  }
  return { store_id: env.SSLCOMMERZ_STORE_ID!, store_passwd: env.SSLCOMMERZ_STORE_PASSWORD! };
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    logger.error({ status: res.status, path }, 'SSLCommerz HTTP error');
    throw new AppError(502, 'Payment gateway is not responding, please try again');
  }
  return (await res.json()) as T;
};

export type InitSessionInput = {
  tranId: string;
  amount: number;
  currency: 'BDT' | 'USD';
  productName: string;
  productCategory: string;
  customer: { name: string; email: string; phone?: string | null; address?: string | null };
  /** Echoed back by SSLCommerz in callbacks */
  valueA?: string;
};

export type InitSessionResponse = {
  status: 'SUCCESS' | 'FAILED';
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
};

export type ValidationResponse = {
  status: 'VALID' | 'VALIDATED' | 'INVALID_TRANSACTION' | string;
  tran_id: string;
  val_id: string;
  amount: string;
  store_amount?: string;
  currency: string;
  bank_tran_id?: string;
  card_type?: string;
  currency_type?: string;
  currency_amount?: string;
  risk_level?: string;
  [key: string]: unknown;
};

export type RefundResponse = {
  APIConnect: string;
  status?: 'success' | 'failed' | 'processing' | string;
  refund_ref_id?: string;
  errorReason?: string;
  [key: string]: unknown;
};

const callbackUrl = (path: string) =>
  `${env.SERVER_URL}${env.API_PREFIX}/payments/sslcommerz/${path}`;

export const sslcommerz = {
  /** Creates a checkout session and returns the hosted payment page URL */
  async initSession(input: InitSessionInput) {
    const body = new URLSearchParams({
      ...credentials(),
      total_amount: input.amount.toFixed(2),
      currency: input.currency,
      tran_id: input.tranId,
      success_url: callbackUrl('success'),
      fail_url: callbackUrl('fail'),
      cancel_url: callbackUrl('cancel'),
      ipn_url: callbackUrl('ipn'),
      shipping_method: 'NO',
      num_of_item: '1',
      product_name: input.productName.slice(0, 255),
      product_category: input.productCategory,
      product_profile: 'non-physical-goods',
      cus_name: input.customer.name,
      cus_email: input.customer.email,
      cus_phone: input.customer.phone || '01700000000',
      cus_add1: input.customer.address || 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      value_a: input.valueA ?? '',
    });

    const data = await request<InitSessionResponse>('/gwprocess/v4/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      logger.error({ reason: data.failedreason }, 'SSLCommerz session failed');
      throw new AppError(502, `Payment gateway error: ${data.failedreason ?? 'unknown error'}`);
    }
    return { gatewayUrl: data.GatewayPageURL, sessionKey: data.sessionkey, raw: data };
  },

  /** Server-side verification of a payment (never trust the browser callback alone) */
  async validate(valId: string) {
    const { store_id, store_passwd } = credentials();
    const qs = new URLSearchParams({
      val_id: valId,
      store_id,
      store_passwd,
      v: '1',
      format: 'json',
    });
    return request<ValidationResponse>(`/validator/api/validationserverAPI.php?${qs}`);
  },

  async refund(input: { bankTranId: string; amount: number; remarks: string; refId: string }) {
    const { store_id, store_passwd } = credentials();
    const qs = new URLSearchParams({
      bank_tran_id: input.bankTranId,
      refund_amount: input.amount.toFixed(2),
      refund_remarks: input.remarks.slice(0, 255),
      refe_id: input.refId,
      store_id,
      store_passwd,
      v: '1',
      format: 'json',
    });
    return request<RefundResponse>(`/validator/api/merchantTransIDvalidationAPI.php?${qs}`);
  },
};
