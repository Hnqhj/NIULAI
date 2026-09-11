const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractReferencePaths, extractSkillMentions, inferCategory, parseFrontmatter, readImplicitInvocation } = require('../src/skill-index');

test('parses simple frontmatter', () => {
  const value = parseFrontmatter('---\nname: camera-test\ndescription: "Camera test"\n---\n# Test');
  assert.equal(value.name, 'camera-test');
  assert.equal(value.description, 'Camera test');
});

test('extracts unique skill mentions', () => {
  assert.deepEqual(extractSkillMentions('Use `$camera-test` then `$vfx-test` and `$camera-test`.'), ['camera-test', 'vfx-test']);
});

test('extracts local markdown references', () => {
  assert.deepEqual(extractReferencePaths('Read `references/a.md` and [B](references/b.md#part).'), ['references/a.md', 'references/b.md']);
});

test('classifies skill types without substring false positives', () => {
  assert.equal(inferCategory('skill-creator', 'Create effective reusable skills.'), '其他');
  assert.equal(inferCategory('cinematic-vfx-director', 'Design impact systems.'), '特效');
  assert.equal(inferCategory('live-action-performance-direction', 'Direct acting.'), '表演');
  assert.equal(inferCategory('seedance-camera', 'Plan camera movement.'), '镜头');
});

test('reads explicit implicit-invocation policy from skill metadata', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-index-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'agents'));
  fs.writeFileSync(path.join(root, 'agents', 'openai.yaml'), 'policy:\n  allow_implicit_invocation: false\n');
  assert.equal(readImplicitInvocation(root), false);
});
