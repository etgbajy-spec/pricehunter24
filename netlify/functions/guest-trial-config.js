/**
 * Netlify Function: GET /api/guest-trial-config
 */
const GUEST_TRIAL_STRICT_LIMITS = process.env.GUEST_TRIAL_STRICT_LIMITS === 'true';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      strictLimits: GUEST_TRIAL_STRICT_LIMITS,
      emailLimit: GUEST_TRIAL_STRICT_LIMITS,
      ipLimit: GUEST_TRIAL_STRICT_LIMITS
    })
  };
};
