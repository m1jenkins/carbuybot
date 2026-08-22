const crypto = require('node:crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

function randomLetters(length = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function newEngagementId() {
  return `eng_${crypto.randomBytes(8).toString('hex')}`;
}

function selectPriceId(store, config) {
  return store.paidCount() < config.introCap ? config.introPriceId : config.standardPriceId;
}

function priceLabel(priceId, config) {
  return priceId === config.introPriceId ? 'intro_349' : 'standard_399';
}

module.exports = {
  isValidEmail,
  randomLetters,
  newEngagementId,
  selectPriceId,
  priceLabel,
};
