const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function finding(id, severity, title, detail, source = null) {
  return { id, severity, title, detail, source };
}

function walkFiles(root) {
  if (!root || !fs.existsSync(root)) return [];
  const out = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) out.push(target);
    }
  };
  visit(root);
  return out;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function auditDelivery({ root, manifestPath = null, formalDir = null, candidateDir = null } = {}) {
  const findings = [];
  const resolvedRoot = path.resolve(root || '.');
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    return { status: 'blocked', root: resolvedRoot, counts: { critical: 1, warning: 0, info: 0 }, findings: [finding('DELIV-001', 'critical', 'Delivery root missing', `not a directory: ${resolvedRoot}`)] };
  }

  const manifest = manifestPath ? path.resolve(manifestPath) : path.join(resolvedRoot, 'manifest.json');
  let manifestData = null;
  if (fs.existsSync(manifest)) {
    try {
      manifestData = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (!manifestData || typeof manifestData !== 'object') throw new Error('manifest must be an object');
    } catch (error) {
      findings.push(finding('DELIV-002', 'critical', 'Manifest invalid', error.message, manifest));
    }
  } else {
    findings.push(finding('DELIV-003', 'warning', 'Manifest missing', 'formal delivery should include manifest.json or an explicit manifest path', manifest));
  }

  const files = walkFiles(resolvedRoot);
  const byHash = new Map();
  for (const file of files) {
    const digest = sha256(file);
    const list = byHash.get(digest) || [];
    list.push(path.relative(resolvedRoot, file));
    byHash.set(digest, list);
  }
  for (const [digest, duplicates] of byHash) {
    if (duplicates.length > 1) findings.push(finding('DELIV-004', 'warning', 'Duplicate file hash', `${digest}: ${duplicates.join(', ')}`, resolvedRoot));
  }

  if (manifestData) {
    const entries = Array.isArray(manifestData.files) ? manifestData.files :
      Array.isArray(manifestData.entries) ? manifestData.entries : [];
    if (!entries.length) findings.push(finding('DELIV-005', 'warning', 'Manifest has no file entries', 'expected files or entries array', manifest));
    for (const entry of entries) {
      const rel = typeof entry === 'string' ? entry : entry?.path;
      if (!rel || typeof rel !== 'string') {
        findings.push(finding('DELIV-006', 'critical', 'Manifest entry missing path', 'each manifest file entry needs a path', manifest));
        continue;
      }
      const target = path.resolve(resolvedRoot, rel);
      if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
        findings.push(finding('DELIV-007', 'critical', 'Manifest path escapes root', rel, manifest));
      } else if (!fs.existsSync(target)) {
        findings.push(finding('DELIV-008', 'critical', 'Manifest file missing', rel, manifest));
      } else if (entry && typeof entry === 'object' && entry.sha256 && entry.sha256 !== sha256(target)) {
        findings.push(finding('DELIV-009', 'critical', 'Manifest hash mismatch', rel, manifest));
      }
    }
  }

  for (const [label, dir] of [['formal', formalDir], ['candidate', candidateDir]]) {
    if (!dir) continue;
    const resolved = path.resolve(dir);
    if (!resolved.startsWith(`${resolvedRoot}${path.sep}`) && resolved !== resolvedRoot) {
      findings.push(finding('DELIV-010', 'critical', `${label} directory outside root`, resolved, resolvedRoot));
    } else if (!fs.existsSync(resolved)) {
      findings.push(finding('DELIV-011', 'warning', `${label} directory missing`, resolved, resolvedRoot));
    }
  }

  const rank = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id));
  const counts = findings.reduce((acc, item) => { acc[item.severity] += 1; return acc; }, { critical: 0, warning: 0, info: 0 });
  return { status: counts.critical ? 'blocked' : counts.warning ? 'needs_revision' : 'pass', root: resolvedRoot, manifest: manifest, fileCount: files.length, counts, findings };
}

module.exports = { auditDelivery };
