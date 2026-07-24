import type { ProjectDoc, ProjectItem } from "./types.js";

export const PHASE_COUNT = 3;
export const AREA_COUNT = 9;
export const ITEMS_PER_AREA = 4;
export const TOTAL_ITEMS = AREA_COUNT * ITEMS_PER_AREA;
export const MAX_ACTIONS_PER_TASK = 3;

export const PHASE_AREA_MAP: Record<"F1" | "F2" | "F3", string[]> = {
  F1: ["A01", "A02", "A03"],
  F2: ["A04", "A05", "A06"],
  F3: ["A07", "A08", "A09"],
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function expectedItemId(areaIndex: number, itemIndex: number): string {
  return `T${String(areaIndex * ITEMS_PER_AREA + itemIndex + 1).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateProject(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["O projeto deve ser um objeto JSON."] };

  const doc = input as unknown as ProjectDoc;
  if (!isRecord(doc.meta)) {
    errors.push("meta é obrigatório.");
  } else {
    if (!/^PRJ-[A-Za-z0-9-]+$/.test(doc.meta.id ?? "")) errors.push("meta.id deve usar o formato PRJ-…");
    if (!doc.meta.name?.trim()) errors.push("meta.name é obrigatório.");
    if (!doc.meta.description?.trim()) errors.push("meta.description é obrigatório.");
  }

  if (!Array.isArray(doc.phases) || doc.phases.length !== PHASE_COUNT) {
    errors.push(`O projeto deve ter exatamente ${PHASE_COUNT} fases.`);
  } else {
    for (const [index, phaseId] of (["F1", "F2", "F3"] as const).entries()) {
      const phase = doc.phases[index];
      if (phase?.id !== phaseId) errors.push(`A fase ${index + 1} deve ter id ${phaseId}.`);
      if (!phase?.title?.trim()) errors.push(`A fase ${phaseId} precisa de título.`);
      if (JSON.stringify(phase?.areas) !== JSON.stringify(PHASE_AREA_MAP[phaseId])) {
        errors.push(`${phaseId} deve conter ${PHASE_AREA_MAP[phaseId].join(", ")}.`);
      }
    }
  }

  const itemIds = new Set<string>();
  const actionIds = new Set<string>();
  if (!Array.isArray(doc.areas) || doc.areas.length !== AREA_COUNT) {
    errors.push(`O projeto deve ter exatamente ${AREA_COUNT} áreas.`);
  } else {
    doc.areas.forEach((area, areaIndex) => {
      const areaId = `A${String(areaIndex + 1).padStart(2, "0")}`;
      if (area.id !== areaId) errors.push(`A área ${areaIndex + 1} deve ter id ${areaId}.`);
      if (!area.title?.trim() || !area.short_title?.trim()) errors.push(`${areaId} precisa de title e short_title.`);
      if (!Array.isArray(area.items) || area.items.length !== ITEMS_PER_AREA) {
        errors.push(`${areaId} deve ter 1 checkpoint e 3 tarefas.`);
        return;
      }

      const checkpoint = area.items[0];
      if (checkpoint?.type !== "checkpoint") errors.push(`O primeiro item de ${areaId} deve ser um checkpoint.`);
      const taskIds = area.items.slice(1).map((item) => item.id);

      area.items.forEach((item, itemIndex) => {
        const itemId = expectedItemId(areaIndex, itemIndex);
        if (item.id !== itemId) errors.push(`O item ${itemIndex + 1} de ${areaId} deve ter id ${itemId}.`);
        if (itemIds.has(item.id)) errors.push(`ID de item duplicado: ${item.id}.`);
        itemIds.add(item.id);
        if (!item.title?.trim()) errors.push(`${itemId} precisa de título.`);

        if (item.type === "checkpoint") {
          if (itemIndex !== 0) errors.push(`${itemId}: somente o primeiro item da área pode ser checkpoint.`);
          if (JSON.stringify(item.predecessors ?? []) !== JSON.stringify(taskIds)) {
            errors.push(`${itemId} deve depender das três tarefas da própria área.`);
          }
          if (item.actions?.length) errors.push(`${itemId}: checkpoints não possuem ações.`);
          return;
        }

        validateTaskActions(item, itemId, actionIds, errors);
      });
    });
  }

  if (!Array.isArray(doc.final_deliverables) || doc.final_deliverables.length < 1) {
    errors.push("O projeto deve ter ao menos um entregável final.");
  } else {
    const areaIds = new Set(Array.from({ length: AREA_COUNT }, (_, index) => `A${String(index + 1).padStart(2, "0")}`));
    for (const deliverable of doc.final_deliverables) {
      if (!deliverable.id?.trim() || !deliverable.title?.trim()) errors.push("Todo entregável precisa de id e título.");
      if (!deliverable.linked_areas?.length) errors.push(`${deliverable.id || "Entregável"} precisa estar ligado a ao menos uma área.`);
      for (const areaId of deliverable.linked_areas ?? []) {
        if (!areaIds.has(areaId)) errors.push(`${deliverable.id}: área inexistente ${areaId}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateTaskActions(
  item: ProjectItem,
  expectedTaskId: string,
  actionIds: Set<string>,
  errors: string[],
): void {
  if (item.type !== "task") {
    errors.push(`${expectedTaskId} deve ser uma tarefa.`);
    return;
  }
  const actions = item.actions ?? [];
  if (actions.length < 1 || actions.length > MAX_ACTIONS_PER_TASK) {
    errors.push(`${expectedTaskId} deve ter de 1 a ${MAX_ACTIONS_PER_TASK} ações.`);
    return;
  }
  actions.forEach((action, index) => {
    const actionId = `${expectedTaskId}.${index + 1}`;
    if (action.id !== actionId) errors.push(`A ação ${index + 1} de ${expectedTaskId} deve ter id ${actionId}.`);
    if (actionIds.has(action.id)) errors.push(`ID de ação duplicado: ${action.id}.`);
    actionIds.add(action.id);
    if (!action.title?.trim() || !action.stop_condition?.trim()) {
      errors.push(`${actionId} precisa de título e condição de parada.`);
    }
  });
}
