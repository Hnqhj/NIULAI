---
name: director-skill-console
description: Open or query the local Director Skill Console for Skill registry, dependency graph, route audit, short-drama contract, and explicit runtime status events. Use when the user asks to view Skill management, see which Skill is running, inspect routing logic, audit Owner conflicts, or record a verified route handoff.
---

# Director Skill Console

Use the local dashboard at `http://127.0.0.1:4187/` when the user asks for a visual view. Use the bundled MCP tools for structured reads or explicit status events.

## Runtime truth

Only explicit route events are runtime truth. Do not claim that a Skill is running merely because its name appears in a document or static dependency graph. Emit an event only after the director brain has selected, loaded, started, handed off, validated, completed, skipped, blocked, retried, or failed that Skill.

## Liu short-drama contract

When a task is Liu's recurring真人短剧 workflow, the console treats 14-28 second camera groups, approximately 3 Chinese characters per second, exact `@` handles, complete per-group prompts, and dialogue plus source-coupled dry foley as the active contract. Platform compilers remain mutually exclusive: Seedance uses `$seedance-20`; 即梦 uses `$jimeng-sd2-prompting`.

## Event fields

Events should include `runId`, `taskId`, `taskTitle`, `skill`, `ownerSurface`, `phase`, `status`, `message`, and `reason` when a skill is skipped or blocked. Keep messages factual and concise; never include hidden chain-of-thought.

## Real-time monitoring

The dashboard subscribes to `/api/events/stream` (Server-Sent Events). A successful event write is pushed immediately to the current run timeline, graph, and Skill status table. If the stream is unavailable, the UI falls back to a 15-second refresh interval.

## Safe operation

The dashboard is read-only in phase two. It does not edit or delete Skills, submit composer messages, expose event tokens, or infer private reasoning. If the local service is unavailable, report that status instead of fabricating a running state.

## Director integration

The director brain may call `skill_console_emit_event` at explicit lifecycle boundaries. Recommended order is: `matched` -> `selected` -> `loaded` -> `running` -> `handoff` -> `completed`, with `skipped`, `blocked`, `retrying`, or `failed` when applicable. Telemetry is best-effort and never gates prompt generation.
