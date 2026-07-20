# 02 — Product Vision and Scope

## Product statement

DESK-OS/ExecutAI is a neuroinclusive project-execution system that transforms dispersed notes, documents, ideas and obligations into explicit project context, structured work, a visible next action, evidence and resumable execution.

## Primary user

Leonardo Batista is the initial pilot user:

- solo founder/operator;
- non-developer power user;
- approximately 25 hours per week;
- stronger cognitive capacity during the first morning hours;
- prefers one workflow per day, three steps and a five-day week;
- wants Claude.ai as the intelligence layer;
- wants the system to reduce manual formatting and tool switching.

## Core jobs to be done

1. Capture a note, idea, document or project request.
2. Recover all relevant context from the vault.
3. Structure a project with objective, scope and definition of done.
4. Decompose work into deliverables, sprints, tasks and up to three steps.
5. Review gaps, assumptions, risks and capacity.
6. Approve the proposal.
7. Create and update operational records.
8. See the current sprint as a Kanban.
9. See today's dominant delivery and next action.
10. Link work to evidence and decisions.
11. Close a sprint with review and retained history.
12. Resume a project without reconstructing context.

## Full capability map

### Core entities

- workspace;
- portfolio;
- project;
- deliverable;
- sprint;
- workflow;
- task;
- step;
- note/context reference;
- evidence;
- decision;
- dependency;
- label;
- saved view;
- audit event;
- decomposition proposal.

### Core views

- Today;
- Inbox/Capture;
- Projects;
- Project detail;
- Backlog;
- Sprint;
- Kanban;
- Evidence and decisions;
- Search;
- Admin/import/export;
- Printable weekly dashboard.

### Core behaviors

- CRUD with authorization;
- stable IDs and version numbers;
- status transitions;
- ordering and drag/drop;
- filters;
- WIP limits;
- due dates and capacity;
- dependencies and blocked state;
- evidence links;
- audit history;
- import/export;
- search;
- proposal → approval → apply;
- backup before bulk mutation;
- idempotent MCP writes.

## MVP boundary

The first production increment must include:

- single-user workspace;
- projects;
- sprints;
- tasks and up to three steps;
- statuses and priorities;
- Kanban;
- Today view;
- vault context search/linking;
- evidence and decisions;
- decomposition proposal and apply;
- audit events;
- import/export compatibility;
- current OAuth/admin compatibility;
- responsive web UI;
- local tests and Deploy Preview.

## Explicitly not MVP

- multi-tenant billing;
- team chat;
- complex role hierarchy;
- Gantt;
- workload balancing across teams;
- time tracking;
- native mobile apps;
- real-time collaborative editing;
- marketplace;
- advanced notifications;
- autonomous server-side AI runner;
- replacing the complete Obsidian experience;
- replacing Linear feature-for-feature.
