const fs = require('node:fs');
const path = require('node:path');

function walkSkillFiles(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '__pycache__', 'assets'].includes(entry.name)) stack.push(full);
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        result.push(full);
      }
    }
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function parseFrontmatter(content) {
  const normalized = content.replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const output = {};
  let activeKey = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (field) {
      activeKey = field[1];
      output[activeKey] = field[2].replace(/^['"]|['"]$/g, '');
    } else if (activeKey && /^\s+/.test(rawLine)) {
      output[activeKey] += ` ${line.trim()}`;
    }
  }
  return output;
}

function extractSkillMentions(content) {
  const names = new Set();
  for (const match of content.matchAll(/`\$([a-z0-9][a-z0-9-]{1,63})`/gi)) names.add(match[1]);
  return [...names].sort();
}

function extractReferencePaths(content) {
  const refs = new Set();
  const patterns = [
    /\[[^\]]*\]\(([^)]+\.md(?:#[^)]+)?)\)/gi,
    /`([^`\r\n]+\.md(?:#[^`\r\n]+)?)`/gi
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const value = match[1].split('#')[0].trim();
      const looksLikePath = value.includes('/') || value.includes('\\');
      if (!/^https?:\/\//i.test(value) && !value.includes('<') && looksLikePath) refs.add(value);
    }
  }
  return [...refs].sort();
}

function inferCategory(name, description) {
  const skillName = String(name || '').toLowerCase();
  const text = `${skillName} ${description || ''}`.toLowerCase();

  // Prefer the skill name and keep description matches word-bounded. This
  // prevents words such as "effective" from being mistaken for VFX effects.
  if (/(?:^|-)(?:preflight|audit|review|doctor|iteration|troubleshoot)(?:-|$)/.test(skillName)) return '质量与迭代';
  if (/(?:^|-)(?:vfx|effect|fantasy|xianxia)(?:-|$)/.test(skillName) || /玄幻|特效/.test(skillName)) return '特效';
  if (/(?:^|-)(?:performance|emotion|emotional|relationship|acting)(?:-|$)/.test(skillName) || /表演|情绪/.test(skillName)) return '表演';
  if (/(?:^|-)(?:action|fight|choreography|motion|combat|transformation)(?:-|$)/.test(skillName) || /动作|打斗/.test(skillName)) return '动作';
  if (/(?:^|-)(?:camera|storyboard|shot|cinema|cinematic|audiovisual|video-structure)(?:-|$)/.test(skillName) || /镜头|分镜/.test(skillName)) return '镜头';
  if (/(?:^|-)(?:continuity|entity|reference|asset|consistency)(?:-|$)/.test(skillName) || /连续/.test(skillName)) return '连续性';
  if (/(?:^|-)(?:seedance|jimeng|prompt|platform|openai-docs)(?:-|$)/.test(skillName)) return '平台与提示词';
  if (/(?:^|-)(?:style|aesthetic|material|world|visual|imagegen|poster|design)(?:-|$)/.test(skillName)) return '美术与材质';

  if (/\b(?:preflight|audit|review|diagnose|iteration|quality)\b/.test(text)) return '质量与迭代';
  if (/\b(?:vfx|effects?|fantasy|xianxia)\b|玄幻|特效/.test(text)) return '特效';
  if (/\b(?:action|fight|choreography|motion|combat)\b|动作|打斗/.test(text)) return '动作';
  if (/\b(?:performance|emotion|relationship|acting)\b|表演|情绪/.test(text)) return '表演';
  if (/\b(?:camera|storyboard|shots?|audiovisual|cinema)\b|镜头|分镜/.test(text)) return '镜头';
  if (/\b(?:continuity|entity|reference|assets?|consistency)\b|连续/.test(text)) return '连续性';
  if (/\b(?:seedance|jimeng|prompt|platform)\b/.test(text)) return '平台与提示词';
  if (/\b(?:style|aesthetic|material|world|visual|image)\b|美术|材质/.test(text)) return '美术与材质';
  return '其他';
}

function readImplicitInvocation(directory) {
  const metadataPath = path.join(directory, 'agents', 'openai.yaml');
  if (!fs.existsSync(metadataPath)) return null;
  const content = fs.readFileSync(metadataPath, 'utf8');
  const match = content.match(/^\s*allow_implicit_invocation:\s*(true|false)\s*$/mi);
  return match ? match[1].toLowerCase() === 'true' : null;
}

function readUiMetadata(directory) {
  const metadataPath = path.join(directory, 'agents', 'openai.yaml');
  if (!fs.existsSync(metadataPath)) return {};
  let content;
  try { content = fs.readFileSync(metadataPath, 'utf8'); } catch { return {}; }
  const read = (key) => {
    const match = content.match(new RegExp(`^\\s*${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, 'mi'));
    return match ? match[1].trim() : '';
  };
  return {
    displayName: read('display_name'),
    shortDescription: read('short_description'),
    defaultPrompt: read('default_prompt')
  };
}

function buildSkillIndex(root) {
  const skills = [];
  for (const filePath of walkSkillFiles(root)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatter = parseFrontmatter(content);
    const stat = fs.statSync(filePath);
    const name = frontmatter.name || path.basename(path.dirname(filePath));
    const directory = path.dirname(filePath);
    const ui = readUiMetadata(directory);
    skills.push({
      id: name,
      name,
      displayName: ui.displayName || name,
      description: frontmatter.description || '',
      shortDescription: ui.shortDescription || '',
      defaultPrompt: ui.defaultPrompt || '',
      category: inferCategory(name, frontmatter.description || ''),
      filePath,
      directory,
      implicitInvocation: readImplicitInvocation(directory),
      modifiedAt: stat.mtime.toISOString(),
      lines: content.split(/\r?\n/).length,
      mentions: extractSkillMentions(content),
      references: extractReferencePaths(content),
      content
    });
  }
  const known = new Set(skills.map((skill) => skill.name));
  const edges = [];
  for (const skill of skills) {
    for (const target of skill.mentions) {
      edges.push({ source: skill.name, target, resolved: known.has(target) });
    }
  }
  return { root, generatedAt: new Date().toISOString(), skills, edges };
}

module.exports = {
  buildSkillIndex,
  extractReferencePaths,
  extractSkillMentions,
  inferCategory,
  parseFrontmatter,
  readImplicitInvocation,
  readUiMetadata,
  walkSkillFiles
};
