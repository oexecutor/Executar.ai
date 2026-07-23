import type { KvStore } from "../lib/kv-store.js";
import type { ProgressState, ProjectDoc } from "./types.js";

interface ProjectIndex {
  ids: string[];
}

const INDEX_KEY = "executar/index";
const projectKey = (id: string) => `executar/project/${id}`;
const progressKey = (id: string) => `executar/progress/${id}`;

export class ExecutarStore {
  constructor(private readonly store: KvStore) {}

  private async index(): Promise<ProjectIndex> {
    return (await this.store.get(INDEX_KEY, { type: "json" }) as ProjectIndex | null) ?? { ids: [] };
  }

  async listProjectIds(): Promise<string[]> {
    return (await this.index()).ids;
  }

  async getProject(id: string): Promise<ProjectDoc | null> {
    return await this.store.get(projectKey(id), { type: "json" }) as ProjectDoc | null;
  }

  async saveProject(doc: ProjectDoc): Promise<void> {
    await this.store.setJSON(projectKey(doc.meta.id), doc);
    const index = await this.index();
    if (!index.ids.includes(doc.meta.id)) {
      await this.store.setJSON(INDEX_KEY, { ids: [...index.ids, doc.meta.id] });
    }
  }

  async deleteProject(id: string): Promise<boolean> {
    if (!await this.getProject(id)) return false;
    await this.store.delete(projectKey(id));
    await this.store.delete(progressKey(id));
    const index = await this.index();
    await this.store.setJSON(INDEX_KEY, { ids: index.ids.filter((candidate) => candidate !== id) });
    return true;
  }

  async getProgress(id: string): Promise<ProgressState> {
    return (await this.store.get(progressKey(id), { type: "json" }) as ProgressState | null) ?? {};
  }

  async saveProgress(id: string, progress: ProgressState): Promise<void> {
    await this.store.setJSON(progressKey(id), progress);
  }
}
