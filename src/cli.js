const fs = require('node:fs');
const { appendEvent } = require('./ledger');
const paths = require('./paths');
const { buildSnapshot } = require('./service');
const { readState, validateState, buildExecutionPlan } = require('./orchestration');
const { auditDelivery } = require('./delivery-audit');

const command = process.argv[2] || 'scan';

if (command === 'scan') {
  const snapshot = buildSnapshot({ force: true });
  console.log(JSON.stringify({
    root: snapshot.index.root,
    generatedAt: snapshot.generatedAt,
    skills: snapshot.index.skills.length,
    dependencies: snapshot.index.edges.length
  }, null, 2));
} else if (command === 'audit') {
  console.log(JSON.stringify(buildSnapshot({ force: true }).audit, null, 2));
} else if (command === 'seed-run') {
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.writeFileSync(paths.ledgerPath, '', 'utf8');
  const runId = `demo-${Date.now()}`;
  const base = { runId, taskId: 'demo-short-drama', taskTitle: '真人短剧分镜路由演示' };
  const events = [
    ['ai-video-prompt-director', 'intent', 'completed', '完成意图识别和任务分类'],
    ['character-continuity-bible', 'continuity', 'completed', '角色与参考图职责已锁定'],
    ['narrative-camera-groups', 'group_delivery', 'running', '正在划分14-28秒镜头组'],
    ['professional-storyboard-director', 'shot_design', 'selected', '等待镜头组边界'],
    ['seedance-fight-director', 'fight_compile', 'matched', '动作戏条件已触发'],
    ['cinematic-vfx-director', 'vfx', 'matched', '玄幻特效条件已触发'],
    ['jimeng-sd2-prompting', 'jimeng', 'skipped', '目标平台为Seedance'],
    ['seedance-20', 'seedance', 'selected', '等待上游交接'],
    ['ai-video-prompt-preflight', 'audit', 'selected', '等待最终提示词']
  ];
  for (const [skill, ownerSurface, status, message] of events) {
    appendEvent(paths.ledgerPath, { ...base, skill, ownerSurface, phase: ownerSurface, status, message });
  }
  console.log(JSON.stringify({ seeded: true, runId, events: events.length }, null, 2));
} else if (command === 'validate-state') {
  const statePath = process.argv[3];
  if (!statePath) {
    console.error('Usage: node src/cli.js validate-state <state.json>');
    process.exitCode = 1;
  } else {
    try {
      const snapshot = buildSnapshot({ force: true });
      const result = validateState(readState(statePath), snapshot.contract);
      console.log(JSON.stringify(result, null, 2));
      if (result.status === 'blocked') process.exitCode = 1;
    } catch (error) {
      console.error(`State validation failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
} else if (command === 'route-plan') {
  const inputPath = process.argv[3];
  if (!inputPath) {
    console.error('Usage: node src/cli.js route-plan <routing-features.json>');
    process.exitCode = 1;
  } else {
    try {
      console.log(JSON.stringify(buildExecutionPlan(readState(inputPath)), null, 2));
    } catch (error) {
      console.error(`Route planning failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
} else if (command === 'delivery-audit') {
  const root = process.argv[3];
  if (!root) {
    console.error('Usage: node src/cli.js delivery-audit <delivery-root> [manifest.json]');
    process.exitCode = 1;
  } else {
    const result = auditDelivery({ root, manifestPath: process.argv[4] || null });
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'blocked') process.exitCode = 1;
  }
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
