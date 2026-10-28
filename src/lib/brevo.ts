import { BrevoClient } from '@getbrevo/brevo';
import { env } from '@/config/env';

export const brevo = env.BREVO_API_KEY
  ? new BrevoClient({ apiKey: env.BREVO_API_KEY, timeoutInSeconds: 15, maxRetries: 2 })
  : null;
