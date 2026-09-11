const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { selectProcessingDepth, buildExecutionPlan, validateState, readPromptSettings, preparePromptCompilation, applyPromptCompilationProfile, preflightPromptForGeneration, promptCompilationStatus, compilePromptForGeneration, isScriptDerivedPromptTask, inferPromptVariantCount } = require('../src/orchestration');

const standardEnvelope = {
  task_class: 'script-to-storyboard',
  input_scope: 'complete_script_or_multi_shot_sequence',
  delivery_contract: 'liu_camera_group',
  output_format: 'six_part',
  processing_depth: 'standard',
  depth_reasons: ['fast unavailable: assets sufficient'],
  platform: 'seedance',
  generation_mode: 't2v'
};
const standardPlan = buildExecutionPlan(standardEnvelope);

const valid = {
  TaskEnvelope: standardEnvelope,
  ExecutionPlan: standardPlan,
  RouteReceipt: {
    task_class: standardEnvelope.task_class,
    active_mandatory_layers: standardPlan.required_skills,
    owner_by_control_surface: { grouping: 'narrative-camera-groups' },
    instructions_read: standardPlan.required_skills,
    route_status: 'complete'
  },
  StoryContract: { narrative_job: 'reveal', viewer_end_state: 'understand', major_beats: ['a'] },
  ContinuityContract: { identity_locks: {}, location_lock: 'hall', axis: 'A', screen_direction: 'L-R' },
  InformationLedger: [{ shot_id: 1, shot_function: 'carry dialogue', primary_carrier: 'actor', new_information: 'reply', handoff_to_next: 'eyeline' }],
  SpaceContract: { actor_positions: { a: 'left' }, axis: 'A', screen_direction: 'L-R', foreground_midground_background: {} },
  ShotLedger: [{
    group_id: 1, shot_id: 1, start: 0, end: 16, duration: 16,
    function: 'carry dialogue', shot_size: 'MS', camera_position: 'front',
    camera_height: 'eye', angle: 'level', lens: '50mm', focus_dof: 'subject sharp',
    lighting: 'soft key from left', movement: 'locked-off', action: 'speaks',
    performance: 'listens and answers', dialogue: 'line', cut_trigger: 'line ends',
    handoff: 'eyeline match', endpoint_state: 'b',
    micro_beats: [{ start: 0, end: 16, description: '完整动作节拍' }]
  }],
  CameraGroupPlan: [{
    group_id: 1,
    duration: 16,
    opening_state: 'a',
    ending_state: 'b',
    source_shots: [1],
    one_action_spine: 'a-b',
    first_frame_anchor: 'a',
    handoff_state: 'b',
    handoff_contract: {
      opening_state_id: 'state-a',
      ending_state_id: 'state-b',
      continuity_locks: { axis: 'A', screen_direction: 'L-R' },
      next_group_id: null
    }
  }],
  PlatformPromptSet: [{
    group_id: 1, standalone: true, prompt_text: '六段式完整提示词', compiled_by: 'seedance-20', compile_count: 1,
    variant_id: 'default',
    compilation_receipt: {
      group_id: 1, variant_id: 'default', compiler: 'seedance-20', compile_count: 1, settings_read_at: '2026-09-10T00:00:00.000Z',
      processing_depth: 'standard', prompt_description_complexity: 'high',
      input_sha256: 'a'.repeat(64), output_sha256: '26de58b3aab96429ffd6c5bef6144cb6d4e541bceb392b2d258947ef0d7270a7', input_chars: 10, output_chars: 8,
      estimated_input_tokens: 3, estimated_output_tokens: 2, estimated_tokens_saved: 1
    }
  }],
  PromptCompilationReceipt: {
    compiler: 'seedance-20', compile_count: 1, settings_read_at: '2026-09-10T00:00:00.000Z',
    processing_depth: 'standard', prompt_description_complexity: 'high',
    input_sha256: 'a'.repeat(64), output_sha256: 'b'.repeat(64), input_chars: 10, output_chars: 10,
    estimated_input_tokens: 3, estimated_output_tokens: 3, estimated_tokens_saved: 0
  },
  QCReport: { status: 'pass', hard_failures: [], warnings: [] }
};

test('validates a complete Liu camera-group state', () => {
  const result = validateState(valid, { contractVersion: 2 });
  assert.equal(result.status, 'pass');
  assert.equal(result.errors.length, 0);
});

test('builds a prompt compilation profile from the persisted task settings', () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'director-prompt-settings-'));
  const threadId = '01a08692-e8df-7772-8273-3fadd5f31454';
  fs.mkdirSync(path.join(codexHome, 'task-context'), { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'task-context', `${threadId}.json`), JSON.stringify({
    threadId, updatedAt: new Date().toISOString(), goal: '', progress: '', nextStep: '', agreements: [],
    prompt_depth_mode: 'fast', prompt_description_complexity: 'high'
  }));
  const prepared = preparePromptCompilation({
    threadId,
    codexHome,
    input: { task_class: 'script-to-storyboard', delivery_contract: 'liu_camera_group', output_format: 'six_part', platform: 'seedance', generation_mode: 't2v' }
  });
  assert.equal(prepared.settings.workflow, 'fast');
  assert.equal(prepared.settings.complexity, 'high');
  assert.equal(prepared.plan.processing_depth, 'fast');
  assert.equal(prepared.plan.prompt_compilation_profile.microbeat_t_limited, true);
  fs.rmSync(codexHome, { recursive: true, force: true });
});

test('applies low complexity rules without removing the six-part contract', () => {
  const source = '角色/资产锁定：a\n视觉材质总控：b\n镜头语言总控：c\n事件节拍：\n时长：16秒\n镜头01｜0-2s｜中景\n持续2秒完成动作\nT=0-1s：动作\n声音：d\n正向稳定约束：e';
  const result = applyPromptCompilationProfile(source, buildExecutionPlan({ prompt_description_complexity: 'low' }).prompt_compilation_profile);
  assert.match(result, /角色\/资产锁定/);
  assert.doesNotMatch(result, /T=0-1s|时长：16秒|0-2s|持续2秒/);
  assert.match(result, /镜头01/);
});

test('rejects residual timing controls after low complexity compilation', () => {
  const profile = buildExecutionPlan({ prompt_description_complexity: 'low' }).prompt_compilation_profile;
  assert.throws(
    () => applyPromptCompilationProfile('角色/资产锁定：a\n视觉材质总控：b\n镜头语言总控：c\n事件节拍：\n声音：d\n正向稳定约束：e\n3秒后切镜', profile),
    /时长控制/
  );
});

test('accepts Windows CRLF line endings in six-part prompts', () => {
  const source = '角色/资产锁定：a\r\n视觉材质总控：b\r\n镜头语言总控：c\r\n事件节拍：\r\n声音：d\r\n正向稳定约束：e';
  const result = applyPromptCompilationProfile(source, buildExecutionPlan({ prompt_description_complexity: 'high' }).prompt_compilation_profile);
  assert.match(result, /角色\/资产锁定/);
  assert.match(result, /正向稳定约束/);
});

test('compile entry rereads both task settings before every generation', () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'director-generation-settings-'));
  const threadId = '01a08692-e8df-7772-8273-3fadd5f31454';
  const contextDir = path.join(codexHome, 'task-context');
  fs.mkdirSync(contextDir, { recursive: true });
  const contextPath = path.join(contextDir, `${threadId}.json`);
  const base = {
    threadId, updatedAt: new Date().toISOString(), goal: '', progress: '', nextStep: '', agreements: [],
    prompt_depth_mode: 'fast', processing_depth: 'fast', prompt_description_complexity: 'low'
  };
  fs.writeFileSync(contextPath, JSON.stringify(base));
  const input = { task_class: 'script-to-storyboard', delivery_contract: 'liu_camera_group', output_format: 'six_part', platform: 'seedance', generation_mode: 't2v' };
  const prompt = '角色/资产锁定：a\n视觉材质总控：b\n镜头语言总控：c\n事件节拍：\n时长：16秒\nT=0-1s：动作\n声音：d\n正向稳定约束：e';
  const first = compilePromptForGeneration({ threadId, codexHome, input, promptText: prompt });
  assert.equal(first.settings.workflow, 'fast');
  assert.equal(first.settings.complexity, 'low');
  assert.equal(first.generationSettings.processing_depth, 'fast');
  assert.doesNotMatch(first.promptText, /T=0-1s|时长：16秒/);
  assert.equal(first.compilationReceipt.compile_count, 1);
  assert.equal(first.compilationReceipt.depth_override, false);
  assert.equal(first.compilationReceipt.estimated_tokens_saved > 0, true);
  assert.equal(first.receiptRecorded, true);
  const recorded = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  assert.equal(recorded.prompt_compilation_receipt.prompt_description_complexity, 'low');
  assert.equal(recorded.prompt_compilation_receipts.length, 1);
  assert.equal(promptCompilationStatus({ threadId, codexHome, input }).status, 'compiled');

  fs.writeFileSync(contextPath, JSON.stringify({ ...base, prompt_depth_mode: 'full', processing_depth: 'full', prompt_description_complexity: 'high' }));
  const second = compilePromptForGeneration({ threadId, codexHome, input, promptText: prompt });
  assert.equal(second.settings.workflow, 'full');
  assert.equal(second.settings.complexity, 'high');
  assert.equal(second.generationSettings.processing_depth, 'full');
  assert.match(second.promptText, /T=0-1s|时长：16秒/);
  assert.equal(promptCompilationStatus({ threadId, codexHome, input }).status, 'compiled');
  fs.rmSync(codexHome, { recursive: true, force: true });
});

test('receipt status treats the none workflow as distinct from standard processing depth', () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'director-none-receipt-'));
  const threadId = '01a08692-e8df-7772-8273-3fadd5f31454';
  const input = { task_class: 'script-to-storyboard', delivery_contract: 'liu_camera_group', output_format: 'six_part', platform: 'seedance', generation_mode: 't2v' };
  fs.mkdirSync(path.join(codexHome, 'task-context'), { recursive: true });
  const contextPath = path.join(codexHome, 'task-context', `${threadId}.json`);
  fs.writeFileSync(contextPath, JSON.stringify({ threadId, prompt_depth_mode: 'none', prompt_description_complexity: 'low', prompt_compilation_receipt: { workflow_mode: 'fast', processing_depth: 'standard', prompt_description_complexity: 'low', compiler: 'seedance-20' } }));
  assert.equal(promptCompilationStatus({ threadId, codexHome, input }).status, 'stale');
  fs.rmSync(codexHome, { recursive: true, force: true });
});

test('reports an uncompiled or stale route before generation', () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'director-receipt-status-'));
  const threadId = '01a08692-e8df-7772-8273-3fadd5f31454';
  const input = { task_class: 'script-to-storyboard', delivery_contract: 'liu_camera_group', output_format: 'six_part', platform: 'seedance', generation_mode: 't2v' };
  fs.mkdirSync(path.join(codexHome, 'task-context'), { recursive: true });
  const contextPath = path.join(codexHome, 'task-context', `${threadId}.json`);
  fs.writeFileSync(contextPath, JSON.stringify({ threadId, prompt_depth_mode: 'fast', processing_depth: 'fast', prompt_description_complexity: 'low' }));
  assert.equal(promptCompilationStatus({ threadId, codexHome, input }).status, 'uncompiled');
  fs.writeFileSync(contextPath, JSON.stringify({ threadId, prompt_depth_mode: 'fast', processing_depth: 'fast', prompt_description_complexity: 'low', prompt_compilation_receipt: { workflow_mode: 'fast', processing_depth: 'fast', prompt_description_complexity: 'high', compiler: 'seedance-camera-group-compiler-fast' } }));
  assert.equal(promptCompilationStatus({ threadId, codexHome, input }).status, 'stale');
  fs.rmSync(codexHome, { recursive: true, force: true });
});

test('generation preflight reports readiness and blocks invalid script prompts', () => {
  const threadId = '01a08692-e8df-7772-8273-3fadd5f31454';
  const input = { task_class: 'script-to-storyboard', delivery_contract: 'liu_camera_group', output_format: 'six_part', platform: 'seedance', generation_mode: 't2v' };
  const empty = preflightPromptForGeneration({ threadId, input });
  assert.equal(empty.status, 'blocked');
  assert.equal(empty.issues[0].code, 'PROMPT-EMPTY');

  const ready = preflightPromptForGeneration({
    threadId,
    input,
    promptText: '角色/资产锁定：a\n视觉材质总控：b\n镜头语言总控：c\n事件节拍：d\n声音：e\n正向稳定约束：f'
  });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.appliesToPrompt, true);
  assert.equal(ready.issues.length, 0);
  assert.equal(typeof ready.compiledPrompt, 'string');

  const nonScript = preflightPromptForGeneration({
    threadId,
    input: { task_class: 'product-image-prompt', delivery_contract: 'platform_specific' },
    promptText: '自由格式提示词'
  });
  assert.equal(nonScript.status, 'not_applicable');
  assert.equal(nonScript.appliesToPrompt, false);

  const emptyNonScript = preflightPromptForGeneration({
    threadId,
    input: { task_class: 'product-image-prompt', delivery_contract: 'platform_specific' }
  });
  assert.equal(emptyNonScript.status, 'blocked');
  assert.equal(emptyNonScript.issues[0].code, 'PROMPT-EMPTY');
});

test('MCP compile tool returns prompt text using the current task profile', async () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'director-mcp-settings-'));
  const threadId = '01a08692-e8df-7772-8273-3fadd5f31454';
  fs.mkdirSync(path.join(codexHome, 'task-context'), { recursive: true });
  const contextPath = path.join(codexHome, 'task-context', `${threadId}.json`);
  const input = { task_class: 'script-to-storyboard', delivery_contract: 'liu_camera_group', output_format: 'six_part', platform: 'seedance', generation_mode: 't2v' };
  const prompt = '角色/资产锁定：a\n视觉材质总控：b\n镜头语言总控：c\n事件节拍：\n时长：16秒\nT=0-1s：动作\n声音：d\n正向稳定约束：e';
  fs.writeFileSync(contextPath, JSON.stringify({ threadId, prompt_depth_mode: 'fast', processing_depth: 'fast', prompt_description_complexity: 'low' }));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'mcp', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, CODEX_HOME: codexHome, SKILL_CONSOLE_AUTOSTART: '0' },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let buffer = '';
  const responses = [];
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
      if (line) responses.push(JSON.parse(line));
    }
  });
  const request = (id, name, args) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`MCP timeout for ${name}`)), 3000);
    const check = () => {
      const found = responses.findIndex((item) => item.id === id);
      if (found < 0) return setTimeout(check, 5);
      clearTimeout(timer); resolve(responses.splice(found, 1)[0]);
    };
    check();
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`);
  });
  const preflight = await request(0, 'skill_console_prompt_preflight', { threadId, codexHome, input, promptText: prompt });
  const preflightPayload = JSON.parse(preflight.result.content[0].text);
  assert.equal(preflightPayload.status, 'ready');
  assert.equal(preflightPayload.settings.complexity, 'low');
  const first = await request(1, 'skill_console_compile_prompt', { threadId, codexHome, input, promptText: prompt, groupId: 1 });
  const firstPayload = JSON.parse(first.result.content[0].text);
  assert.equal(firstPayload.generationSettings.prompt_description_complexity, 'low');
  assert.doesNotMatch(firstPayload.promptText, /T=0-1s|时长：16秒/);
  assert.equal(firstPayload.receiptRecorded, true);
  const statusResponse = await request(2, 'skill_console_prompt_compilation_status', { threadId, codexHome, input });
  const statusPayload = JSON.parse(statusResponse.result.content[0].text);
  assert.equal(statusPayload.status, 'compiled');
  fs.writeFileSync(contextPath, JSON.stringify({ threadId, prompt_depth_mode: 'full', processing_depth: 'full', prompt_description_complexity: 'high' }));
  const second = await request(3, 'skill_console_compile_prompt', { threadId, codexHome, input, promptText: prompt, groupId: 1 });
  const secondPayload = JSON.parse(second.result.content[0].text);
  assert.equal(secondPayload.generationSettings.prompt_description_complexity, 'high');
  assert.match(secondPayload.promptText, /T=0-1s|时长：16秒/);
  const variants = await request(4, 'skill_console_prompt_compilation_context', {
    threadId, codexHome, input: { ...input, user_request: '同一组给两个版本' }
  });
  const variantPayload = JSON.parse(variants.result.content[0].text);
  assert.equal(variantPayload.plan.prompt_variant_count, 2);
  child.kill();
  fs.rmSync(codexHome, { recursive: true, force: true });
});

test('prompt settings stay isolated from non-script tasks', () => {
  assert.equal(isScriptDerivedPromptTask({ task_class: 'product-image-prompt', delivery_contract: 'platform_specific' }), false);
  const prompt = '自由格式平台提示词\n时长：16秒\nT=0-1s：动作';
  const result = compilePromptForGeneration({
    threadId: '01a08692-e8df-7772-8273-3fadd5f31454',
    input: { task_class: 'product-image-prompt', delivery_contract: 'platform_specific', platform: 'seedance' },
    promptText: prompt
  });
  assert.equal(result.appliesToPrompt, false);
  assert.equal(result.promptText, prompt);
});

test('blocks missing state and invalid group duration', () => {
  const result = validateState({
    TaskEnvelope: { task_class: 'x', delivery_contract: 'liu_camera_group' },
    RouteReceipt: { route_status: 'incomplete', owner_by_control_surface: {} },
    CameraGroupPlan: [{ group_id: 1, duration: 40 }]
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'TIME-002'));
  assert.ok(result.errors.some((item) => item.id === 'STATE-002'));
});

test('requires a reason when one camera group splits into several generation segments', () => {
  const result = validateState({
    ...valid,
    GenerationSegmentPlan: [
      { segment_id: '1a', group_id: 1, segment_index: 1, duration: 8, opening_state: 'a', ending_state: 'mid' },
      { segment_id: '1b', group_id: 1, segment_index: 2, duration: 8, opening_state: 'mid', ending_state: 'b' }
    ]
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'GEN-003'));
});

test('accepts a justified camera-group split', () => {
  const result = validateState({
    ...valid,
    GenerationSegmentPlan: [
      { segment_id: '1a', group_id: 1, segment_index: 1, duration: 8, opening_state: 'a', ending_state: 'mid', split_basis: 'model_limit', split_reason: 'verified 8s surface cap' },
      { segment_id: '1b', group_id: 1, segment_index: 2, duration: 8, opening_state: 'mid', ending_state: 'b', split_basis: 'model_limit', split_reason: 'verified 8s surface cap' }
    ]
  });
  assert.equal(result.status, 'pass');
});

test('rejects a local script fragment routed to a natural paragraph', () => {
  const envelope = {
    ...valid.TaskEnvelope,
    input_scope: 'local_fragment_or_single_continuation_beat',
    output_format: 'natural_paragraph'
  };
  const result = validateState({
    ...valid,
    TaskEnvelope: envelope,
    ExecutionPlan: buildExecutionPlan(envelope)
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'ROUTE-003'));
});

test('requires an auditable automatic processing depth', () => {
  const result = validateState({
    ...valid,
    TaskEnvelope: {
      ...valid.TaskEnvelope,
      processing_depth: 'turbo',
      depth_reasons: []
    }
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'ROUTE-005'));
  assert.ok(result.errors.some((item) => item.id === 'ROUTE-006'));
});

test('selects fast before heavy skills for a proven low-risk fragment', () => {
  const envelope = {
    task_class: 'script-to-storyboard',
    input_scope: 'local_fragment_or_single_continuation_beat',
    delivery_contract: 'liu_camera_group',
    output_format: 'six_part',
    platform: 'seedance',
    target_model: 'seedance 2.5',
    generation_mode: 't2v',
    active_character_count: 2,
    location_count: 1,
    action_complexity: 'simple_non_contact',
    assets_sufficient: true
  };
  const selection = selectProcessingDepth(envelope);
  assert.equal(selection.processing_depth, 'fast');
  const plan = buildExecutionPlan(envelope);
  assert.deepEqual(plan.required_skills, [
    'script-camera-group-router',
    'narrative-camera-groups',
    'seedance-camera-group-compiler-fast',
    'camera-group-preflight-fast'
  ]);
  assert.ok(plan.forbidden_skills.includes('ai-video-prompt-director'));
  assert.ok(plan.forbidden_skills.includes('ai-video-prompt-preflight'));
});

test('upgrades to full when one high-risk signal appears', () => {
  const plan = buildExecutionPlan({
    ...standardEnvelope,
    fight: true,
    active_character_count: 2,
    location_count: 1,
    action_complexity: 'complex',
    assets_sufficient: true
  });
  assert.equal(plan.processing_depth, 'full');
  assert.ok(plan.required_skills.includes('action-choreography-reference'));
  assert.ok(plan.required_skills.includes('seedance-fight-director'));
});

test('keeps the selected platform compiler when Jimeng is used with fast workflow', () => {
  const plan = buildExecutionPlan({
    task_class: 'script-to-storyboard',
    input_scope: 'local_fragment_or_single_continuation_beat',
    delivery_contract: 'liu_camera_group',
    output_format: 'six_part',
    platform: '即梦',
    prompt_workflow_mode: 'fast',
    generation_mode: 't2v'
  });
  assert.equal(plan.processing_depth, 'fast');
  assert.equal(plan.platform_compiler, 'jimeng-sd2-prompting');
  assert.ok(plan.required_skills.includes('jimeng-sd2-prompting'));
  assert.ok(!plan.forbidden_skills.includes('jimeng-sd2-prompting'));
});

test('automatically selects fast for a low-risk Jimeng fragment', () => {
  const plan = buildExecutionPlan({
    task_class: 'script-to-storyboard',
    input_scope: 'local_fragment_or_single_continuation_beat',
    delivery_contract: 'liu_camera_group',
    output_format: 'six_part',
    platform: '即梦',
    generation_mode: 't2v',
    active_character_count: 2,
    location_count: 1,
    action_complexity: 'simple_non_contact',
    assets_sufficient: true
  });
  assert.equal(plan.processing_depth, 'fast');
  assert.equal(plan.platform_compiler, 'jimeng-sd2-prompting');
});

test('records when a manual workflow overrides a high-risk signal', () => {
  const plan = buildExecutionPlan({
    ...standardEnvelope,
    prompt_workflow_mode: 'fast',
    fight: true
  });
  assert.equal(plan.processing_depth, 'fast');
  assert.equal(plan.depth_override, true);
  assert.deepEqual(plan.override_risk_signals, ['fight/chase/weapon/stunt']);
});

test('routes performance, relationship, and safety signals to full specialists', () => {
  const plan = buildExecutionPlan({
    ...standardEnvelope,
    performance_required: true,
    emotion_required: true,
    relationship_scene: true,
    ip_or_likeness_risk: true,
    safety_required: true
  });
  assert.equal(plan.processing_depth, 'full');
  assert.ok(plan.required_skills.includes('live-action-performance-direction'));
  assert.ok(plan.required_skills.includes('emotional-performance-direction'));
  assert.ok(plan.required_skills.includes('relationship-dialogue-direction'));
  assert.ok(plan.required_skills.includes('seedance-copyright'));
  assert.ok(plan.required_skills.includes('seedance-filter'));
});

test('rejects a broken camera-group handoff chain', () => {
  const result = validateState({
    ...valid,
    CameraGroupPlan: [
      valid.CameraGroupPlan[0],
      {
        ...valid.CameraGroupPlan[0],
        group_id: 2,
        opening_state: 'c',
        ending_state: 'd',
        handoff_contract: {
          opening_state_id: 'state-c',
          ending_state_id: 'state-d',
          continuity_locks: {},
          next_group_id: null
        }
      }
    ]
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'HANDOFF-004'));
  assert.ok(result.errors.some((item) => item.id === 'HANDOFF-005'));
});

test('rejects non-contiguous generation segment indexes', () => {
  const result = validateState({
    ...valid,
    GenerationSegmentPlan: [
      { segment_id: '1a', group_id: 1, segment_index: 1, duration: 8, opening_state: 'a', ending_state: 'mid', split_basis: 'model_limit', split_reason: 'verified cap' },
      { segment_id: '1b', group_id: 1, segment_index: 3, duration: 8, opening_state: 'mid', ending_state: 'b', split_basis: 'model_limit', split_reason: 'verified cap' }
    ]
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'GEN-007'));
});

test('requires output review and a single-variable retry plan after generation', () => {
  const envelope = { ...standardEnvelope, generated_output_present: true };
  const plan = buildExecutionPlan(envelope);
  assert.ok(plan.required_skills.includes('ai-video-output-review'));
  assert.equal(plan.required_skills.includes('ai-video-iteration-doctor'), false);
  envelope.processing_depth = plan.processing_depth;
  envelope.depth_reasons = plan.depth_reasons;
  const state = {
    ...valid,
    TaskEnvelope: envelope,
    ExecutionPlan: plan,
    RouteReceipt: { ...valid.RouteReceipt, active_mandatory_layers: plan.required_skills, instructions_read: plan.required_skills }
  };
  const missingReview = validateState(state);
  assert.ok(missingReview.errors.some((item) => item.id === 'REVIEW-001'));

  const missingRetry = validateState({
    ...state,
    OutputReview: { status: 'failed', findings: ['character drift'] }
  });
  assert.ok(missingRetry.errors.some((item) => item.id === 'REVIEW-002'));

  const accepted = validateState({
    ...state,
    OutputReview: { status: 'failed', findings: ['character drift'] },
    RetryPlan: { single_retry_variable: 'identity_lock', attempt: 1 }
  });
  assert.equal(accepted.errors.some((item) => item.id === 'REVIEW-002'), false);
});

test('blocks heavy duplicate skills on a fast receipt', () => {
  const envelope = {
    task_class: 'script-to-storyboard', input_scope: 'local_fragment_or_single_continuation_beat',
    delivery_contract: 'liu_camera_group', output_format: 'six_part',
    platform: 'seedance', target_model: 'seedance 2.5', generation_mode: 't2v',
    active_character_count: 1, location_count: 1,
    action_complexity: 'none', assets_sufficient: true
  };
  const plan = buildExecutionPlan(envelope);
  envelope.processing_depth = plan.processing_depth;
  envelope.depth_reasons = plan.depth_reasons;
  const result = validateState({
    ...valid,
    TaskEnvelope: envelope,
    ExecutionPlan: plan,
    RouteReceipt: {
      ...valid.RouteReceipt,
      instructions_read: [...plan.required_skills, 'ai-video-prompt-director']
    }
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PLAN-006'));
});

test('rejects a tampered declared plan and compile budget', () => {
  const result = validateState({
    ...valid,
    ExecutionPlan: {
      ...standardPlan,
      required_skills: standardPlan.required_skills.filter((name) => name !== 'camera-group-director-standard'),
      max_prompt_compile_count: 2
    }
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PLAN-007'));
  assert.ok(result.errors.some((item) => item.id === 'PLAN-010'));
});

test('rejects a context policy that permits transcript replay or duplicate review', () => {
  const result = validateState({
    ...valid,
    ExecutionPlan: {
      ...standardPlan,
      context_policy: { ...standardPlan.context_policy, transcript_replay: 'allowed' }
    }
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PLAN-017'));
});

test('rejects duplicate entries in a declared execution plan', () => {
  const result = validateState({
    ...valid,
    ExecutionPlan: {
      ...standardPlan,
      required_skills: [...standardPlan.required_skills, 'seedance-20']
    }
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PLAN-013'));
});

test('blocks incomplete final delivery instead of returning a false pass', () => {
  const incomplete = { ...valid, PlatformPromptSet: undefined, QCReport: undefined };
  const result = validateState(incomplete);
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PROMPT-003'));
  assert.ok(result.errors.some((item) => item.id === 'QC-002'));
});

test('does not allow explicit user formatting to bypass six-part script delivery', () => {
  const envelope = {
    ...valid.TaskEnvelope,
    input_scope: 'explicit_user_format',
    output_format: 'natural_paragraph'
  };
  const result = validateState({ ...valid, TaskEnvelope: envelope, ExecutionPlan: buildExecutionPlan(envelope) });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'ROUTE-003'));
  assert.ok(result.errors.some((item) => item.id === 'SCHEMA-001'));
});

test('blocks unplanned loaded skills and broken segment duration', () => {
  const envelope = { ...valid.TaskEnvelope, fight: true, action_complexity: 'complex' };
  const plan = buildExecutionPlan(envelope);
  envelope.processing_depth = plan.processing_depth;
  envelope.depth_reasons = plan.depth_reasons;
  const result = validateState({
    ...valid,
    TaskEnvelope: envelope,
    ExecutionPlan: plan,
    RouteReceipt: { ...valid.RouteReceipt, instructions_read: [...plan.required_skills, 'unplanned-extra-skill'] },
    GenerationSegmentPlan: [
      { segment_id: '1a', group_id: 1, segment_index: 1, duration: 5, opening_state: 'a', ending_state: 'mid', split_basis: 'model_limit', split_reason: 'verified cap' },
      { segment_id: '1b', group_id: 1, segment_index: 2, duration: 5, opening_state: 'other', ending_state: 'b', split_basis: 'model_limit', split_reason: 'verified cap' }
    ]
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PLAN-016'));
  assert.ok(result.errors.some((item) => item.id === 'GEN-005'));
  assert.ok(result.errors.some((item) => item.id === 'GEN-006'));
});

test('uses the standard preflight and exactly one selected compiler', () => {
  assert.deepEqual(standardPlan.required_skills, [
    'script-camera-group-router',
    'camera-group-director-standard',
    'narrative-camera-groups',
    'seedance-20',
    'camera-group-preflight-standard'
  ]);
  assert.ok(standardPlan.required_skills.includes('camera-group-preflight-standard'));
  assert.equal(standardPlan.required_skills.includes('ai-video-prompt-preflight'), false);
  const result = validateState({
    ...valid,
    RouteReceipt: {
      ...valid.RouteReceipt,
      instructions_read: [...standardPlan.required_skills, 'jimeng-sd2-prompting']
    }
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PLAN-012'));
});

test('assigns one review owner per layer without changing the delivery contract', () => {
  assert.deepEqual(standardPlan.review_budget, {
    planning_owner: 'camera-group-director-standard',
    semantic_owner: 'camera-group-preflight-standard',
    mechanical_owner: 'camera-group-preflight-standard',
    global_reasoning: 'disabled',
    specialist_review: 'none'
  });
  const result = validateState({
    ...valid,
    ExecutionPlan: {
      ...standardPlan,
      review_budget: { ...standardPlan.review_budget, mechanical_owner: 'narrative-camera-groups' }
    }
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PLAN-015'));
});

test('gives an explicitly named Jimeng surface compiler priority', () => {
  const plan = buildExecutionPlan({
    ...standardEnvelope,
    platform: '即梦 Dreamina',
    target_model: 'Seedance 2.0'
  });
  assert.equal(plan.platform_compiler, 'jimeng-sd2-prompting');
  assert.ok(plan.forbidden_skills.includes('seedance-20'));
});

test('requires one reusable research receipt only on a research route', () => {
  const envelope = {
    ...standardEnvelope,
    research_required: true,
    processing_depth: 'full',
    depth_reasons: ['platform/domain research required']
  };
  const plan = buildExecutionPlan(envelope);
  const state = {
    ...valid,
    TaskEnvelope: envelope,
    ExecutionPlan: plan,
    RouteReceipt: { ...valid.RouteReceipt, instructions_read: plan.required_skills }
  };
  const missing = validateState(state);
  assert.ok(missing.errors.some((item) => item.id === 'RESEARCH-001'));

  const accepted = validateState({
    ...state,
    PromptCompilationReceipt: { ...valid.PromptCompilationReceipt, processing_depth: 'full' },
    PlatformPromptSet: [{
      ...valid.PlatformPromptSet[0],
      compilation_receipt: { ...valid.PlatformPromptSet[0].compilation_receipt, processing_depth: 'full' }
    }],
    ResearchReceipt: {
      owner: 'creative-research-first',
      status: 'complete',
      run_count: 1,
      query_scope: 'active platform capability only',
      source_ids: ['official-doc-1'],
      reused_by: ['seedance-20', 'ai-video-prompt-preflight']
    }
  });
  assert.equal(accepted.status, 'pass');
});

test('rejects a second prompt compilation or a non-selected compiler', () => {
  const result = validateState({
    ...valid,
    PlatformPromptSet: [{
      group_id: 1,
      standalone: true,
      prompt_text: 'six-part prompt',
      compiled_by: 'jimeng-sd2-prompting',
      compile_count: 2
    }]
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((item) => item.id === 'PROMPT-001'));
  assert.ok(result.errors.some((item) => item.id === 'PROMPT-002'));
});

test('requires a current prompt compilation receipt for final script delivery', () => {
  const missing = validateState({
    ...valid,
    PlatformPromptSet: [{ ...valid.PlatformPromptSet[0], compilation_receipt: undefined }]
  });
  assert.equal(missing.status, 'blocked');
  assert.ok(missing.errors.some((item) => item.id === 'PROMPT-007'));

  const stale = validateState({
    ...valid,
    PromptCompilationReceipt: { ...valid.PromptCompilationReceipt, prompt_description_complexity: 'low' },
    PlatformPromptSet: [{ ...valid.PlatformPromptSet[0], compilation_receipt: { ...valid.PlatformPromptSet[0].compilation_receipt, prompt_description_complexity: 'low' } }]
  });
  assert.equal(stale.status, 'blocked');
  assert.ok(stale.errors.some((item) => item.id === 'PROMPT-010'));
});

test('allows explicitly requested prompt variants with independent receipts', () => {
  const plan = buildExecutionPlan({ ...standardEnvelope, prompt_variant_count: 2 });
  const variantBText = '六段式完整提示词 B';
  const variantBHash = require('node:crypto').createHash('sha256').update(variantBText, 'utf8').digest('hex');
  const variantB = {
    ...valid.PlatformPromptSet[0],
    variant_id: 'B',
    prompt_text: variantBText,
    compilation_receipt: { ...valid.PlatformPromptSet[0].compilation_receipt, variant_id: 'B', output_sha256: variantBHash }
  };
  const state = {
    ...valid,
    TaskEnvelope: { ...standardEnvelope, prompt_variant_count: 2 },
    ExecutionPlan: plan,
    RouteReceipt: { ...valid.RouteReceipt, instructions_read: plan.required_skills },
    PlatformPromptSet: [{ ...valid.PlatformPromptSet[0], variant_id: 'A', compilation_receipt: { ...valid.PlatformPromptSet[0].compilation_receipt, variant_id: 'A' } }, variantB]
  };
  assert.equal(validateState(state).status, 'pass');

  const duplicate = { ...state, PlatformPromptSet: [{ ...state.PlatformPromptSet[0] }, { ...state.PlatformPromptSet[0] }] };
  assert.ok(validateState(duplicate).errors.some((item) => item.id === 'PROMPT-005'));
});

test('infers only explicit two or three prompt variant requests', () => {
  assert.equal(inferPromptVariantCount({ user_request: '这个片段出两种提示词' }), 2);
  assert.equal(inferPromptVariantCount({ request_text: '给我三版不同方案' }), 3);
  assert.equal(inferPromptVariantCount({ instruction: '给出 A/B 版' }), 2);
  assert.equal(inferPromptVariantCount({ user_request: '两个人说三句话，拆分镜提示词' }), 1);
  assert.equal(buildExecutionPlan({ ...standardEnvelope, user_request: '同一组给两个版本' }).prompt_variant_count, 2);
  assert.equal(inferPromptVariantCount({ prompt_variant_count: 9, user_request: '一版即可' }), 3);
});

test('rejects a receipt attached to the wrong camera group', () => {
  const state = {
    ...valid,
    PlatformPromptSet: [{
      ...valid.PlatformPromptSet[0],
      compilation_receipt: { ...valid.PlatformPromptSet[0].compilation_receipt, group_id: 99 }
    }]
  };
  assert.ok(validateState(state).errors.some((item) => item.id === 'PROMPT-014'));
});
