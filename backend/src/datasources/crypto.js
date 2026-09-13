const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
const KEY = getOrCreateKey();

function getOrCreateKey() {
  const raw = process.env.DATASOURCE_SECRET || 'kanban-dev-datasource-secret-32b!';
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * AES-256-GCM encrypt: returns base64 string with iv:tag:ciphertext
 */
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/**
 * AES-256-GCM decrypt: throws on tamper
 */
function decrypt(cipherText) {
  const [ivB64, tagB64, dataB64] = String(cipherText).split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Mask password for safe display: first 4 chars + 4 asterisks
 */
function mask(plain) {
  if (!plain) return '';
  const s = String(plain);
  if (s.length <= 4) return '****';
  return s.slice(0, 4) + '****';
}

module.exports = { encrypt, decrypt, mask };