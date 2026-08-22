const crypto = require('node:crypto');

function secretsEqual(provided, expected) {
  if (!expected) return false;
  const left = Buffer.from(String(provided || ''));
  const right = Buffer.from(String(expected));
  if (left.length !== right.length) {
    crypto.timingSafeEqual(right, right);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

module.exports = { secretsEqual };
