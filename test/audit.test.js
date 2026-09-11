const test = require('node:test');
const assert = require('node:assert/strict');
const { auditIndex } = require('../src/audit');

function skill(name, content = '# Skill') {
  return { name, content, references: [], filePath: `${name}/SKILL.md`, directory: name };
}

function contract(overrides = {}) {
  return {
    contractVersion: 2,
    rules: {
      stateChain: ['TaskEnvelope', 'RouteReceipt'],
      deliveryContracts: {
        liu_camera_group: { min: 14, max: 28, hardMax: 30 },
        generic_seedance_clip: { min: 4, max: 15 },
        storyboard_only: { min: 0, max: null }
      },
      specialistReturn: 'TASK_CARD with state_patch_request'
    },
    surfaces: [{ id: 'camera', label: 'Camera', owner: 'camera-skill' }],
    optionalCapabilities: [],
    ...overrides
  };
}

test('accepts a valid orchestration contract', () => {
  const result = auditIndex({ skills: [skill('camera-skill')], edges: [] }, contract());
  assert.equal(result.findings.some((item) => item.id.startsWith('state-chain:')), false);
  assert.equal(result.findings.some((item) => item.id === 'task-card:missing'), false);
});

test('detects duplicate control surface ids and invalid duration ranges', () => {
  const result = auditIndex({ skills: [skill('camera-skill')], edges: [] }, contract({
    surfaces: [
      { id: 'camera', label: 'Camera', owner: 'camera-skill' },
      { id: 'camera', label: 'Camera duplicate', owner: 'camera-skill' }
    ],
    rules: {
      stateChain: ['TaskEnvelope', 'TaskEnvelope'],
      deliveryContracts: { liu_camera_group: { min: 28, max: 14 } },
      specialistReturn: 'full draft only'
    }
  }));
  const ids = result.findings.map((item) => item.id);
  assert.ok(ids.includes('surface:camera:duplicate'));
  assert.ok(ids.includes('state-chain:duplicate'));
  assert.ok(ids.includes('delivery-contract:liu_camera_group:range'));
  assert.ok(ids.includes('task-card:missing'));
});

test('enforces the v6 minimal route and single implicit entry', () => {
  const router = { ...skill('script-camera-group-router'), implicitInvocation: true };
  const director = { ...skill('ai-video-prompt-director'), implicitInvocation: true };
  const result = auditIndex({ skills: [router, director], edges: [] }, contract({
    contractVersion: 6,
    rules: {
      stateChain: ['TaskEnvelope', 'ExecutionPlan', 'RouteReceipt'],
      deliveryContracts: { liu_camera_group: { min: 14, max: 28 } },
      specialistReturn: 'TASK_CARD with state_patch_request',
      adaptiveProcessingDepth: { selectionOwner: 'script-camera-group-router' },
      executionPlans: {
        fast: {
          required: ['script-camera-group-router'],
          forbidden: [],
          preflightProfile: 'fast',
          promptCompileCount: 2
        },
        standard: { preflightProfile: 'standard', promptCompileCount: 1 },
        full: { preflightProfile: 'full', promptCompileCount: 1 }
      }
    },
    exclusiveGroups: [{ id: 'platform_compiler', members: ['seedance-20'] }]
  }));
  const ids = result.findings.map((item) => item.id);
  assert.ok(ids.includes('execution-plan:fast:invalid'));
  assert.ok(ids.includes('execution-plan:fast:not-minimal'));
  assert.ok(ids.includes('execution-plan:fast:unguarded'));
  assert.ok(ids.includes('compiler-exclusion:incomplete'));
  assert.ok(ids.includes('implicit-entry:ai-video-prompt-director'));
});
