import type { KvStore } from "../lib/kv-store.js";
import type { EditorialPublication } from "./types.js";

interface EditorialIndex {
  ids: string[];
}

export interface EditorialRepository {
  listPublicationIds(): Promise<string[]>;
  getPublication(id: string): Promise<EditorialPublication | null>;
  savePublication(publication: EditorialPublication): Promise<void>;
  deletePublication(id: string): Promise<boolean>;
}

const INDEX_KEY = "editorial/index";
const publicationKey = (id: string) => `editorial/publication/${id}`;

/**
 * Legacy KV adapter retained during the expand-and-contract migration.
 *
 * The relational Postgres adapter is the primary source of truth. This class
 * remains available for rollback-compatible dual writes until the migration
 * has been observed in production for a full release cycle.
 */
export class EditorialStore implements EditorialRepository {
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

/**
 * Makes the relational repository primary while preserving the previous KV
 * representation as a rollback source. Missing relational rows are repaired
 * from KV on read, so a safe backfill can continue without downtime.
 */
export class MigratingEditorialStore implements EditorialRepository {
  constructor(
    private readonly primary: EditorialRepository,
    private readonly legacy: EditorialRepository,
  ) {}

  async listPublicationIds(): Promise<string[]> {
    const [primaryIds, legacyIds] = await Promise.all([
      this.primary.listPublicationIds(),
      this.legacy.listPublicationIds(),
    ]);
    const primarySet = new Set(primaryIds);
    for (const id of legacyIds) {
      if (primarySet.has(id)) continue;
      const publication = await this.legacy.getPublication(id);
      if (publication) {
        await this.primary.savePublication(publication);
        primarySet.add(id);
      }
    }
    return [...new Set([...primaryIds, ...legacyIds])];
  }

  async getPublication(id: string): Promise<EditorialPublication | null> {
    const publication = await this.primary.getPublication(id);
    if (publication) return publication;
    const legacyPublication = await this.legacy.getPublication(id);
    if (legacyPublication) await this.primary.savePublication(legacyPublication);
    return legacyPublication;
  }

  async savePublication(publication: EditorialPublication): Promise<void> {
    // Write the rollback source first. A failed relational write is reported,
    // and retrying the idempotent operation completes the primary write.
    await this.legacy.savePublication(publication);
    await this.primary.savePublication(publication);
  }

  async deletePublication(id: string): Promise<boolean> {
    const [legacyDeleted, primaryDeleted] = await Promise.all([
      this.legacy.deletePublication(id),
      this.primary.deletePublication(id),
    ]);
    return legacyDeleted || primaryDeleted;
  }
}
