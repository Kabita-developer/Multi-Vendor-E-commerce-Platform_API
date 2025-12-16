const crypto = require('crypto');

const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';
const SALT_BYTES = 16;

function hashPassword(password) {
  if (!password) {
    throw new Error('Password is required');
  }
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(originalHash, 'hex'),
    Buffer.from(derivedKey, 'hex'),
  );
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
};

