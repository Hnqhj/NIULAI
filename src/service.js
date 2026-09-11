const fs = require('node:fs');
const { auditIndex } = require('./audit');
const { readEvents, summarizeRuns } = require('./ledger');
const { buildSkillIndex } = require('./skill-index');
const { readLiveRuns } = require('./live-sessions');
const paths = require('./paths');

let cache = null;

function readContract() {
  const contract = JSON.parse(fs.readFileSync(paths.contractPath, 'utf8'));
  Object.defineProperty(contract, '__sourcePath', {
    value: paths.contractPath,
    enumerable: false,
    configurable: false
  });
  return contract;
}

function buildSnapshot({ force = false } = {}) {
  if (cache && !force && Date.now() - cache.created < 15_000) return cache.value;
  const fullIndex = buildSkillIndex(paths.defaultSkillsRoot);
  const publicIndex = {
    ...fullIndex,
    skills: fullIndex.skills.map(({ content, ...skill }) => skill)
  };
  const contract = readContract();
  const audit = auditIndex(fullIndex, contract);
  const events = readEvents(paths.ledgerPath);
  // 载荷瘦身：前端只需要事件计数，完整事件数组随运行数无界增长（每 15 秒轮询全量下发）。
  // The monitor is a view of the explicit ledger, so preserve every event
  // transition alongside the latest skill state.
  const runs = summarizeRuns(events).map((run) => ({
    ...run,
    events: run.events,
    eventCount: run.events.length,
    currentPhase: run.events.at(-1)?.phase || run.events.at(-1)?.ownerSurface || ''
  }));
  const realRuns = readLiveRuns({ force });
  // The monitor represents Codex sessions. Ledger entries remain available in
  // the payload for audit tooling, but must never masquerade as live tasks.
  const combinedRuns = realRuns;
  const value = {
    generatedAt: new Date().toISOString(),
    index: publicIndex,
    audit,
    contract,
    runs: combinedRuns,
    realRuns,
    ledgerRuns: runs,
    currentRun: combinedRuns.find((run) => run.active) || combinedRuns[0] || null
  };
  cache = { created: Date.now(), value };
  return value;
}

function clearCache() {
  cache = null;
}

module.exports = { buildSnapshot, clearCache, readContract };
