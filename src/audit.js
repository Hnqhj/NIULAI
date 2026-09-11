const fs = require('node:fs');
const path = require('node:path');

function finding(id, severity, category, title, detail, source) {
  return { id, severity, category, title, detail, source };
}

function lineContext(content, needle) {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  return index >= 0 ? { line: index + 1, text: lines[index].trim() } : null;
}

function contractFinding(id, severity, category, title, detail, source = 'routing-contract.json') {
  return finding(id, severity, category, title, detail, source);
}

function auditOrchestrationContract(index, contract) {
  const findings = [];
  const skills = new Map(index.skills.map((skill) => [skill.name, skill]));
  const rules = contract?.rules || {};
  const stateChain = rules.stateChain;
  if (!Array.isArray(stateChain) || stateChain.length < 2) {
    findings.push(contractFinding(
      'state-chain:missing', 'critical', 'orchestration',
      '状态链缺失', 'routing contract must define rules.stateChain with ordered state objects'
    ));
  } else {
    const duplicates = stateChain.filter((name, i) => stateChain.indexOf(name) !== i);
    if (duplicates.length) {
      findings.push(contractFinding(
        'state-chain:duplicate', 'critical', 'orchestration',
        '状态链存在重复节点', `duplicate state nodes: ${[...new Set(duplicates)].join(', ')}`
      ));
    }
  }

  const deliveryContracts = rules.deliveryContracts;
  if (!deliveryContracts || typeof deliveryContracts !== 'object') {
    findings.push(contractFinding(
      'delivery-contract:missing', 'critical', 'duration',
      '时长契约缺失', 'routing contract must define rules.deliveryContracts'
    ));
  } else {
    for (const [name, range] of Object.entries(deliveryContracts)) {
      if (!range || typeof range.min !== 'number' || (range.max !== null && typeof range.max !== 'number')) {
        findings.push(contractFinding(
          `delivery-contract:${name}`, 'critical', 'duration',
          '时长契约格式错误', `${name} must define numeric min/max (max may be null)`
        ));
      } else if (range.max !== null && range.max < range.min) {
        findings.push(contractFinding(
          `delivery-contract:${name}:range`, 'critical', 'duration',
          '时长契约范围反转', `${name}.max is smaller than ${name}.min`
        ));
      }
    }
  }

  if (typeof rules.specialistReturn !== 'string' ||
      !/TASK_CARD/i.test(rules.specialistReturn) ||
      !/state_patch_request/i.test(rules.specialistReturn)) {
    findings.push(contractFinding(
      'task-card:missing', 'critical', 'orchestration',
      '任务卡协议缺失', 'rules.specialistReturn must require TASK_CARD and state_patch_request'
    ));
  }

  const seenSurfaceIds = new Map();
  for (const surface of Array.isArray(contract?.surfaces) ? contract.surfaces : []) {
    if (seenSurfaceIds.has(surface.id)) {
      findings.push(contractFinding(
        `surface:${surface.id}:duplicate`, 'critical', 'owner',
        '控制面 ID 重复', `surface id ${surface.id} is declared more than once`
      ));
    }
    seenSurfaceIds.set(surface.id, surface.owner);
  }

  const schemaPath = contract?.stateSchema;
  if (!schemaPath) {
    findings.push(contractFinding(
      'state-schema:missing', 'warning', 'orchestration',
      '状态 Schema 未登记', 'routing contract should declare stateSchema'
    ));
  } else if (!fs.existsSync(path.resolve(path.dirname(path.dirname(contract.__sourcePath || '')), schemaPath))) {
    // service adds __sourcePath before auditing; keep this check non-blocking
    // when auditIndex is called directly by tests.
    if (contract.__sourcePath) {
      findings.push(contractFinding(
        'state-schema:not-found', 'critical', 'orchestration',
        '状态 Schema 不存在', schemaPath
      ));
    }
  }

  if (Number(contract?.contractVersion || 0) >= 6) {
    const executionPlans = rules.executionPlans;
    if (!executionPlans || typeof executionPlans !== 'object') {
      findings.push(contractFinding(
        'execution-plans:missing', 'critical', 'routing',
        '缺少确定性执行计划', 'contract v6 must define fast, standard, and full execution plans'
      ));
    } else {
      for (const depth of ['fast', 'standard', 'full']) {
        const plan = executionPlans[depth];
        if (!plan || plan.preflightProfile !== depth || plan.promptCompileCount !== 1) {
          findings.push(contractFinding(
            `execution-plan:${depth}:invalid`, 'critical', 'routing',
            `${depth} 执行计划不完整`, 'each depth must name its matching preflight profile and promptCompileCount=1'
          ));
        }
        const reviewBudget = plan?.reviewBudget;
        const reviewKeys = ['planningOwner', 'semanticOwner', 'mechanicalOwner', 'globalReasoning', 'specialistReview'];
        if (!reviewBudget || reviewKeys.some((key) => !Object.prototype.hasOwnProperty.call(reviewBudget, key))) {
          findings.push(contractFinding(
            `execution-plan:${depth}:review-budget`, 'critical', 'review',
            `${depth} 未定义明确的 review budget`,
            'each depth must assign planning, semantic, mechanical, global, and specialist review ownership'
          ));
        }
      }
      const fastRequired = executionPlans.fast?.required || [];
      const expectedFast = [
        'script-camera-group-router',
        'narrative-camera-groups',
        'seedance-camera-group-compiler-fast',
        'camera-group-preflight-fast'
      ];
      const fastDelta = expectedFast.filter((name) => !fastRequired.includes(name));
      if (fastRequired.length !== expectedFast.length || fastDelta.length) {
        findings.push(contractFinding(
          'execution-plan:fast:not-minimal', 'critical', 'routing',
          'Fast 路线不是四 Skill 最小链', `missing or extra fast skills; missing=[${fastDelta.join(', ')}]`
        ));
      }
      const heavyFastGuards = [
        'ai-video-prompt-director', 'ai-video-production-governance',
        'camera-group-director-standard', 'professional-storyboard-director',
        'character-continuity-bible', 'seedance-20',
        'jimeng-sd2-prompting', 'ai-video-prompt-preflight'
      ];
      const fastForbidden = executionPlans.fast?.forbidden || [];
      const missingGuards = heavyFastGuards.filter((name) => !fastForbidden.includes(name));
      if (missingGuards.length) {
        findings.push(contractFinding(
          'execution-plan:fast:unguarded', 'critical', 'routing',
          'Fast 路线缺少重型 Skill 禁止项', `missing forbidden skills: ${missingGuards.join(', ')}`
        ));
      }

      const expectedStandard = [
        'script-camera-group-router',
        'camera-group-director-standard',
        'narrative-camera-groups',
        '<selected-platform-compiler>',
        'camera-group-preflight-standard'
      ];
      const standardRequired = executionPlans.standard?.required || [];
      const missingStandard = expectedStandard.filter((name) => !standardRequired.includes(name));
      if (standardRequired.length !== expectedStandard.length || missingStandard.length) {
        findings.push(contractFinding(
          'execution-plan:standard:not-minimal', 'critical', 'routing',
          'Standard 路线不是五 Skill 轻量链', `missing or extra standard skills; missing=[${missingStandard.join(', ')}]`
        ));
      }
      const standardHeavyGuards = [
        'ai-video-prompt-director', 'ai-video-production-governance',
        'professional-storyboard-director', 'cinematic-audiovisual-language',
        'character-continuity-bible',
        'ai-material-realism', 'cinematic-music-sound-design',
        'ai-video-prompt-preflight', 'creative-research-first'
      ];
      const standardForbidden = executionPlans.standard?.forbidden || [];
      const missingStandardGuards = standardHeavyGuards.filter((name) => !standardForbidden.includes(name));
      if (missingStandardGuards.length) {
        findings.push(contractFinding(
          'execution-plan:standard:unguarded', 'critical', 'routing',
          'Standard 路线缺少重型 Skill 禁止项', `missing forbidden skills: ${missingStandardGuards.join(', ')}`
        ));
      }
    }

    if (rules.adaptiveProcessingDepth?.selectionOwner !== 'script-camera-group-router') {
      findings.push(contractFinding(
        'route-owner:invalid', 'critical', 'routing',
        '镜头组路由 Owner 错误', 'adaptiveProcessingDepth.selectionOwner must be script-camera-group-router'
      ));
    }

    const contextPolicy = rules.contextPolicy;
    const expectedContextPolicy = {
      sourceOfTruth: 'orchestration_state',
      handoffMode: 'state_patch_only',
      referenceReadPolicy: 'read_once_reuse_receipt',
      transcriptReplay: 'forbidden',
      reviewMode: 'owner_only',
      compilerInput: 'approved_state_only'
    };
    if (!contextPolicy || Object.entries(expectedContextPolicy).some(([key, value]) => contextPolicy[key] !== value)) {
      findings.push(contractFinding(
        'context-policy:invalid', 'critical', 'efficiency',
        '上下文复用策略缺失或不完整',
        'contract v6 must enforce state-patch-only handoffs, one-read reference reuse, no transcript replay, owner-only review, and approved-state-only compiler input'
      ));
    }

    const compilerGroup = (contract.exclusiveGroups || []).find((group) => group.id === 'platform_compiler');
    const expectedCompilers = ['seedance-camera-group-compiler-fast', 'seedance-20', 'jimeng-sd2-prompting'];
    const missingCompilers = expectedCompilers.filter((name) => !compilerGroup?.members?.includes(name));
    if (missingCompilers.length) {
      findings.push(contractFinding(
        'compiler-exclusion:incomplete', 'critical', 'routing',
        '平台编译器互斥组不完整', `missing compiler members: ${missingCompilers.join(', ')}`
      ));
    }

    const cameraGroupEntrypoints = [
      'script-camera-group-router',
      'camera-group-director-standard',
      'ai-video-prompt-director',
      'director-workflow-70',
      'ai-short-drama-storyboard',
      'professional-storyboard-director',
      'narrative-camera-groups',
      'full-prompt-delivery',
      'ai-video-prompt-preflight'
    ];
    if (skills.has('script-camera-group-router')) {
      for (const name of cameraGroupEntrypoints) {
        const skill = skills.get(name);
        if (!skill) continue;
        const expected = name === 'script-camera-group-router';
        if (skill.implicitInvocation !== expected) {
          findings.push(contractFinding(
            `implicit-entry:${name}`, 'critical', 'routing',
            '镜头组隐式入口冲突', `${name} allow_implicit_invocation must be ${expected}`,
            skill.filePath
          ));
        }
      }
    }
  }

  return findings;
}

function auditIndex(index, contract) {
  const findings = auditOrchestrationContract(index, contract);
  const skillMap = new Map(index.skills.map((skill) => [skill.name, skill]));
  const monitoredNames = new Set([
    'ai-video-prompt-director',
    'director-workflow-70',
    'ai-short-drama-storyboard',
    'narrative-camera-groups',
    'full-prompt-delivery',
    ...contract.surfaces.map((surface) => surface.owner)
  ]);

  for (const surface of contract.surfaces) {
    if (!skillMap.has(surface.owner)) {
      findings.push(finding(
        `missing-owner:${surface.id}`,
        'critical',
        'owner',
        `${surface.label}缺少 Owner`,
        `契约指定 ${surface.owner}，但扫描范围内不存在。`,
        contract.project
      ));
    }
  }

  for (const edge of index.edges.filter((item) => !item.resolved && monitoredNames.has(item.source))) {
    const sourceSkill = skillMap.get(edge.source);
    const context = lineContext(sourceSkill.content, `$${edge.target}`);
    const optional = contract.optionalCapabilities?.includes(edge.target) ||
      (context && /optional|when installed|if installed|fallback|unavailable/i.test(context.text));
    findings.push(finding(
      `unresolved-skill:${edge.source}:${edge.target}`,
      optional ? 'info' : 'warning',
      'dependency',
      `未解析 Skill：${edge.target}`,
      optional ? '文档声明了可选能力或回退路径。' : '调用方引用了扫描范围内不存在的 Skill。',
      `${sourceSkill.filePath}${context ? `:${context.line}` : ''}`
    ));
  }

  for (const skill of index.skills.filter((item) => monitoredNames.has(item.name))) {
    for (const ref of skill.references) {
      const skillRef = ref.match(/^\$([a-z0-9-]+)[/\\](.+)$/i);
      const targetSkill = skillRef ? skillMap.get(skillRef[1]) : null;
      const candidates = targetSkill
        ? [path.resolve(targetSkill.directory, skillRef[2])]
        : path.isAbsolute(ref)
          ? [path.resolve(ref)]
          : [path.resolve(skill.directory, ref), path.resolve(path.dirname(skill.directory), ref)];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        findings.push(finding(
          `missing-ref:${skill.name}:${ref}`,
          'warning',
          'reference',
          `参考文件不存在：${ref}`,
          '相对路径在 Skill 目录及其上一级均未找到。',
          skill.filePath
        ));
      }
    }
  }

  const directorNames = ['ai-video-prompt-director', 'director-workflow-70'];
  for (const name of directorNames) {
    const skill = skillMap.get(name);
    if (!skill) continue;
    const lines = skill.content.split(/\r?\n/);
    lines.forEach((line, indexNumber) => {
      const hasBothCompilers = line.includes('$seedance-20') && line.includes('$jimeng-sd2-prompting');
      const guarded = /sole|not co-author|do not invoke both|do not also|cross-platform|only when|or `/i.test(line);
      if (hasBothCompilers && !guarded) {
        findings.push(finding(
          `compiler-overlap:${name}:${indexNumber + 1}`,
          'warning',
          'routing',
          '平台编译器可能被同时调用',
          '同一规则同时引用 Seedance 与即梦编译器，但没有互斥说明。',
          `${skill.filePath}:${indexNumber + 1}`
        ));
      }
      const legacyDuration = /\b(?:5|8|10|13|15)[-– ]second|(?:5|8|10|13|15)秒/i.test(line);
      const contextWindow = lines.slice(Math.max(0, indexNumber - 2), indexNumber + 3).join(' ');
      const durationGuard = /test|non-liu|override|explicit|does not change|短测试|不覆盖|仅/i.test(contextWindow);
      if (legacyDuration && !durationGuard) {
        findings.push(finding(
          `legacy-duration:${name}:${indexNumber + 1}`,
          'info',
          'duration',
          '发现旧短时长示例',
          '需确认该示例不会覆盖 14-28 秒短剧镜头组契约。',
          `${skill.filePath}:${indexNumber + 1}`
        ));
      }
    });
  }

  const severityRank = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title));
  return {
    generatedAt: new Date().toISOString(),
    counts: findings.reduce((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, { critical: 0, warning: 0, info: 0 }),
    findings
  };
}

module.exports = { auditIndex };
