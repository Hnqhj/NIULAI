const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Ajv2020 = require('ajv/dist/2020');

const STATE_SCHEMA_PATH = path.resolve(__dirname, '../config/orchestration-state.schema.json');
const stateSchema = JSON.parse(fs.readFileSync(STATE_SCHEMA_PATH, 'utf8'));
const stateSchemaValidator = new Ajv2020({ allErrors: true, strict: false }).compile(stateSchema);

const DELIVERY_CONTRACTS = {
  liu_camera_group: { min: 14, max: 28 },
  generic_seedance_clip: { min: 4, max: 15 },
  storyboard_only: { min: 0, max: Infinity },
  platform_specific: { min: 0, max: Infinity }
};

const DEPTHS = new Set(['fast', 'standard', 'full']);
const PROMPT_COMPLEXITIES = new Set(['low', 'medium', 'high']);
const PROMPT_COMPLEXITY_PROFILES = Object.freeze({
  low: Object.freeze({
    six_part: true,
    duration_limited: false,
    microbeat_t_limited: false,
    shot_description: 'simple',
    dialogue_accuracy: 'exact',
    structure_completeness: 'required'
  }),
  medium: Object.freeze({
    six_part: true,
    duration_limited: true,
    microbeat_t_limited: false,
    shot_description: 'simple',
    dialogue_accuracy: 'exact',
    structure_completeness: 'required'
  }),
  high: Object.freeze({
    six_part: true,
    duration_limited: true,
    microbeat_t_limited: true,
    shot_description: 'complex',
    dialogue_accuracy: 'exact',
    structure_completeness: 'required'
  })
});
const MAX_PROMPT_COMPILATION_RECEIPTS = 12;
const FAST_MODES = new Set(['t2v', 'text_to_video', 'text-to-video', 'i2v', 'image_to_video', 'image-to-video']);
const PLATFORM_COMPILERS = [
  'seedance-camera-group-compiler-fast',
  'seedance-20',
  'jimeng-sd2-prompting'
];
const NEVER_CAMERA_GROUP_AUTHORS = [
  'director-workflow-70',
  'ai-short-drama-storyboard',
  'full-prompt-delivery'
];

const REVIEW_BUDGETS = {
  fast: {
    planning_owner: 'narrative-camera-groups',
    semantic_owner: null,
    mechanical_owner: 'camera-group-preflight-fast',
    global_reasoning: 'disabled',
    specialist_review: 'none'
  },
  standard: {
    planning_owner: 'camera-group-director-standard',
    semantic_owner: 'camera-group-preflight-standard',
    mechanical_owner: 'camera-group-preflight-standard',
    global_reasoning: 'disabled',
    specialist_review: 'none'
  },
  full: {
    planning_owner: 'ai-video-prompt-director',
    semantic_owner: 'ai-video-prompt-preflight',
    mechanical_owner: 'ai-video-prompt-preflight',
    global_reasoning: 'delta-only',
    specialist_review: 'domain-only'
  }
};

const CONTEXT_POLICY = Object.freeze({
  source_of_truth: 'orchestration_state',
  handoff_mode: 'state_patch_only',
  reference_read_policy: 'read_once_reuse_receipt',
  transcript_replay: 'forbidden',
  review_mode: 'owner_only'
});

function truthy(value) {
  return value === true || value === 1 || String(value || '').toLowerCase() === 'true';
}

function numberOr(value, fallback) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function inferPromptVariantCount(input = {}) {
  const explicit = Number(input.prompt_variant_count);
  if (Number.isInteger(explicit)) return Math.min(3, Math.max(1, explicit));
  const request = [input.user_request, input.request_text, input.instruction, input.prompt_request]
    .filter((value) => typeof value === 'string')
    .join('\n');
  if (!request) return 1;
  if (/(?:三种|三个|三份|三版|3\s*(?:种|个|份|版)?)\s*(?:不同的?)?\s*(?:提示词|版本|方案)|(?:提示词|版本|方案)\s*(?:各)?\s*(?:三种|三个|三份|三版|3\s*(?:种|个|份|版)?)/iu.test(request)) return 3;
  if (/(?:两种|两个|两份|两版|2\s*(?:种|个|份|版)?)\s*(?:不同的?)?\s*(?:提示词|版本|方案)|(?:提示词|版本|方案)\s*(?:各)?\s*(?:两种|两个|两份|两版|2\s*(?:种|个|份|版)?)|\bA\s*[\/]\s*B\s*(?:版|版本|方案)?\b/iu.test(request)) return 2;
  return 1;
}

function platformCompiler(input, depth) {
  const model = String(input.target_model || '').toLowerCase();
  const platform = String(input.platform || '').toLowerCase();
  if (/jimeng|dreamina|即梦/.test(`${platform} ${model}`)) return 'jimeng-sd2-prompting';
  if (depth === 'fast') return 'seedance-camera-group-compiler-fast';
  if (/seedance/.test(model) || /seedance|doubao|capcut|volcengine|byteplus/.test(platform)) return 'seedance-20';
  return 'seedance-20';
}

function arrayDelta(actual, expected) {
  const actualSet = new Set(Array.isArray(actual) ? actual : []);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((item) => !actualSet.has(item)),
    unexpected: [...actualSet].filter((item) => !expectedSet.has(item))
  };
}

function selectProcessingDepth(input = {}) {
  const activeCharacters = numberOr(input.active_character_count, Infinity);
  const locationCount = numberOr(input.location_count ?? input.scene_count, Infinity);
  const inputScope = String(input.input_scope || '');
  const platform = String(input.platform || '').toLowerCase();
  const mode = String(input.generation_mode || '').toLowerCase();
  const actionComplexity = String(input.action_complexity || '').toLowerCase();

  const fullSignals = [
    ['fight/chase/weapon/stunt', ['fight', 'chase', 'weapon_contact', 'stunt'].some((key) => truthy(input[key]))],
    ['VFX/transformation/destruction/simulation', ['vfx', 'transformation', 'destruction', 'simulation'].some((key) => truthy(input[key]))],
    ['complex multi-character blocking', activeCharacters >= 3 && (truthy(input.complex_blocking) || truthy(input.crowd))],
    ['cross-scene or cross-episode continuity', truthy(input.cross_scene_continuity) || truthy(input.cross_episode_continuity)],
    ['reference conflict or missing P0 evidence', truthy(input.reference_conflict) || truthy(input.missing_p0)],
    ['platform/domain research required', truthy(input.research_required) || truthy(input.platform_research_required)],
    ['generated-output retry', truthy(input.output_retry)],
    ['generated output review', truthy(input.generated_output_present)],
    ['performance or emotion direction', truthy(input.performance_required) || truthy(input.emotion_required)],
    ['relationship or dialogue direction', truthy(input.relationship_scene) || truthy(input.dialogue_intensive)],
    ['IP/likeness/safety review', truthy(input.ip_or_likeness_risk) || truthy(input.safety_required)],
    ['commercial/exhaustive delivery', truthy(input.commercial_exhaustive) || truthy(input.commercial_claims)]
  ].filter(([, active]) => active).map(([label]) => label);

  const requestedDepth = String(input.prompt_workflow_mode || input.prompt_depth_mode || '').toLowerCase();
  if (DEPTHS.has(requestedDepth)) {
    return {
      processing_depth: requestedDepth,
      depth_reasons: [`user-selected workflow mode: ${requestedDepth}`],
      depth_override: fullSignals.length > 0 && requestedDepth !== 'full',
      override_risk_signals: fullSignals.length > 0 && requestedDepth !== 'full' ? fullSignals : []
    };
  }
  if (fullSignals.length) return { processing_depth: 'full', depth_reasons: fullSignals };

  const fastChecks = [
    ['local or single-scene scope', inputScope === 'local_fragment_or_single_continuation_beat' || locationCount === 1],
    ['no more than two active characters', activeCharacters <= 2],
    ['simple non-contact action', ['none', 'simple', 'simple_non_contact', 'simple-non-contact'].includes(actionComplexity)],
    ['one location', locationCount === 1],
    ['assets sufficient', input.assets_sufficient === true],
    ['known supported target', /seedance|jimeng|dreamina|即梦/.test(`${String(input.target_model || '').toLowerCase()} ${platform}`)],
    ['simple T2V/I2V mode', FAST_MODES.has(mode)],
    ['no research or retry need', !truthy(input.research_required) && !truthy(input.output_retry)]
  ];
  if (fastChecks.every(([, passed]) => passed)) {
    return { processing_depth: 'fast', depth_reasons: fastChecks.map(([label]) => label) };
  }
  const failedFast = fastChecks.filter(([, passed]) => !passed).map(([label]) => `fast unavailable: ${label}`);
  return { processing_depth: 'standard', depth_reasons: failedFast.slice(0, 3).length ? failedFast.slice(0, 3) : ['default standard route'] };
}

function buildExecutionPlan(input = {}) {
  const selection = selectProcessingDepth(input);
  const depth = selection.processing_depth;
  const variantCount = inferPromptVariantCount(input);
  const complexity = PROMPT_COMPLEXITIES.has(String(input.prompt_description_complexity || '').toLowerCase())
    ? String(input.prompt_description_complexity).toLowerCase()
    : 'high';
  const compiler = platformCompiler(input, depth);
  let requiredSkills;
  if (depth === 'fast') {
    requiredSkills = [
      'script-camera-group-router',
      'narrative-camera-groups',
      compiler,
      'camera-group-preflight-fast'
    ];
  } else if (depth === 'standard') {
    requiredSkills = [
      'script-camera-group-router',
      'camera-group-director-standard',
      'narrative-camera-groups',
      compiler,
      'camera-group-preflight-standard'
    ];
  } else {
    requiredSkills = [
      'script-camera-group-router',
      'ai-video-prompt-director',
      'ai-video-production-governance',
      'cinematic-audiovisual-language',
      'professional-storyboard-director',
      'ai-material-realism',
      'cinematic-music-sound-design',
      'narrative-camera-groups',
      compiler,
      'ai-video-prompt-preflight'
    ];
    if (truthy(input.recurring_identity) || truthy(input.cross_scene_continuity) || truthy(input.reference_conflict)) {
      requiredSkills.push('character-continuity-bible');
    }
    if (['fight', 'chase', 'weapon_contact', 'stunt'].some((key) => truthy(input[key]))) {
      requiredSkills.push('action-choreography-reference', 'action-rhythm-editing');
      if (compiler === 'seedance-20') requiredSkills.push('seedance-fight-director');
    }
    if (['vfx', 'transformation', 'destruction', 'simulation'].some((key) => truthy(input[key]))) {
      requiredSkills.push('cinematic-vfx-director', 'vfx-effect-construction-engine');
      if (compiler === 'seedance-20') requiredSkills.push('seedance-vfx');
    }
    if (truthy(input.research_required) || truthy(input.platform_research_required)) requiredSkills.push('creative-research-first');
    if (truthy(input.generated_output_present) || truthy(input.output_retry)) {
      requiredSkills.push('ai-video-output-review');
    }
    if (truthy(input.output_retry)) requiredSkills.push('ai-video-iteration-doctor');
    if (truthy(input.performance_required)) requiredSkills.push('live-action-performance-direction');
    if (truthy(input.emotion_required)) requiredSkills.push('emotional-performance-direction');
    if (truthy(input.relationship_scene) || truthy(input.dialogue_intensive)) requiredSkills.push('relationship-dialogue-direction');
    if (truthy(input.ip_or_likeness_risk) || truthy(input.safety_required)) {
      if (compiler === 'seedance-20') requiredSkills.push('seedance-copyright', 'seedance-filter');
    }
  }
  requiredSkills = [...new Set(requiredSkills)];
  const forbiddenCompilers = PLATFORM_COMPILERS.filter((name) => name !== compiler);
  const fastForbidden = [
    'ai-video-prompt-director', 'ai-video-production-governance',
    'camera-group-director-standard',
    'professional-storyboard-director', 'cinematic-audiovisual-language',
    'character-continuity-bible',
    'ai-material-realism', 'cinematic-music-sound-design',
    'ai-video-prompt-preflight', 'creative-research-first'
  ];
  const standardForbidden = [
    'ai-video-prompt-director', 'ai-video-production-governance',
    'professional-storyboard-director', 'cinematic-audiovisual-language',
    'character-continuity-bible',
    'ai-material-realism', 'cinematic-music-sound-design',
    'camera-group-preflight-fast', 'ai-video-prompt-preflight',
    'creative-research-first'
  ];
  const fullForbidden = [
    'camera-group-director-standard',
    'camera-group-preflight-fast',
    'camera-group-preflight-standard'
  ];
  return {
    ...selection,
    prompt_workflow_mode: DEPTHS.has(String(input.prompt_workflow_mode || '').toLowerCase())
      ? String(input.prompt_workflow_mode).toLowerCase() : 'none',
    prompt_description_complexity: complexity,
    prompt_compilation_profile: PROMPT_COMPLEXITY_PROFILES[complexity],
    prompt_owner: 'narrative-camera-groups',
    platform_compiler: compiler,
    preflight_profile: depth,
    required_skills: requiredSkills,
    forbidden_skills: [...new Set([
      ...NEVER_CAMERA_GROUP_AUTHORS,
      ...forbiddenCompilers,
      ...(depth === 'fast' ? fastForbidden : []),
      ...(depth === 'standard' ? standardForbidden : []),
      ...(depth === 'full' ? fullForbidden : [])
    ])],
    max_prompt_compile_count: 1,
    prompt_variant_count: variantCount,
    review_budget: REVIEW_BUDGETS[depth],
    context_policy: CONTEXT_POLICY,
    research_owner: depth === 'full' && requiredSkills.includes('creative-research-first') ? 'creative-research-first' : null
  };
}

function issue(id, severity, detail, owner = 'director-workflow-70') {
  return { id, severity, detail, owner };
}

function appendSchemaFindings(state, errors) {
  if (stateSchemaValidator(state)) return;
  for (const finding of stateSchemaValidator.errors || []) {
    errors.push(issue(
      'SCHEMA-001',
      'P0',
      `state schema violation at ${finding.instancePath || '/'}: ${finding.message}`,
      'script-camera-group-router'
    ));
  }
}

function requiredControlSurfaces(contract, plan) {
  if (Number(contract?.contractVersion || 0) < 6 || !Array.isArray(contract?.surfaces)) return [];
  const activeSkills = new Set(plan?.required_skills || []);
  return contract.surfaces
    .filter((surface) => surface && surface.id && (
      surface.id === 'camera_group_route' ||
      surface.id === 'group_delivery' ||
      activeSkills.has(surface.owner) ||
      (surface.id === `audit_${plan?.preflight_profile}`)
    ))
    .map((surface) => ({ id: surface.id, owner: surface.owner }));
}

function validateState(state, contract = {}) {
  const errors = [];
  const warnings = [];
  const has = (key) => state && state[key] && typeof state[key] === 'object';

  appendSchemaFindings(state, errors);

  if (!has('TaskEnvelope')) errors.push(issue('STATE-001', 'P0', 'TaskEnvelope is missing'));
  if (!has('RouteReceipt')) errors.push(issue('ROUTE-001', 'P0', 'RouteReceipt is missing'));

  const envelope = state?.TaskEnvelope || {};
  const delivery = envelope.delivery_contract;
  if (!DELIVERY_CONTRACTS[delivery]) {
    errors.push(issue('TIME-001', 'P0', `unknown delivery_contract: ${delivery || '(missing)'}`));
  }
  const scriptScopes = new Set([
    'complete_script_or_multi_shot_sequence',
    'local_fragment_or_single_continuation_beat'
  ]);
  const isScriptDerived = delivery === 'liu_camera_group' ||
    scriptScopes.has(envelope.input_scope) ||
    /script|screenplay|storyboard|fragment|continuation/i.test(String(envelope.task_class || ''));
  if (isScriptDerived && envelope.output_format !== 'six_part') {
    errors.push(issue('ROUTE-003', 'P0', 'script-derived delivery requires output_format=six_part', 'ai-video-production-governance'));
  } else if (envelope.output_format !== undefined && typeof envelope.output_format !== 'string') {
    warnings.push(issue('ROUTE-004', 'P1', `invalid output_format type: ${typeof envelope.output_format}`, 'ai-video-production-governance'));
  }
  if (isScriptDerived) {
    if (!DEPTHS.has(envelope.processing_depth)) {
      errors.push(issue('ROUTE-005', 'P0', 'script-derived delivery requires processing_depth=fast|standard|full', 'ai-video-prompt-director'));
    }
    if (!Array.isArray(envelope.depth_reasons) || !envelope.depth_reasons.some((reason) => String(reason || '').trim())) {
      errors.push(issue('ROUTE-006', 'P0', 'processing depth requires at least one recorded reason', 'ai-video-prompt-director'));
    }
  }

  const receipt = state?.RouteReceipt || {};
  if (receipt.route_status !== 'complete') {
    errors.push(issue('ROUTE-002', 'P0', 'RouteReceipt.route_status must be complete'));
  }

  if (isScriptDerived) {
    const expectedPlan = buildExecutionPlan(envelope);
    const plan = state?.ExecutionPlan;
    if (!plan || typeof plan !== 'object') {
      errors.push(issue('PLAN-001', 'P0', 'ExecutionPlan is required for script-derived delivery', 'script-camera-group-router'));
    } else {
      if (plan.processing_depth !== expectedPlan.processing_depth || envelope.processing_depth !== expectedPlan.processing_depth) {
        errors.push(issue('PLAN-002', 'P0', `processing depth must be ${expectedPlan.processing_depth} for the recorded routing features`, 'script-camera-group-router'));
      }
      if (plan.prompt_owner !== 'narrative-camera-groups') {
        errors.push(issue('PLAN-003', 'P0', 'narrative-camera-groups must be the only camera-group prompt owner', 'script-camera-group-router'));
      }
      if (plan.platform_compiler !== expectedPlan.platform_compiler) {
        errors.push(issue('PLAN-004', 'P0', `platform compiler must be ${expectedPlan.platform_compiler}`, 'script-camera-group-router'));
      }
      const requiredDelta = arrayDelta(plan.required_skills, expectedPlan.required_skills);
      if (requiredDelta.missing.length || requiredDelta.unexpected.length) {
        errors.push(issue(
          'PLAN-007', 'P0',
          `required_skills differs from deterministic route; missing=[${requiredDelta.missing.join(', ')}], unexpected=[${requiredDelta.unexpected.join(', ')}]`,
          'script-camera-group-router'
        ));
      }
      const forbiddenDelta = arrayDelta(plan.forbidden_skills, expectedPlan.forbidden_skills);
      if (forbiddenDelta.missing.length || forbiddenDelta.unexpected.length) {
        errors.push(issue(
          'PLAN-008', 'P0',
          `forbidden_skills differs from deterministic route; missing=[${forbiddenDelta.missing.join(', ')}], unexpected=[${forbiddenDelta.unexpected.join(', ')}]`,
          'script-camera-group-router'
        ));
      }
      if (plan.preflight_profile !== expectedPlan.preflight_profile) {
        errors.push(issue('PLAN-009', 'P0', `preflight profile must be ${expectedPlan.preflight_profile}`, 'script-camera-group-router'));
      }
      if (plan.max_prompt_compile_count !== 1) {
        errors.push(issue('PLAN-010', 'P0', 'max_prompt_compile_count must be exactly 1', 'script-camera-group-router'));
      }
      const expectedReviewBudget = expectedPlan.review_budget;
      const reviewBudget = plan.review_budget;
      if (!reviewBudget || JSON.stringify(reviewBudget) !== JSON.stringify(expectedReviewBudget)) {
        errors.push(issue('PLAN-015', 'P0', 'review_budget must match the selected depth and assign each review layer to one owner', 'script-camera-group-router'));
      }
      if (!plan.context_policy || JSON.stringify(plan.context_policy) !== JSON.stringify(expectedPlan.context_policy)) {
        errors.push(issue('PLAN-017', 'P1', 'context_policy must enforce state-patch handoffs, one-read reference reuse, no transcript replay, and owner-only review', 'script-camera-group-router'));
      }
      if ((plan.research_owner ?? null) !== expectedPlan.research_owner) {
        errors.push(issue('PLAN-011', 'P0', `research owner must be ${expectedPlan.research_owner || 'none'}`, 'script-camera-group-router'));
      }
      if (Array.isArray(plan.required_skills) && new Set(plan.required_skills).size !== plan.required_skills.length) {
        errors.push(issue('PLAN-013', 'P0', 'required_skills must not contain duplicates', 'script-camera-group-router'));
      }
      if (Array.isArray(plan.forbidden_skills) && new Set(plan.forbidden_skills).size !== plan.forbidden_skills.length) {
        errors.push(issue('PLAN-014', 'P0', 'forbidden_skills must not contain duplicates', 'script-camera-group-router'));
      }
      const loaded = new Set(Array.isArray(receipt.instructions_read) ? receipt.instructions_read : []);
      for (const skill of expectedPlan.required_skills) {
        if (!loaded.has(skill)) errors.push(issue('PLAN-005', 'P0', `required skill was not loaded: ${skill}`, 'script-camera-group-router'));
      }
      for (const skill of expectedPlan.forbidden_skills) {
        if (loaded.has(skill)) errors.push(issue('PLAN-006', 'P0', `forbidden duplicate skill was loaded: ${skill}`, 'script-camera-group-router'));
      }
      const unexpectedLoaded = [...loaded].filter((skill) =>
        !expectedPlan.required_skills.includes(skill) && !expectedPlan.forbidden_skills.includes(skill)
      );
      if (unexpectedLoaded.length) {
        errors.push(issue('PLAN-016', 'P0', `instructions_read contains unplanned skills: ${unexpectedLoaded.join(', ')}`, 'script-camera-group-router'));
      }
      const loadedCompilers = PLATFORM_COMPILERS.filter((skill) => loaded.has(skill));
      if (loadedCompilers.length !== 1 || loadedCompilers[0] !== expectedPlan.platform_compiler) {
        errors.push(issue(
          'PLAN-012', 'P0',
          `exactly one selected platform compiler may be loaded; loaded=[${loadedCompilers.join(', ')}]`,
          'script-camera-group-router'
        ));
      }

      const researchReceipt = state?.ResearchReceipt;
      if (expectedPlan.research_owner) {
        if (!researchReceipt || typeof researchReceipt !== 'object') {
          errors.push(issue('RESEARCH-001', 'P0', 'planned research requires one ResearchReceipt', expectedPlan.research_owner));
        } else {
          if (researchReceipt.owner !== expectedPlan.research_owner) {
            errors.push(issue('RESEARCH-002', 'P0', `research receipt owner must be ${expectedPlan.research_owner}`, 'script-camera-group-router'));
          }
          if (researchReceipt.status !== 'complete' || researchReceipt.run_count !== 1) {
            errors.push(issue('RESEARCH-003', 'P0', 'research must complete in one owned run and be reused downstream', expectedPlan.research_owner));
          }
        }
      } else if (researchReceipt) {
        errors.push(issue('RESEARCH-004', 'P0', 'unplanned research receipt indicates an unnecessary research pass', 'script-camera-group-router'));
      }
    }
  }
  const owners = receipt.owner_by_control_surface;
  if (!owners || typeof owners !== 'object' || !Object.keys(owners).length) {
    errors.push(issue('OWNER-001', 'P0', 'owner_by_control_surface is empty'));
  } else {
    const duplicateOwners = Object.entries(owners)
      .filter(([, value]) => !value || typeof value !== 'string')
      .map(([key]) => key);
    if (duplicateOwners.length) {
      errors.push(issue('OWNER-002', 'P0', `owner entries must contain one skill name: ${duplicateOwners.join(', ')}`));
    }
    const plan = state?.ExecutionPlan;
    for (const surface of requiredControlSurfaces(contract, plan)) {
      if (owners[surface.id] !== surface.owner) {
        errors.push(issue('OWNER-003', 'P0', `control surface ${surface.id} must be owned by ${surface.owner}`, 'script-camera-group-router'));
      }
    }
  }

  if (delivery !== 'storyboard_only') {
    for (const key of ['StoryContract', 'ContinuityContract', 'InformationLedger', 'SpaceContract', 'ShotLedger']) {
      if (!has(key)) errors.push(issue('STATE-002', 'P0', `${key} is required for ${delivery}`));
    }
  }

  const groups = Array.isArray(state?.CameraGroupPlan) ? state.CameraGroupPlan : [];
  if (delivery === 'liu_camera_group' && !groups.length) {
    errors.push(issue('GROUP-001', 'P0', 'CameraGroupPlan is required for liu_camera_group'));
  }
  const range = DELIVERY_CONTRACTS[delivery];
  for (const group of groups) {
    if (typeof group.duration !== 'number' || group.duration < range.min || group.duration > range.max) {
      errors.push(issue('TIME-002', 'P0', `group ${group.group_id ?? '(unknown)'} duration ${group.duration} is outside ${range.min}-${range.max}s`));
    }
    for (const field of ['opening_state', 'ending_state', 'one_action_spine', 'first_frame_anchor', 'handoff_state']) {
      if (!String(group[field] || '').trim()) warnings.push(issue('GROUP-002', 'P1', `group ${group.group_id ?? '(unknown)'} missing ${field}`, 'narrative-camera-groups'));
    }
    const handoff = group.handoff_contract;
    if (!handoff || typeof handoff !== 'object') {
      errors.push(issue('HANDOFF-001', 'P0', `group ${group.group_id ?? '(unknown)'} requires a structured handoff_contract`, 'narrative-camera-groups'));
    } else {
      for (const field of ['opening_state_id', 'ending_state_id']) {
        if (!String(handoff[field] || '').trim()) errors.push(issue('HANDOFF-002', 'P0', `group ${group.group_id ?? '(unknown)'} handoff_contract is missing ${field}`, 'narrative-camera-groups'));
      }
      if (!handoff.continuity_locks || typeof handoff.continuity_locks !== 'object') {
        errors.push(issue('HANDOFF-003', 'P0', `group ${group.group_id ?? '(unknown)'} handoff_contract requires continuity_locks`, 'narrative-camera-groups'));
      }
    }
  }
  for (let index = 1; index < groups.length; index += 1) {
    const previous = groups[index - 1];
    const current = groups[index];
    if (String(previous.handoff_contract?.ending_state_id || '') !== String(current.handoff_contract?.opening_state_id || '')) {
      errors.push(issue('HANDOFF-004', 'P0', `camera-group handoff mismatch between ${previous.group_id} and ${current.group_id}`, 'narrative-camera-groups'));
    }
    if (String(previous.handoff_contract?.next_group_id ?? '') !== String(current.group_id)) {
      errors.push(issue('HANDOFF-005', 'P0', `group ${previous.group_id} does not point to next group ${current.group_id}`, 'narrative-camera-groups'));
    }
  }
  if (groups.length) {
    const last = groups[groups.length - 1];
    if (last.handoff_contract && last.handoff_contract.next_group_id !== null && last.handoff_contract.next_group_id !== undefined) {
      errors.push(issue('HANDOFF-006', 'P0', `last camera group ${last.group_id} must terminate with next_group_id=null`, 'narrative-camera-groups'));
    }
  }

  // CameraGroup is the director planning unit; GenerationSegment is the
  // platform submission unit. They are normally 1:1, but a group may fan out
  // only when a model-limit or complexity reason is recorded.
  const segments = Array.isArray(state?.GenerationSegmentPlan)
    ? state.GenerationSegmentPlan
    : [];
  if (segments.length) {
    const groupIds = new Set(groups.map((group) => String(group.group_id)));
    const segmentCountByGroup = new Map();
    for (const segment of segments) {
      const groupId = String(segment.group_id ?? '');
      if (!groupId || !groupIds.has(groupId)) {
        errors.push(issue('GEN-001', 'P0', `segment ${segment.segment_id ?? '(unknown)'} references an unknown group_id`, 'seedance-20'));
        continue;
      }
      if (typeof segment.duration !== 'number' || segment.duration <= 0) {
        errors.push(issue('GEN-002', 'P0', `segment ${segment.segment_id ?? '(unknown)'} lacks a positive duration`, 'seedance-20'));
      }
      segmentCountByGroup.set(groupId, (segmentCountByGroup.get(groupId) || 0) + 1);
    }
    for (const [groupId, count] of segmentCountByGroup) {
      if (count > 1) {
        const splitSegments = segments.filter((segment) => String(segment.group_id) === groupId);
        const justified = splitSegments.every((segment) =>
          ['model_limit', 'complexity', 'continuity'].includes(segment.split_basis) &&
          String(segment.split_reason || '').trim()
        );
        if (!justified) {
          errors.push(issue('GEN-003', 'P0', `group ${groupId} maps to ${count} generation segments without a model-limit/complexity/continuity reason`, 'seedance-20'));
        }
      }
      const group = groups.find((item) => String(item.group_id) === groupId);
      const splitSegments = segments
        .filter((segment) => String(segment.group_id) === groupId)
        .sort((a, b) => Number(a.segment_index || 0) - Number(b.segment_index || 0));
      const indexes = splitSegments.map((segment) => Number(segment.segment_index));
      if (indexes.some((value, index) => value !== index + 1)) {
        errors.push(issue('GEN-007', 'P0', `segment_index must be contiguous from 1 within group ${groupId}`, 'seedance-20'));
      }
      if (group && Math.abs(splitSegments.reduce((sum, segment) => sum + Number(segment.duration || 0), 0) - Number(group.duration)) > 0.051) {
        errors.push(issue('GEN-005', 'P0', `segments for group ${groupId} do not sum to the camera-group duration`, 'seedance-20'));
      }
      for (let index = 1; index < splitSegments.length; index += 1) {
        if (String(splitSegments[index - 1].ending_state) !== String(splitSegments[index].opening_state)) {
          errors.push(issue('GEN-006', 'P0', `segment handoff mismatch inside group ${groupId}`, 'seedance-20'));
        }
      }
    }
    for (const group of groups) {
      if (!segmentCountByGroup.has(String(group.group_id))) {
        warnings.push(issue('GEN-004', 'P1', `group ${group.group_id ?? '(unknown)'} has no GenerationSegmentPlan entry`, 'seedance-20'));
      }
    }
  }

  const shots = Array.isArray(state?.ShotLedger) ? state.ShotLedger : [];
  const previousEndByGroup = new Map();
  for (const shot of shots) {
    const groupId = shot.group_id;
    if (groupId === undefined || groupId === null || groupId === '') {
      errors.push(issue('GROUP-003', 'P0', `shot ${shot.shot_id ?? '(unknown)'} is missing group_id`, 'professional-storyboard-director'));
      continue;
    }
    if (typeof shot.start !== 'number' || typeof shot.end !== 'number' || typeof shot.duration !== 'number') {
      errors.push(issue('TIME-003', 'P0', `shot ${shot.shot_id ?? '(unknown)'} lacks numeric timing`, 'professional-storyboard-director'));
      continue;
    }
    if (Math.abs((shot.end - shot.start) - shot.duration) > 0.051) {
      errors.push(issue('TIME-004', 'P0', `shot ${shot.shot_id ?? '(unknown)'} duration does not match start/end`, 'professional-storyboard-director'));
    }
    const previousEnd = previousEndByGroup.get(String(groupId)) || 0;
    if (Math.abs(shot.start - previousEnd) > 0.051) {
      errors.push(issue('TIME-005', 'P0', `shot ${shot.shot_id ?? '(unknown)'} has a gap/overlap`, 'professional-storyboard-director'));
    }
    previousEndByGroup.set(String(groupId), shot.end);
  }

  const qc = state?.QCReport;
  const outputReviewRequired = truthy(envelope.generated_output_present) || truthy(envelope.output_retry);
  const outputReview = state?.OutputReview;
  if (outputReviewRequired) {
    if (!outputReview || typeof outputReview !== 'object') {
      errors.push(issue('REVIEW-001', 'P0', 'generated output review requires OutputReview', 'ai-video-output-review'));
    } else if (['failed', 'partial', 'blocked'].includes(outputReview.status)) {
      const retryPlan = state?.RetryPlan;
      if (!retryPlan || typeof retryPlan !== 'object' || !String(retryPlan.single_retry_variable || '').trim()) {
        errors.push(issue('REVIEW-002', 'P0', 'failed or partial output requires a RetryPlan with one single_retry_variable', 'ai-video-iteration-doctor'));
      }
    }
  }
  if (isScriptDerived && delivery !== 'storyboard_only') {
    if (!Array.isArray(state?.PlatformPromptSet) || !state.PlatformPromptSet.length) {
      errors.push(issue('PROMPT-003', 'P0', 'final script-derived delivery requires PlatformPromptSet', 'narrative-camera-groups'));
    } else {
      const groupIds = new Set(groups.map((group) => String(group.group_id)));
      const promptVariantsByGroup = new Map();
      const expectedVariantCount = Math.min(3, Math.max(1, Math.floor(numberOr(state?.ExecutionPlan?.prompt_variant_count ?? envelope.prompt_variant_count, 1))));
      for (const unit of state.PlatformPromptSet) {
        const id = String(unit?.group_id ?? '');
        if (!groupIds.has(id)) errors.push(issue('PROMPT-004', 'P0', `prompt unit references unknown group ${id || '(missing)'}`, 'narrative-camera-groups'));
        const variantId = String(unit?.variant_id || 'default');
        const variants = promptVariantsByGroup.get(id) || new Set();
        if (variants.has(variantId)) errors.push(issue('PROMPT-005', 'P0', `duplicate prompt variant ${variantId} exists for group ${id}`, 'narrative-camera-groups'));
        variants.add(variantId);
        promptVariantsByGroup.set(id, variants);
      }
      for (const group of groups) {
        const variants = promptVariantsByGroup.get(String(group.group_id));
        if (!variants?.size) errors.push(issue('PROMPT-006', 'P0', `group ${group.group_id} has no final prompt unit`, 'narrative-camera-groups'));
        else if (variants.size !== expectedVariantCount) errors.push(issue('PROMPT-012', 'P0', `group ${group.group_id} requires ${expectedVariantCount} distinct prompt variants`, 'narrative-camera-groups'));
      }
    }
    if (!qc || typeof qc !== 'object') {
      errors.push(issue('QC-002', 'P0', 'final script-derived delivery requires QCReport', 'ai-video-prompt-preflight'));
    } else if (qc.status === 'blocked') {
      errors.push(issue('QC-003', 'P0', 'QCReport is blocked', 'ai-video-prompt-preflight'));
    } else if (qc.status === 'needs_revision') {
      warnings.push(issue('QC-004', 'P1', 'QCReport requires revision before final delivery', 'ai-video-prompt-preflight'));
    }
  }
  if (qc && qc.status === 'pass' && errors.length) {
    errors.push(issue('QC-001', 'P0', 'QCReport claims pass while state has hard failures', 'ai-video-prompt-preflight'));
  }

  const maxCompileCount = state?.ExecutionPlan?.max_prompt_compile_count ?? 1;
  for (const unit of Array.isArray(state?.PlatformPromptSet) ? state.PlatformPromptSet : []) {
    if (unit.compile_count !== maxCompileCount) {
      errors.push(issue('PROMPT-001', 'P0', `group ${unit.group_id ?? '(unknown)'} must be compiled exactly once`, 'narrative-camera-groups'));
    }
    if (state?.ExecutionPlan?.platform_compiler && unit.compiled_by !== state.ExecutionPlan.platform_compiler) {
      errors.push(issue('PROMPT-002', 'P0', `group ${unit.group_id ?? '(unknown)'} was compiled by a non-selected compiler`, 'script-camera-group-router'));
    }
    const receipt = unit?.compilation_receipt;
    if (!receipt || typeof receipt !== 'object') {
      errors.push(issue('PROMPT-007', 'P0', `group ${unit.group_id ?? '(unknown)'} requires a compilation receipt`, 'script-camera-group-router'));
      continue;
    }
    if (receipt.compile_count !== 1) {
      errors.push(issue('PROMPT-008', 'P0', `group ${unit.group_id ?? '(unknown)'} receipt must record one compile`, 'script-camera-group-router'));
    }
    if (receipt.compiler !== state?.ExecutionPlan?.platform_compiler || receipt.compiler !== unit.compiled_by) {
      errors.push(issue('PROMPT-009', 'P0', `group ${unit.group_id ?? '(unknown)'} receipt compiler does not match`, 'script-camera-group-router'));
    }
    if (String(receipt.variant_id || 'default') !== String(unit.variant_id || 'default')) {
      errors.push(issue('PROMPT-013', 'P0', `group ${unit.group_id ?? '(unknown)'} receipt variant does not match`, 'script-camera-group-router'));
    }
    if (String(receipt.group_id ?? '') !== String(unit.group_id ?? '')) {
      errors.push(issue('PROMPT-014', 'P0', `group ${unit.group_id ?? '(unknown)'} receipt group does not match`, 'script-camera-group-router'));
    }
    if (receipt.processing_depth !== state?.ExecutionPlan?.processing_depth ||
        receipt.prompt_description_complexity !== state?.ExecutionPlan?.prompt_description_complexity) {
      errors.push(issue('PROMPT-010', 'P0', `group ${unit.group_id ?? '(unknown)'} receipt has stale workflow settings`, 'script-camera-group-router'));
    }
    const expectedHash = crypto.createHash('sha256').update(String(unit.prompt_text || ''), 'utf8').digest('hex');
    if (receipt.output_sha256 !== expectedHash) {
      errors.push(issue('PROMPT-011', 'P0', `group ${unit.group_id ?? '(unknown)'} prompt text does not match its receipt`, 'script-camera-group-router'));
    }
  }

  return {
    status: errors.length ? 'blocked' : warnings.length ? 'needs_revision' : 'pass',
    errors,
    warnings,
    contractVersion: contract.contractVersion || null
  };
}

function readState(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeTaskId(value) {
  return typeof value === 'string' ? value.replace(/^(?:local|cloud):/i, '').toLowerCase() : '';
}

function readJsonIfObject(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function promptContextPath({ threadId, cwd = process.cwd(), codexHome = process.env.CODEX_HOME || path.join(require('node:os').homedir(), '.codex') } = {}) {
  const id = normalizeTaskId(threadId);
  if (!id) return null;
  const legacyPath = typeof cwd === 'string' && cwd
    ? path.join(cwd, 'work', 'task-context.json') : '';
  const legacy = legacyPath ? readJsonIfObject(legacyPath) : null;
  return legacy && normalizeTaskId(legacy.threadId) === id
    ? legacyPath
    : path.join(codexHome, 'task-context', `${id}.json`);
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function readPromptCompilationReceipt({ threadId, cwd, codexHome } = {}) {
  const filePath = promptContextPath({ threadId, cwd, codexHome });
  const value = filePath ? readJsonIfObject(filePath) : null;
  const receipt = value?.prompt_compilation_receipt;
  return receipt && typeof receipt === 'object' && !Array.isArray(receipt) ? receipt : null;
}

function recordPromptCompilationReceipt({ threadId, cwd, codexHome, receipt } = {}) {
  const filePath = promptContextPath({ threadId, cwd, codexHome });
  if (!filePath || !receipt || typeof receipt !== 'object') return { recorded: false, receipt: null };
  const existing = readJsonIfObject(filePath);
  // Never replace an existing malformed task summary while trying to add telemetry.
  if (filePath.endsWith(`${path.sep}task-context.json`) && fs.existsSync(filePath) &&
      (!existing || normalizeTaskId(existing.threadId) !== normalizeTaskId(threadId))) {
    return { recorded: false, receipt: null };
  }
  const now = new Date().toISOString();
  const recordedReceipt = { ...receipt, recorded_at: now };
  const history = Array.isArray(existing?.prompt_compilation_receipts)
    ? existing.prompt_compilation_receipts.filter((item) => item && typeof item === 'object')
    : [];
  history.push(recordedReceipt);
  const next = {
    ...(existing || {
      threadId: normalizeTaskId(threadId), updatedAt: now, goal: '', progress: '', nextStep: '', agreements: []
    }),
    updatedAt: now,
    prompt_compilation_receipt: recordedReceipt,
    prompt_compilation_receipts: history.slice(-MAX_PROMPT_COMPILATION_RECEIPTS)
  };
  writeJsonAtomic(filePath, next);
  return { recorded: true, receipt: recordedReceipt };
}

function readPromptSettings({ threadId, cwd = process.cwd(), codexHome = process.env.CODEX_HOME || path.join(require('node:os').homedir(), '.codex') } = {}) {
  const id = normalizeTaskId(threadId);
  if (!id) return { workflow: 'none', complexity: 'high' };
  const legacyPath = typeof cwd === 'string' && cwd
    ? path.join(cwd, 'work', 'task-context.json') : '';
  const legacy = legacyPath ? readJsonIfObject(legacyPath) : null;
  const value = legacy && normalizeTaskId(legacy.threadId) === id
    ? legacy
    : readJsonIfObject(path.join(codexHome, 'task-context', `${id}.json`));
  // The UI writes both fields, but older summaries may only have processing_depth.
  // Read the current task file on every call so a generation never reuses stale UI state.
  const requestedWorkflow = value?.prompt_depth_mode ?? value?.processing_depth;
  const workflow = DEPTHS.has(requestedWorkflow) ? requestedWorkflow : 'none';
  const complexity = PROMPT_COMPLEXITIES.has(value?.prompt_description_complexity)
    ? value.prompt_description_complexity : 'high';
  return { workflow, complexity };
}

function isScriptDerivedPromptTask(input = {}) {
  const delivery = String(input.delivery_contract || '').toLowerCase();
  const scope = String(input.input_scope || '').toLowerCase();
  const taskClass = String(input.task_class || '').toLowerCase();
  return delivery === 'liu_camera_group' ||
    scope === 'complete_script_or_multi_shot_sequence' ||
    scope === 'local_fragment_or_single_continuation_beat' ||
    /script|screenplay|storyboard|camera.?group|分镜|剧本/.test(taskClass);
}

function preparePromptCompilation({ threadId, cwd, codexHome, input = {} } = {}) {
  const settings = readPromptSettings({ threadId, cwd, codexHome });
  const appliesToPrompt = isScriptDerivedPromptTask(input);
  const enrichedInput = appliesToPrompt ? {
    ...input,
    prompt_workflow_mode: settings.workflow,
    prompt_description_complexity: settings.complexity
  } : { ...input };
  const plan = buildExecutionPlan(enrichedInput);
  return { settings, appliesToPrompt, input: enrichedInput, plan };
}

function applyPromptCompilationProfile(promptText, profile) {
  if (typeof promptText !== 'string' || !promptText.trim()) throw new Error('提示词文本不能为空');
  if (!profile || profile.six_part !== true || profile.dialogue_accuracy !== 'exact' || profile.structure_completeness !== 'required') {
    throw new Error('提示词编译 profile 不完整');
  }
  const sectionNames = '(?:角色\\/资产锁定|视觉材质总控|镜头语言总控|事件节拍|声音|正向稳定约束)';
  const sections = promptText.split(new RegExp(`\\r?\\n(?=(?:【\\s*)?${sectionNames}(?:\\s*】)?\\s*[:：]?)`, 'u'));
  if (sections.length < 6) throw new Error('提示词必须包含六段式结构');
  let output = sections.join('\n');
  if (!profile.duration_limited) {
    output = output.replace(/(^|\n)\s*(?:时长|duration)\s*[：:][^\n]*/giu, '$1');
    // Low complexity keeps shot order but removes every hard timing expression.
    output = output.replace(/(^|\n)(\s*镜头\s*\d+\s*[｜|：:]?)\s*\d+(?:\.\d+)?\s*[-—至]\s*\d+(?:\.\d+)?\s*(?:秒|s)?\s*[｜|：:]?/giu, '$1$2');
    output = output.replace(/(^|\n)\s*第\s*\d+(?:\.\d+)?\s*[-—至]\s*\d+(?:\.\d+)?\s*秒(?:\s*[（(][^\n）)]*秒[）)])?\s*[：:]\s*/giu, '$1');
    output = output.replace(/\b\d+(?:\.\d+)?\s*[-—至]\s*\d+(?:\.\d+)?\s*秒\b/giu, '');
    output = output.replace(/(?:持续|停留|延续)\s*\d+(?:\.\d+)?\s*秒/giu, '');
  }
  if (!profile.microbeat_t_limited) {
    output = output.replace(/(^|\n)\s*T\s*=\s*[^：:\n]+[：:][^\n]*/giu, '$1');
  }
  output = output.replace(/\n{3,}/g, '\n\n').trim();
  if (!profile.duration_limited && /(?:\d+(?:\.\d+)?\s*(?:秒|s)|持续\s*\d+(?:\.\d+)?)/iu.test(output)) {
    throw new Error('低复杂度提示词仍包含时长控制，请移除后重新编译');
  }
  if (!profile.microbeat_t_limited && /(?:^|\n)\s*T\s*=/imu.test(output)) {
    throw new Error('当前复杂度不允许输出 T= 微节拍');
  }
  return output;
}

function preflightPromptForGeneration({ threadId, cwd, codexHome, input = {}, promptText = '', compiler } = {}) {
  const prepared = preparePromptCompilation({ threadId, cwd, codexHome, input });
  const selectedCompiler = prepared.plan.platform_compiler;
  const sourceText = typeof promptText === 'string' ? promptText.trim() : '';
  const issues = [];
  if (compiler && compiler !== selectedCompiler) {
    issues.push({
      code: 'COMPILER-MISMATCH',
      severity: 'P0',
      detail: `编译器 ${compiler} 与当前任务选择的 ${selectedCompiler} 不一致`
    });
  }

  if (!sourceText) {
    issues.push({ code: 'PROMPT-EMPTY', severity: 'P0', detail: '生成必须提供提示词文本' });
  }

  let compiledPrompt = prepared.appliesToPrompt ? '' : sourceText;
  if (prepared.appliesToPrompt) {
    if (sourceText) {
      try {
        compiledPrompt = applyPromptCompilationProfile(sourceText, prepared.plan.prompt_compilation_profile);
      } catch (error) {
        issues.push({ code: 'PROMPT-INVALID', severity: 'P0', detail: error.message });
      }
    }
  }

  return {
    status: issues.length ? 'blocked' : !prepared.appliesToPrompt ? 'not_applicable' : 'ready',
    threadId: normalizeTaskId(threadId),
    settings: prepared.settings,
    input: prepared.input,
    plan: prepared.plan,
    compiler: selectedCompiler,
    appliesToPrompt: prepared.appliesToPrompt,
    issues,
    source_chars: sourceText.length,
    compiled_chars: compiledPrompt.length,
    compiledPrompt
  };
}

function promptCompilationStatus({ threadId, cwd, codexHome, input = {}, compiler } = {}) {
  const prepared = preparePromptCompilation({ threadId, cwd, codexHome, input });
  if (!prepared.appliesToPrompt) {
    return { status: 'not_applicable', receipt: null, settings: prepared.settings, plan: prepared.plan };
  }
  const receipt = readPromptCompilationReceipt({ threadId, cwd, codexHome });
  if (!receipt) {
    return { status: 'uncompiled', receipt: null, settings: prepared.settings, plan: prepared.plan, reasons: ['missing compilation receipt'] };
  }
  const reasons = [];
  const receiptWorkflow = receipt.workflow_mode || receipt.processing_depth;
  if (receiptWorkflow !== prepared.settings.workflow) reasons.push('workflow changed');
  if (receipt.processing_depth !== prepared.plan.processing_depth) reasons.push('processing depth changed');
  if (receipt.prompt_description_complexity !== prepared.settings.complexity) reasons.push('complexity changed');
  const selectedCompiler = compiler || prepared.plan.platform_compiler;
  if (receipt.compiler !== selectedCompiler) reasons.push('compiler changed');
  return {
    status: reasons.length ? 'stale' : 'compiled',
    receipt,
    settings: prepared.settings,
    plan: prepared.plan,
    reasons
  };
}

/**
 * Single generation entry point. It reloads the active task settings immediately
 * before planning and applies the selected profile to the final prompt text.
 */
function compilePromptForGeneration({ threadId, cwd, codexHome, input = {}, promptText = '', compiler, groupId = null, variantId = 'default' } = {}) {
  const preflight = preflightPromptForGeneration({ threadId, cwd, codexHome, input, promptText, compiler });
  if (preflight.status === 'blocked') throw new Error(preflight.issues[0]?.detail || '生成前检查未通过');
  const { settings, input: enrichedInput, plan, compiler: selectedCompiler, compiledPrompt } = preflight;
  const sourceText = typeof promptText === 'string' ? promptText.trim() : '';
  const digest = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
  const compilationReceipt = {
    group_id: groupId,
    variant_id: String(variantId || 'default'),
    compiler: selectedCompiler,
    compile_count: 1,
    settings_read_at: new Date().toISOString(),
    workflow_mode: plan.prompt_workflow_mode,
    processing_depth: plan.processing_depth,
    prompt_description_complexity: settings.complexity,
    depth_override: Boolean(plan.depth_override),
    override_risk_signals: Array.isArray(plan.override_risk_signals) ? plan.override_risk_signals : [],
    input_sha256: digest(sourceText),
    output_sha256: digest(compiledPrompt),
    input_chars: sourceText.length,
    output_chars: compiledPrompt.length,
    estimated_input_tokens: Math.ceil(sourceText.length / 4),
    estimated_output_tokens: Math.ceil(compiledPrompt.length / 4),
    estimated_tokens_saved: Math.max(0, Math.ceil((sourceText.length - compiledPrompt.length) / 4))
  };
  const receiptWrite = preflight.appliesToPrompt
    ? recordPromptCompilationReceipt({ threadId, cwd, codexHome, receipt: compilationReceipt })
    : { recorded: false, receipt: null };
  return {
    threadId: normalizeTaskId(threadId),
    settings,
    input: enrichedInput,
    plan,
    compiler: selectedCompiler,
    promptText: compiledPrompt,
    appliesToPrompt: preflight.appliesToPrompt,
    compilationReceipt: receiptWrite.receipt || compilationReceipt,
    receiptRecorded: receiptWrite.recorded,
    generationSettings: {
      processing_depth: plan.processing_depth,
      prompt_description_complexity: settings.complexity,
      prompt_compilation_profile: plan.prompt_compilation_profile
    }
  };
}

module.exports = {
  DELIVERY_CONTRACTS,
  PROMPT_COMPLEXITY_PROFILES,
  inferPromptVariantCount,
  selectProcessingDepth,
  buildExecutionPlan,
  readPromptSettings,
  isScriptDerivedPromptTask,
  preparePromptCompilation,
  applyPromptCompilationProfile,
  preflightPromptForGeneration,
  promptCompilationStatus,
  compilePromptForGeneration,
  readPromptCompilationReceipt,
  recordPromptCompilationReceipt,
  validateState,
  readState
};
