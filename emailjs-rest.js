/**
 * EmailJS REST 발송 (서버·Netlify Functions 공용)
 */
'use strict';

const EMAILJS_SERVICE_ID = 'service_qq3o0or';
const EMAILJS_TEMPLATE_ID = 'template_fk0poj6';
const EMAILJS_PUBLIC_KEY = 'zrRVWnL0cA9eyxpDp';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || '';

async function sendEmailJs(templateParams) {
  const body = {
    lib_version: '4.0.0',
    user_id: EMAILJS_PUBLIC_KEY,
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    template_params: templateParams
  };
  if (EMAILJS_PRIVATE_KEY) {
    body.accessToken = EMAILJS_PRIVATE_KEY;
  }

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || 'EmailJS 발송 실패 (' + res.status + ')');
    err.needsBrowserFallback = /non-browser|API access/i.test(text);
    throw err;
  }

  return { success: true, toEmail: templateParams.to_email };
}

module.exports = {
  sendEmailJs,
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY
};
