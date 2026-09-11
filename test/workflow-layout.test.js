const test = require('node:test');
const assert = require('node:assert/strict');
const { layoutWorkflow } = require('../public/workflow-layout');

test('lays workflow references left-to-right and packs each depth into rows', () => {
  const skills = ['entry', 'planner', 'writer', 'review', 'isolated'].map((name) => ({ name }));
  const layout = layoutWorkflow(skills, [
    { source: 'entry', target: 'planner' },
    { source: 'planner', target: 'writer' },
    { source: 'writer', target: 'review' },
  ]);
  const x = (name) => layout.positions.get(name).x;
  assert.ok(x('entry') < x('planner'));
  assert.ok(x('planner') < x('writer'));
  assert.ok(x('writer') < x('review'));
  assert.ok(layout.positions.get('isolated').y > layout.positions.get('review').y);
  assert.ok(layout.height < 900);
});

test('handles cycles without dropping nodes', () => {
  const skills = ['a', 'b', 'c'].map((name) => ({ name }));
  const layout = layoutWorkflow(skills, [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'a' },
    { source: 'b', target: 'c' },
  ]);
  assert.equal(layout.positions.size, 3);
  assert.ok(layout.width > 0 && layout.height > 0);
});
