import type { KvStore } from "../lib/kv-store.js";
import type { EditorialPublication } from "./types.js";

interface EditorialIndex {
  ids: string[];
}

const INDEX_KEY = "editorial/index";
const publicationKey = (id: string) => `editorial/publication/${id}`;

export class EditorialStore {
  constructor(private readonly store: KvStore) {}

  private async index(): Promise<EditorialIndex> {
    return (await this.store.get(INDEX_KEY, { type: "json" }) as EditorialIndex | null) ?? { ids: [] };
  }

  async listPublicationIds(): Promise<string[]> {
    return (await this.index()).ids;
  }

  async getPublication(id: string): Promise<EditorialPublication | null> {
    return await this.store.get(publicationKey(id), { type: "json" }) as EditorialPublication | null;
  }

  async savePublication(publication: EditorialPublication): Promise<void> {
    await this.store.setJSON(publicationKey(publication.id), publication);
    const index = await this.index();
    if (!index.ids.includes(publication.id)) {
      await this.store.setJSON(INDEX_KEY, { ids: [...index.ids, publication.id] });
    }
  }

  async deletePublication(id: string): Promise<boolean> {
    if (!await this.getPublication(id)) return false;
    await this.store.delete(publicationKey(id));
    const index = await this.index();
    await this.store.setJSON(INDEX_KEY, { ids: index.ids.filter((candidate) => candidate !== id) });
    return true;
  }
}
