const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { stateDir } = require('./paths');

const tokenPath = path.join(stateDir, 'event-token');

function getEventToken() {
  fs.mkdirSync(stateDir, { recursive: true });
  if (!fs.existsSync(tokenPath)) {
    fs.writeFileSync(tokenPath, crypto.randomBytes(32).toString('hex'), { encoding: 'utf8', mode: 0o600 });
  }
  return fs.readFileSync(tokenPath, 'utf8').trim();
}

function isAuthorized(request) {
  const provided = request.headers['x-skill-console-token'];
  const expected = getEventToken();
  if (!provided || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

module.exports = { getEventToken, isAuthorized, tokenPath };
