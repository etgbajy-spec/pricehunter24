/**
 * Create a Firebase Auth test user + members doc.
 *
 * Usage (PowerShell):
 *   node tools/create-test-user.js --email "test1@yourdomain.com" --password "YourPassw0rd!" --name "테스트1"
 *
 * Requires env vars (same as Netlify functions):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *   (optional) FIREBASE_ADMIN_PRIVATE_KEY_ID, FIREBASE_ADMIN_CLIENT_ID, FIREBASE_ADMIN_CLIENT_X509_CERT_URL
 */
const admin = require('firebase-admin');
const fs = require('fs');
 
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = val;
  }
  return out;
}
 
function requireEnv(name) {
  const v = (process.env[name] || '').toString();
  if (!v.trim()) throw new Error(`Missing env: ${name}`);
  return v;
}

function loadServiceAccountFromFile(filePath) {
  const p = String(filePath || '').trim();
  if (!p) return null;
  if (!fs.existsSync(p)) throw new Error(`Service account file not found: ${p}`);
  const raw = fs.readFileSync(p, 'utf8');
  const json = JSON.parse(raw);
  if (!json || !json.client_email || !json.private_key) {
    throw new Error('Invalid service account JSON (missing client_email/private_key)');
  }
  return json;
}
 
async function main() {
  const args = parseArgs(process.argv);
  const email = String(args.email || '').trim();
  const password = String(args.password || '').trim();
  const name = String(args.name || '').trim() || '테스트계정';
 
  if (!email || !password) {
    console.error('Usage: node tools/create-test-user.js --email "a@b.com" --password "Passw0rd!" --name "테스트"');
    process.exit(1);
  }
 
  // Prefer GOOGLE_APPLICATION_CREDENTIALS JSON file if provided (easiest setup)
  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '';
  const fromFile = gacPath ? loadServiceAccountFromFile(gacPath) : null;

  const projectId = (process.env.FIREBASE_PROJECT_ID || fromFile?.project_id || 'pricehunter-99a1b').toString();
  const clientEmail = (fromFile?.client_email || process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').toString().trim();
  const privateKeyRaw = (fromFile?.private_key || process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').toString();
  if (!clientEmail) throw new Error('Missing env: FIREBASE_ADMIN_CLIENT_EMAIL (or set GOOGLE_APPLICATION_CREDENTIALS)');
  if (!privateKeyRaw.trim()) throw new Error('Missing env: FIREBASE_ADMIN_PRIVATE_KEY (or set GOOGLE_APPLICATION_CREDENTIALS)');
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
 
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        type: 'service_account',
        project_id: projectId,
        private_key_id: fromFile?.private_key_id || process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: clientEmail,
        client_id: fromFile?.client_id || process.env.FIREBASE_ADMIN_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: fromFile?.client_x509_cert_url || process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
      }),
      projectId,
    });
  }
 
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    console.log('User already exists, uid:', user.uid);
  } catch (e) {
    user = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });
    console.log('Created user, uid:', user.uid);
  }
 
  const db = admin.firestore();
  await db.collection('members').doc(user.uid).set(
    {
      email,
      name,
      provider: 'email',
      role: 'viewer',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _testAccount: true,
    },
    { merge: true }
  );
 
  console.log('Upserted members/' + user.uid);
  console.log('---');
  console.log('LOGIN INFO');
  console.log('email:', email);
  console.log('password:', password);
}
 
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

