import type { ActorType } from "../domain/entities.js";
import type { RepositoryWriteOptions } from "../repository/interfaces.js";

/** Who is calling an application service, propagated into every audit event. */
export interface ActorContext {
  actorType: ActorType;
  actorId: string;
  requestId: string;
  workspaceId?: string;
}

export function writeOptions(
  context: ActorContext,
  idempotencyKey: string,
  expectedVersion?: number,
): RepositoryWriteOptions {
  return {
    actorId: context.actorId,
    actorType: context.actorType,
    requestId: context.requestId,
    idempotencyKey,
    expectedVersion,
  };
}
