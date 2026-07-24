import type {
  EngineArea,
  ExecutarProjectSummary,
  FinalDeliverable,
  ProgressState,
  ProjectDoc,
  ProjectItem,
} from "./types.js";

export function convertProject(doc: ProjectDoc, progress: ProgressState): EngineArea[] {
  return doc.areas.map((area) => ({
    id: area.id,
    title: area.title,
    shortTitle: area.short_title,
    items: area.items.map((item) => {
      const actions = (item.actions ?? []).map((action) => ({
        id: action.id,
        title: action.title,
        done: progress[action.id] === true,
      }));
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        actions,
        predecessors: item.predecessors,
        done: item.type === "checkpoint"
          ? progress[item.id] === true
          : actions.length > 0 && actions.every((action) => action.done),
      };
    }),
  }));
}

export function actionCounts(areas: EngineArea[]) {
  const actions = areas.flatMap((area) => area.items.flatMap((item) => item.actions));
  const done = actions.filter((action) => action.done).length;
  return { total: actions.length, done, pending: actions.length - done, pct: actions.length ? Math.round((done / actions.length) * 100) : 0 };
}

export function itemCounts(areas: EngineArea[]) {
  const items = areas.flatMap((area) => area.items);
  const checkpoints = items.filter((item) => item.type === "checkpoint");
  const tasks = items.filter((item) => item.type === "task");
  return {
    total: items.length,
    done: items.filter((item) => item.done).length,
    pending: items.filter((item) => !item.done).length,
    checkpoints: { total: checkpoints.length, done: checkpoints.filter((item) => item.done).length },
    tasks: { total: tasks.length, done: tasks.filter((item) => item.done).length },
  };
}

export function deliverableProgress(deliverables: FinalDeliverable[], areas: EngineArea[]) {
  const byId = new Map(areas.map((area) => [area.id, area]));
  return deliverables.map((deliverable) => {
    const actions = deliverable.linked_areas.flatMap((areaId) =>
      byId.get(areaId)?.items.flatMap((item) => item.actions) ?? [],
    );
    const done = actions.filter((action) => action.done).length;
    return {
      id: deliverable.id,
      title: deliverable.title,
      description: deliverable.description,
      linkedAreas: deliverable.linked_areas,
      pct: actions.length ? Math.round((done / actions.length) * 100) : 0,
    };
  });
}

export function currentPointer(areas: EngineArea[]) {
  for (const area of areas) {
    for (const item of executionOrder(area.items)) {
      if (item.done) continue;
      return {
        areaId: area.id,
        areaTitle: area.title,
        itemId: item.id,
        itemTitle: item.title,
        itemType: item.type,
        action: item.actions.find((action) => !action.done) ?? null,
      };
    }
  }
  return null;
}

export function nextVisible(doc: ProjectDoc, progress: ProgressState, max = 5) {
  const areas = convertProject(doc, progress);
  const results: Array<Record<string, unknown>> = [];
  for (const area of areas) {
    for (const item of executionOrder(area.items)) {
      if (item.done) continue;
      const source = findItem(doc, item.id)?.item;
      results.push({
        id: item.id,
        title: item.title,
        type: item.type,
        areaId: area.id,
        areaTitle: area.title,
        owner: source?.owner ?? null,
        evidence: source?.evidence ?? null,
        actions: item.actions,
      });
      if (results.length >= max) return results;
    }
  }
  return results;
}

function executionOrder(items: EngineArea["items"]): EngineArea["items"] {
  return [
    ...items.filter((item) => item.type === "task"),
    ...items.filter((item) => item.type === "checkpoint"),
  ];
}

export function dashboardSummary(doc: ProjectDoc, progress: ProgressState) {
  const areas = convertProject(doc, progress);
  return {
    actions: actionCounts(areas),
    items: itemCounts(areas),
    phases: doc.phases.map((phase) => {
      const phaseAreas = areas.filter((area) => phase.areas.includes(area.id));
      return { id: phase.id, title: phase.title, ...actionCounts(phaseAreas) };
    }),
    deliverables: deliverableProgress(doc.final_deliverables, areas),
    current: currentPointer(areas),
  };
}

export function projectSummary(doc: ProjectDoc, progress: ProgressState): ExecutarProjectSummary {
  const counts = actionCounts(convertProject(doc, progress));
  return {
    id: doc.meta.id,
    name: doc.meta.name,
    description: doc.meta.description,
    owner: doc.meta.owner ?? null,
    progressPct: counts.pct,
    actionsDone: counts.done,
    actionsTotal: counts.total,
    updatedAt: doc.meta.updated_at ?? null,
  };
}

export function findItem(doc: ProjectDoc, itemId: string): { area: ProjectDoc["areas"][number]; item: ProjectItem } | null {
  for (const area of doc.areas) {
    const item = area.items.find((candidate) => candidate.id === itemId);
    if (item) return { area, item };
  }
  return null;
}

export function findAction(doc: ProjectDoc, actionId: string) {
  for (const area of doc.areas) {
    for (const item of area.items) {
      const action = item.actions?.find((candidate) => candidate.id === actionId);
      if (action) return { area, item, action };
    }
  }
  return null;
}
