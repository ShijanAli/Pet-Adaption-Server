import { env } from '@/config/env';

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export const button = (href: string, label: string) => `
  <a href="${href}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;
     padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0">${escapeHtml(label)}</a>`;

/** Two-column key/value table (booking & payment details) */
export const detailsTable = (rows: [label: string, value: string][]) => `
  <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;font-size:14px">
    ${rows
      .map(
        ([label, value]) => `<tr>
          <td style="border-bottom:1px solid #f1ede8;color:#6b7280;width:40%">${escapeHtml(label)}</td>
          <td style="border-bottom:1px solid #f1ede8;font-weight:600">${escapeHtml(value)}</td>
        </tr>`,
      )
      .join('')}
  </table>`;

/** Shared HTML wrapper for every email */
export const layout = (title: string, body: string) => `<!doctype html>
<html>
  <body style="margin:0;background:#f7f5f2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px">
          <tr><td>
            <h2 style="margin:0 0 8px;color:#111827">${escapeHtml(title)}</h2>
            ${body}
            <p style="margin-top:32px;font-size:12px;color:#6b7280">— ${escapeHtml(env.APP_NAME)} Team</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
