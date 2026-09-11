const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { auditDelivery } = require('../src/delivery-audit');

test('audits a manifest and detects duplicate hashes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-audit-'));
  fs.mkdirSync(path.join(root, 'formal'));
  fs.writeFileSync(path.join(root, 'formal', 'prompt.txt'), 'same');
  fs.writeFileSync(path.join(root, 'copy.txt'), 'same');
  const hash = crypto.createHash('sha256').update('same').digest('hex');
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ files: [{ path: 'formal/prompt.txt', sha256: hash }] }));
  const result = auditDelivery({ root });
  assert.equal(result.status, 'needs_revision');
  assert.ok(result.findings.some((item) => item.id === 'DELIV-004'));
});

test('blocks a manifest path escaping the delivery root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-audit-'));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ files: [{ path: '../outside.txt' }] }));
  const result = auditDelivery({ root });
  assert.equal(result.status, 'blocked');
  assert.ok(result.findings.some((item) => item.id === 'DELIV-007'));
});
