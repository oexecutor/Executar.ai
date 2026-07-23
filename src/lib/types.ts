export interface FileRecord {
  path: string;
  data: string;
  sizeBytes: number;
  sha256: string;
  modifiedAt: string;
  mimeType?: string;
  originalName?: string;
}

export interface TrashRecord {
  trashId: string;
  originalPath: string;
  trashedAt: string;
  file: FileRecord;
}

export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: string;
}

export interface AuthorizationCode {
  clientId: string;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  expiresAt: number;
}

export interface RefreshGrant {
  clientId: string;
  userId: string;
  workspaceId: string;
  resource: string;
  scope: string;
  expiresAt: number;
}
