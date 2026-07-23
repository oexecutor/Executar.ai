import { DomainError } from "../domain/errors.js";
import { dashboardSummary, findAction, findItem, nextVisible, projectSummary } from "./engine.js";
import { validateProject } from "./schema.js";
import { ExecutarStore } from "./store.js";
import { buildCanonicalProject } from "./template.js";
import type { ProjectDoc } from "./types.js";

export class ExecutarService {
  constructor(private readonly store: ExecutarStore) {}

  validate(input: unknown) {
    return validateProject(input);
  }

  async listProjects() {
    const summaries = [];
    for (const id of await this.store.listProjectIds()) {
      const doc = await this.store.getProject(id);
      if (!doc) continue;
      summaries.push(projectSummary(doc, await this.store.getProgress(id)));
    }
    return summaries.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }

  async createProject(input: { project?: unknown; name?: string; description?: string; owner?: string }) {
    const doc = input.project
      ? structuredClone(input.project) as ProjectDoc
      : buildCanonicalProject({
          name: input.name?.trim() || "Projeto sem título",
          description: input.description?.trim() || "Projeto estruturado pelo EXECUTA.AI.",
          owner: input.owner,
        });
    const validation = validateProject(doc);
    if (!validation.valid) {
      throw new DomainError("INVALID_INPUT", "O projeto não atende ao contrato 3–9–36.", validation.errors.join(" "), 422);
    }
    if (await this.store.getProject(doc.meta.id)) {
      throw new DomainError("ALREADY_EXISTS", `O projeto ${doc.meta.id} já existe.`, "Use outro id ou abra o projeto existente.", 409);
    }
    const now = new Date().toISOString();
    doc.meta.created_at ||= now;
    doc.meta.updated_at = now;
    await this.store.saveProject(doc);
    await this.store.saveProgress(doc.meta.id, {});
    return { project: doc, status: dashboardSummary(doc, {}) };
  }

  async getProject(id: string) {
    const project = await this.requireProject(id);
    const progress = await this.store.getProgress(id);
    return { project, progress, status: dashboardSummary(project, progress) };
  }

  async getStatus(id: string) {
    const project = await this.requireProject(id);
    return { projectId: id, projectName: project.meta.name, ...dashboardSummary(project, await this.store.getProgress(id)) };
  }

  async getNext(id: string, max = 5) {
    const project = await this.requireProject(id);
    const next = nextVisible(project, await this.store.getProgress(id), Math.min(Math.max(max, 1), 20));
    return { projectId: id, count: next.length, next };
  }

  async completeAction(projectId: string, actionId: string, done: boolean) {
    const project = await this.requireProject(projectId);
    const found = findAction(project, actionId);
    if (!found) throw new DomainError("NOT_FOUND", `A ação ${actionId} não existe.`, "Consulte o projeto para obter os ids válidos.", 404);
    const progress = await this.store.getProgress(projectId);
    progress[actionId] = done;
    await this.store.saveProgress(projectId, progress);
    return { actionId, actionTitle: found.action.title, taskId: found.item.id, areaId: found.area.id, done };
  }

  async completeCheckpoint(projectId: string, checkpointId: string, done: boolean, force = false) {
    const project = await this.requireProject(projectId);
    const found = findItem(project, checkpointId);
    if (!found) throw new DomainError("NOT_FOUND", `O item ${checkpointId} não existe.`, "Consulte o projeto para obter os ids válidos.", 404);
    if (found.item.type !== "checkpoint") {
      throw new DomainError("INVALID_INPUT", `${checkpointId} é uma tarefa.`, "Conclua suas ações individualmente.", 422);
    }
    const progress = await this.store.getProgress(projectId);
    if (done && !force) {
      const pending = (found.item.predecessors ?? []).filter((taskId) => {
        const task = findItem(project, taskId)?.item;
        return !task?.actions?.length || !task.actions.every((action) => progress[action.id] === true);
      });
      if (pending.length) {
        throw new DomainError(
          "CHECKPOINT_GATED",
          `O checkpoint depende de tarefas pendentes: ${pending.join(", ")}.`,
          "Conclua todas as ações predecessoras ou registre uma exceção explícita.",
          409,
        );
      }
    }
    progress[checkpointId] = done;
    await this.store.saveProgress(projectId, progress);
    return { checkpointId, checkpointTitle: found.item.title, areaId: found.area.id, done, forced: force && done };
  }

  async resetProgress(projectId: string) {
    await this.requireProject(projectId);
    await this.store.saveProgress(projectId, {});
    return { projectId, reset: true };
  }

  async deleteProject(projectId: string) {
    const deleted = await this.store.deleteProject(projectId);
    if (!deleted) throw new DomainError("NOT_FOUND", `O projeto ${projectId} não existe.`, "Atualize a lista de projetos.", 404);
    return { projectId, deleted: true };
  }

  async exportPackage(projectId: string) {
    const project = await this.requireProject(projectId);
    return { project, progress: await this.store.getProgress(projectId) };
  }

  private async requireProject(id: string): Promise<ProjectDoc> {
    const project = await this.store.getProject(id);
    if (!project) throw new DomainError("NOT_FOUND", `O projeto ${id} não existe.`, "Atualize a lista de projetos.", 404);
    return project;
  }
}
