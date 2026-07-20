# DESK-OS MCP tools — version 1.1.0

## Catalog

| Tool | Result in the Obsidian cloud vault |
| --- | --- |
| `desk_material_to_project` | `DESK-OS/Projects/{projectId}/00_PROJECT_EXECUTABLE.md` |
| `desk_daily_next_action` | `DESK-OS/Daily/{YYYY-MM-DD}_FOCUS.md` |
| `desk_evidence_to_decision` | `DESK-OS/Evidence/{evidenceId}.md` |
| `desk_multisystem_dashboard` | `DESK-OS/Dashboards/CURRENT_STATUS.md` |
| `desk_paper_to_digital` | `DESK-OS/Paper-Captures/{projectId}/{weekId}_{captureId}_{timestamp}.md` |

## Operating contract

The connected Claude, ChatGPT, or other MCP host performs semantic interpretation. The server does not call a second language model. It validates structured inputs and writes deterministic Markdown with YAML frontmatter.

Generated notes do not silently overwrite existing notes. To overwrite, the caller must:

1. read the existing note;
2. obtain its SHA-256 revision;
3. set `overwrite=true`;
4. pass `expectedSha256`.

## Test prompts

### 1. Material to project

> Use `desk_material_to_project` to structure the supplied material as project `H-012`. Separate facts, hypotheses, evidence, gaps, deliverables, tasks, one next action, and exactly three steps. Do not invent missing information.

### 2. Daily focus

> Consolidate these captures with `desk_daily_next_action`. Classify each item, identify blockers, and persist one next action with exactly three steps for today.

### 3. Evidence to decision

> Register this evidence with `desk_evidence_to_decision`. Link it to hypothesis `HYP-001`, assess whether it supports or contradicts the hypothesis, and keep the decision status as proposed until I approve it.

### 4. Multisystem dashboard

> Collect current snapshots from the connected systems first. Then use `desk_multisystem_dashboard` to persist the situation, divergences, risks, blockers, actions, and one next action.

### 5. Paper to digital

> Use `desk_paper_to_digital` to archive this confirmed paper transcription. Record QR context, confidence, review requirement, state changes, completed tasks, new tasks, and the next action. Do not store a raw secret QR token.
