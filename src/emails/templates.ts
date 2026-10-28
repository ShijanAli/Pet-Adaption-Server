import { env } from '@/config/env';
import { button, detailsTable, escapeHtml, layout } from './layout';

type BookingSummary = {
  name: string;
  bookingNo: string;
  serviceName: string;
  petName: string;
  date: string;
  time: string;
  total: string;
};

const bookingRows = (d: BookingSummary): [string, string][] => [
  ['Booking no', d.bookingNo],
  ['Service', d.serviceName],
  ['Pet', d.petName],
  ['Date', d.date],
  ['Time', d.time],
  ['Total', d.total],
];

const APPLICATION_STATUS_TEXT: Record<string, string> = {
  under_review:
    'Our team is now reviewing your application. We may contact you for a short call or home visit.',
  approved:
    'Great news — your application has been approved! We will contact you to arrange the handover.',
  rejected:
    'Unfortunately we could not approve your application this time. Thank you for wanting to give a pet a home.',
  cancelled: 'Your application has been cancelled.',
};

const STATUS_TEXT: Record<string, string> = {
  confirmed: 'Your booking is confirmed. See you soon!',
  in_progress: 'Your pet is being taken care of right now.',
  completed: 'Your booking is completed. Thank you for choosing us — we would love a review!',
  cancelled: 'Your booking has been cancelled.',
  no_show: 'We missed you at your booking time. Please contact us to reschedule.',
};

type Rendered = { subject: string; html: string };

/**
 * All email templates live here. Add a new key + renderer and it becomes
 * available to `emailService.send()` with full type-safety on `data`.
 */
export const emailTemplates = {
  EMAIL_VERIFY: (d: { name: string; token: string }): Rendered => {
    const link = `${env.CLIENT_URL}/verify-email?token=${d.token}`;
    return {
      subject: `Verify your email — ${env.APP_NAME}`,
      html: layout(
        `Welcome, ${d.name}!`,
        `<p>Please confirm your email address to activate your account.</p>
         ${button(link, 'Verify email')}
         <p style="font-size:13px;color:#6b7280">This link expires in ${env.EMAIL_VERIFY_TOKEN_EXPIRES_MINUTES} minutes.</p>`,
      ),
    };
  },

  PASSWORD_RESET: (d: { name: string; token: string }): Rendered => {
    const link = `${env.CLIENT_URL}/reset-password?token=${d.token}`;
    return {
      subject: `Reset your password — ${env.APP_NAME}`,
      html: layout(
        'Password reset request',
        `<p>Hi ${escapeHtml(d.name)}, we received a request to reset your password.</p>
         ${button(link, 'Reset password')}
         <p style="font-size:13px;color:#6b7280">This link expires in ${env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES} minutes.
         If you didn't request this, you can ignore this email.</p>`,
      ),
    };
  },

  PASSWORD_CHANGED: (d: { name: string }): Rendered => ({
    subject: `Your password was changed — ${env.APP_NAME}`,
    html: layout(
      'Password changed',
      `<p>Hi ${escapeHtml(d.name)}, your password was changed successfully.
       If this wasn't you, reset your password immediately and contact support.</p>`,
    ),
  }),

  ACCOUNT_CREATED: (d: { name: string; email: string; role: string }): Rendered => ({
    subject: `Your ${env.APP_NAME} account is ready`,
    html: layout(
      `Hi ${d.name}`,
      `<p>An administrator created a <b>${escapeHtml(d.role)}</b> account for you
       with the email <b>${escapeHtml(d.email)}</b>.</p>
       <p>Use "Forgot password" on the login page to set your own password.</p>
       ${button(`${env.CLIENT_URL}/login`, 'Go to login')}`,
    ),
  }),

  BOOKING_RECEIVED: (d: BookingSummary): Rendered => ({
    subject: `Booking received — ${d.bookingNo}`,
    html: layout(
      `Thanks, ${d.name}!`,
      `<p>We received your booking. Complete the payment to confirm your slot.</p>
       ${detailsTable(bookingRows(d))}
       ${button(`${env.CLIENT_URL}/account/bookings/${d.bookingNo}`, 'View booking')}`,
    ),
  }),

  BOOKING_STATUS_CHANGED: (
    d: BookingSummary & { status: string; note?: string | null },
  ): Rendered => ({
    subject: `Booking ${d.bookingNo} — ${d.status.replace('_', ' ')}`,
    html: layout(
      `Hi ${d.name}`,
      `<p>${escapeHtml(STATUS_TEXT[d.status] ?? `Your booking status changed to ${d.status}.`)}</p>
       ${d.note ? `<p style="color:#6b7280">Note: ${escapeHtml(d.note)}</p>` : ''}
       ${detailsTable(bookingRows(d))}`,
    ),
  }),

  PAYMENT_RECEIPT: (d: {
    name: string;
    reference: string;
    transactionId: string;
    amount: string;
    method: string;
    paidAt: string;
  }): Rendered => ({
    subject: `Payment received — ${d.reference}`,
    html: layout(
      `Payment received`,
      `<p>Hi ${escapeHtml(d.name)}, we received your payment. Thank you!</p>
       ${detailsTable([
         ['For', d.reference],
         ['Amount', d.amount],
         ['Method', d.method],
         ['Transaction ID', d.transactionId],
         ['Paid at', d.paidAt],
       ])}`,
    ),
  }),

  REFUND_PROCESSED: (d: {
    name: string;
    reference: string;
    amount: string;
    status: string;
  }): Rendered => ({
    subject: `Refund ${d.status} — ${d.reference}`,
    html: layout(
      'Refund update',
      `<p>Hi ${escapeHtml(d.name)}, a refund of <b>${escapeHtml(d.amount)}</b> for
       <b>${escapeHtml(d.reference)}</b> is <b>${escapeHtml(d.status)}</b>.
       Depending on your bank it can take 7–10 working days to appear.</p>`,
    ),
  }),

  ADOPTION_APPLICATION_RECEIVED: (d: {
    name: string;
    applicationNo: string;
    petName: string;
  }): Rendered => ({
    subject: `Adoption application received — ${d.applicationNo}`,
    html: layout(
      `Thank you, ${d.name}!`,
      `<p>We received your application to adopt <b>${escapeHtml(d.petName)}</b>.
       We will review it and get back to you soon.</p>
       ${detailsTable([
         ['Application no', d.applicationNo],
         ['Pet', d.petName],
       ])}
       ${button(`${env.CLIENT_URL}/account/adoption-applications/${d.applicationNo}`, 'Track application')}`,
    ),
  }),

  ADOPTION_APPLICATION_STATUS: (d: {
    name: string;
    applicationNo: string;
    petName: string;
    status: string;
    note?: string | null;
    fee?: string | null;
  }): Rendered => ({
    subject: `Adoption application ${d.applicationNo} — ${d.status.replace('_', ' ')}`,
    html: layout(
      `Hi ${d.name}`,
      `<p>${escapeHtml(APPLICATION_STATUS_TEXT[d.status] ?? `Status: ${d.status}`)}</p>
       ${d.note ? `<p style="color:#6b7280">Note from our team: ${escapeHtml(d.note)}</p>` : ''}
       ${detailsTable([
         ['Application no', d.applicationNo],
         ['Pet', d.petName],
         ...(d.fee ? ([['Adoption fee', d.fee]] as [string, string][]) : []),
       ])}`,
    ),
  }),

  ADOPTION_COMPLETED: (d: { name: string; petName: string; adoptionDate: string }): Rendered => ({
    subject: `Welcome home, ${d.petName}! 🐾`,
    html: layout(
      `Congratulations, ${d.name}!`,
      `<p>The adoption of <b>${escapeHtml(d.petName)}</b> is complete (${escapeHtml(d.adoptionDate)}).
       Thank you for giving a pet a loving home. We'll check in with you soon.</p>`,
    ),
  }),

  CONTACT_RECEIVED: (d: {
    name: string;
    email: string;
    phone?: string | null;
    subject: string;
    message: string;
  }): Rendered => ({
    subject: `New contact message: ${d.subject}`,
    html: layout(
      'New contact form message',
      `${detailsTable([
        ['From', d.name],
        ['Email', d.email],
        ['Phone', d.phone ?? '—'],
        ['Subject', d.subject],
      ])}
       <p style="white-space:pre-line">${escapeHtml(d.message)}</p>`,
    ),
  }),

  NEWSLETTER_WELCOME: (d: { unsubscribeUrl: string }): Rendered => ({
    subject: `You're subscribed to ${env.APP_NAME} 🐾`,
    html: layout(
      'Thanks for subscribing!',
      `<p>You'll get pet care tips, new animals looking for a home and our latest offers.</p>
       <p style="font-size:12px;color:#6b7280">Don't want these emails?
       <a href="${d.unsubscribeUrl}">Unsubscribe</a></p>`,
    ),
  }),
} as const;

export type EmailTemplateName = keyof typeof emailTemplates;
export type EmailTemplateData<T extends EmailTemplateName> = Parameters<
  (typeof emailTemplates)[T]
>[0];
