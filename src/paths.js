const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  projectRoot,
  publicDir: path.join(projectRoot, 'public'),
  dataDir: path.join(projectRoot, 'data'),
  stateDir: path.join(projectRoot, '.state'),
  ledgerPath: path.join(projectRoot, 'data', 'runs.jsonl'),
  contractPath: path.join(projectRoot, 'config', 'routing-contract.json'),
  defaultSkillsRoot: process.env.CODEX_SKILLS_ROOT || path.join(
    process.env.USERPROFILE || 'C:\\Users\\Administrator',
    '.codex',
    'skills'
  ),
  codexHome: process.env.CODEX_HOME || path.join(
    process.env.USERPROFILE || 'C:\\Users\\Administrator',
    '.codex'
  ),
  sessionIndexPath: path.join(
    process.env.CODEX_HOME || path.join(process.env.USERPROFILE || 'C:\\Users\\Administrator', '.codex'),
    'session_index.jsonl'
  ),
  sessionsDir: path.join(
    process.env.CODEX_HOME || path.join(process.env.USERPROFILE || 'C:\\Users\\Administrator', '.codex'),
    'sessions'
  )
};
