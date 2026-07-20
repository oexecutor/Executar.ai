# 08 — Frontend and UX Specification

## Product surfaces

### 1. Today

Primary screen.

Shows:

- current date and active sprint;
- one dominant delivery;
- up to three steps;
- one short commitment;
- blocked reason when applicable;
- resume button;
- sync state;
- print action.

Must not show the entire backlog by default.

### 2. Sprint / Kanban

Columns:

```text
BACKLOG | READY | IN_PROGRESS | BLOCKED | DONE
```

Capabilities:

- drag/drop with keyboard alternative;
- ordered cards;
- WIP indication;
- filters by project, priority and label;
- task detail drawer/page;
- optimistic UI with rollback on failure;
- explicit sync state;
- no horizontal scrolling on mobile: use column selector or stacked mode.

### 3. Projects

List:

- title;
- objective;
- status;
- current sprint;
- next action;
- progress summary;
- risk/gap indicator.

Project detail:

- objective;
- context;
- scope/out of scope;
- definition of done;
- deliverables;
- current sprint;
- backlog;
- evidence;
- decisions;
- linked notes;
- audit history.

### 4. Capture

Input types:

- quick note;
- idea;
- pasted text;
- file reference;
- project request.

Actions:

- save as note;
- link to existing project;
- request decomposition;
- mark as inbox item.

### 5. Proposal review

Shows:

- objective and definition of done;
- assumptions;
- gaps;
- risks;
- deliverables;
- sprint;
- tasks and steps;
- capacity warnings;
- differences from existing plan;
- Approve and Apply;
- Reject;
- Save Draft.

### 6. Search

Searches:

- projects;
- tasks;
- notes;
- evidence;
- decisions.

## Neuroinclusive interaction rules

- low default density;
- stable information hierarchy;
- plain language;
- progressive disclosure;
- visible next action;
- maximum three visible steps;
- no artificial urgency;
- no infinite scroll in core flows;
- no required horizontal scroll;
- visible focus;
- keyboard support;
- reduced motion;
- sufficient contrast;
- autosave;
- explicit loading, error and sync states;
- printable A4 view;
- do not infer a diagnosis.

## Responsive behavior

### Mobile

- Today is default;
- bottom or compact navigation;
- one Kanban column at a time;
- task details full-screen;
- primary action reachable without precision gestures.

### Desktop

- left navigation;
- central board/content;
- optional contextual panel;
- no dense multi-panel default.

## Design token minimum

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;

  --content-narrow: 44rem;
  --content-wide: 80rem;

  --focus-width: 3px;
  --motion-fast: 120ms;
  --motion-normal: 200ms;
}

@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Use the existing visual identity when it is present in source. Do not replace it with generic component-library styling.
