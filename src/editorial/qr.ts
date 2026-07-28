import crypto from "node:crypto";
import { DomainError } from "../domain/errors.js";
import type {
  EditorialPublication,
  EditorialQrAccessPolicy,
  EditorialQrAction,
  EditorialQrRoute,
  EditorialQrState,
} from "./types.js";
import { EDITORIAL_QR_ACTIONS } from "./types.js";

export const EDITORIAL_QR_TOKEN_PATTERN = /^qr_[A-Za-z0-9_-]{24}$/;

export interface EditorialQrRegistration {
  publication_id: string;
  action: EditorialQrAction;
  token: string;
  status: "ACTIVE" | "REVOKED";
  access_policy: EditorialQrAccessPolicy;
  issued_at: string;
  issued_by: string;
}

export interface ResolvedEditorialQr {
  registration: EditorialQrRegistration;
  publication: EditorialPublication;
}

export type EditorialQrAccessOutcome =
  | "REDIRECTED"
  | "SAFE_FALLBACK"
  | "REVOKED";

export interface EditorialQrRepository {
  listRoutes(publicationId: string): Promise<EditorialQrRegistration[]>;
  saveRoutes(
    publicationId: string,
    routes: EditorialQrRegistration[],
  ): Promise<void>;
}

export interface EditorialQrResolverRepository {
  resolveRoute(token: string): Promise<ResolvedEditorialQr | null>;
  recordAccess(
    token: string,
    outcome: EditorialQrAccessOutcome,
    occurredAt: string,
  ): Promise<void>;
}

export function emptyEditorialQrState(): EditorialQrState {
  return {
    create_url: null,
    preview_url: null,
    approve_url: null,
    analytics_url: null,
    routes: {
      CREATE: null,
      PREVIEW: null,
      APPROVE: null,
      ANALYTICS: null,
    },
    issued_at: null,
  };
}

export function createEditorialQrToken(): string {
  return `qr_${crypto.randomBytes(18).toString("base64url")}`;
}

function canonicalOrigin(publicBaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(publicBaseUrl);
  } catch {
    throw new DomainError(
      "QR_BASE_URL_INVALID",
      "A origem pública do QR Router é inválida.",
      "Configure PUBLIC_BASE_URL com uma origem HTTPS estável.",
      500,
    );
  }
  const localHttp = parsed.protocol === "http:"
    && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new DomainError(
      "QR_BASE_URL_INVALID",
      "O QR Router exige uma origem HTTPS estável.",
      "Configure PUBLIC_BASE_URL com HTTPS; HTTP é aceito apenas em localhost.",
      500,
    );
  }
  return parsed.origin;
}

export function buildEditorialQrUrl(
  publicBaseUrl: string,
  token: string,
): string {
  if (!EDITORIAL_QR_TOKEN_PATTERN.test(token)) {
    throw new DomainError(
      "QR_TOKEN_INVALID",
      "O token do QR não atende ao contrato opaco.",
      "Gere novamente o conjunto de QRs pelo serviço editorial.",
      422,
    );
  }
  return `${canonicalOrigin(publicBaseUrl)}/q/${token}`;
}

export function qrAccessPolicy(
  action: EditorialQrAction,
): EditorialQrAccessPolicy {
  return action === "PREVIEW"
    ? "PUBLIC_REDIRECT"
    : "AUTHENTICATED_CONTEXT";
}

export function qrStateFromRegistrations(
  publicBaseUrl: string,
  registrations: EditorialQrRegistration[],
): EditorialQrState {
  const routes = emptyEditorialQrState().routes;
  for (const registration of registrations) {
    if (!EDITORIAL_QR_ACTIONS.includes(registration.action)) continue;
    const route: EditorialQrRoute = {
      action: registration.action,
      token: registration.token,
      url: buildEditorialQrUrl(publicBaseUrl, registration.token),
      status: registration.status,
      access_policy: registration.access_policy,
      issued_at: registration.issued_at,
      issued_by: registration.issued_by,
    };
    routes[registration.action] = route;
  }
  const issuedAt = registrations
    .map((registration) => registration.issued_at)
    .sort()
    .at(-1) ?? null;
  return {
    create_url: routes.CREATE?.url ?? null,
    preview_url: routes.PREVIEW?.url ?? null,
    approve_url: routes.APPROVE?.url ?? null,
    analytics_url: routes.ANALYTICS?.url ?? null,
    routes,
    issued_at: issuedAt,
  };
}

function editorialContextUrl(
  publicBaseUrl: string,
  publicationId: string,
  intent: "create" | "approve" | "analytics" | "preview-unavailable",
): string {
  const destination = new URL("/app/", canonicalOrigin(publicBaseUrl));
  destination.searchParams.set("tab", "editorial");
  destination.searchParams.set("intent", intent);
  destination.searchParams.set("publication", publicationId);
  return destination.toString();
}

export interface EditorialQrDestination {
  url: string;
  outcome: "REDIRECTED" | "SAFE_FALLBACK";
}

/**
 * Resolve semantic intent from current publication evidence. No destination is
 * embedded in the printed token, so changing a Preview/provider does not
 * require reprinting the QR.
 */
export function resolveEditorialQrDestination(
  publicBaseUrl: string,
  resolved: ResolvedEditorialQr,
): EditorialQrDestination {
  const { publication, registration } = resolved;
  switch (registration.action) {
    case "CREATE":
      return {
        url: editorialContextUrl(
          publicBaseUrl,
          publication.id,
          "create",
        ),
        outcome: "REDIRECTED",
      };
    case "PREVIEW": {
      if (
        publication.preview.url
        && publication.preview.commit_sha
        && publication.preview.commit_sha === publication.github.commit_sha
      ) {
        try {
          const previewUrl = new URL(publication.preview.url);
          if (previewUrl.protocol === "https:") {
            return { url: previewUrl.toString(), outcome: "REDIRECTED" };
          }
        } catch {
          // Invalid persisted evidence is handled by the safe fallback below.
        }
      }
      return {
        url: editorialContextUrl(
          publicBaseUrl,
          publication.id,
          "preview-unavailable",
        ),
        outcome: "SAFE_FALLBACK",
      };
    }
    case "APPROVE":
      return {
        url: editorialContextUrl(
          publicBaseUrl,
          publication.id,
          "approve",
        ),
        outcome: "REDIRECTED",
      };
    case "ANALYTICS":
      return {
        url: editorialContextUrl(
          publicBaseUrl,
          publication.id,
          "analytics",
        ),
        outcome: "REDIRECTED",
      };
  }
}

export class UnavailableEditorialQrRepository
  implements EditorialQrRepository {
  async listRoutes(): Promise<EditorialQrRegistration[]> {
    throw new DomainError(
      "QR_REGISTRY_NOT_CONFIGURED",
      "O registro persistente de QR não está configurado.",
      "Aplique a migração editorial E4 antes de emitir QRs.",
      503,
    );
  }

  async saveRoutes(): Promise<void> {
    throw new DomainError(
      "QR_REGISTRY_NOT_CONFIGURED",
      "O registro persistente de QR não está configurado.",
      "Aplique a migração editorial E4 antes de emitir QRs.",
      503,
    );
  }
}
