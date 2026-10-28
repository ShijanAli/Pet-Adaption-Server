import { env } from '@/config/env';
import { brevo } from '@/lib/brevo';
import { logger } from '@/lib/logger';
import { emailTemplates, type EmailTemplateData, type EmailTemplateName } from '@/emails/templates';

type Recipient = { email: string; name?: string };

export type SentEmail = {
  to: Recipient;
  template: EmailTemplateName;
  subject: string;
  html: string;
};

/** In dry-run mode emails are kept here (handy for dev + tests). */
export const emailOutbox: SentEmail[] = [];

const send = async <T extends EmailTemplateName>(
  to: Recipient,
  template: T,
  data: EmailTemplateData<T>,
) => {
  const render = emailTemplates[template] as (d: EmailTemplateData<T>) => {
    subject: string;
    html: string;
  };
  const { subject, html } = render(data);

  if (env.EMAIL_DRY_RUN || !brevo) {
    emailOutbox.push({ to, template, subject, html });
    if (emailOutbox.length > 100) emailOutbox.shift();
    // log the action link so verification / reset can be tested locally without an inbox
    const link = html.match(/href="([^"]+)"/)?.[1];
    logger.info({ to: to.email, template, link }, '📧 [dry-run] email not sent');
    return;
  }

  await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
    to: [to],
    subject,
    htmlContent: html,
  });
};

export const emailService = {
  send,

  /**
   * Fire-and-forget: never blocks or fails the HTTP request.
   * Failures are logged; the user can always use "resend".
   */
  queue<T extends EmailTemplateName>(to: Recipient, template: T, data: EmailTemplateData<T>) {
    send(to, template, data).catch((err) =>
      logger.error({ err, to: to.email, template }, 'Failed to send email'),
    );
  },
};
