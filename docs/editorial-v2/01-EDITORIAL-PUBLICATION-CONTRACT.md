# Contrato de domínio — EditorialPublication

Status: **PROPOSTA E0**

## 1. Objetivo

`EditorialPublication` é a fonte única de verdade do ciclo de uma publicação. O objeto não substitui o conteúdo do artigo; ele coordena briefing, artefatos, revisão, preview, publicação, QR e auditoria.

## 2. Forma mínima

```ts
export type EditorialPublicationStatus =
  | "DRAFT"
  | "VALIDATING"
  | "VALIDATION_FAILED"
  | "READY_FOR_PREVIEW"
  | "PREVIEW_BUILDING"
  | "PREVIEW_FAILED"
  | "PREVIEW_READY"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "PUBLISHING"
  | "PUBLISH_FAILED"
  | "PUBLISHED"
  | "QR_FAILED"
  | "ARCHIVED";

export interface EditorialPublication {
  schemaVersion: "1.0";
  publicationId: string;
  status: EditorialPublicationStatus;

  title: string;
  slug: string;
  summary: string;
  author: {
    id: string;
    name: string;
  };

  brief: {
    objective: string;
    audience: string;
    desiredOutcome: string;
    sourceType: "TEXT" | "FILE" | "URL" | "MCP" | "GPT";
    sourceRefs: string[];
  };

  editorial: {
    channel: "EXECUTA_JOURNAL";
    formatProfile: string;
    deskGoProfileRef?: string;
    frankwatchingProfileRef?: string;
    amesContractRef?: string;
    visualIdentityRef: string;
    checklist: EditorialCheck[];
  };

  artifacts: {
    contentPath?: string;
    metadataPath?: string;
    assets: string[];
    vaultRefs: string[];
  };

  delivery: {
    branch?: string;
    pullRequestNumber?: number;
    pullRequestUrl?: string;
    previewDeploymentId?: string;
    previewUrl?: string;
    productionUrl?: string;
    publishedCommitSha?: string;
  };

  review: {
    decision: "PENDING" | "CHANGES_REQUESTED" | "APPROVED";
    reviewer?: string;
    reviewedAt?: string;
    notes?: string;
  };

  qr: {
    createToken?: string;
    previewToken?: string;
    approveToken?: string;
    analyticsToken?: string;
    printArtifactPath?: string;
  };

  analytics: {
    provider?: string;
    dashboardUrl?: string;
    lastSnapshotAt?: string;
  };

  audit: EditorialEvent[];
  createdAt: string;
  updatedAt: string;
}
```

## 3. Objetos auxiliares

```ts
export interface EditorialCheck {
  id: string;
  label: string;
  result: "PENDING" | "PASS" | "FAIL" | "WAIVED";
  evidence?: string;
}

export interface EditorialEvent {
  eventId: string;
  type: string;
  actor: string;
  occurredAt: string;
  fromStatus?: EditorialPublicationStatus;
  toStatus?: EditorialPublicationStatus;
  evidenceRefs?: string[];
  note?: string;
}
```

## 4. Invariantes

1. `publicationId` é imutável.
2. `slug` não muda depois de `PUBLISHED`, salvo redirecionamento registrado.
3. `APPROVED` exige revisor, data e evidência da decisão.
4. `PUBLISHING` só pode suceder `APPROVED`.
5. `PUBLISHED` exige URL de produção e commit publicado.
6. `PREVIEW_READY` exige URL imutável e deployment identificado.
7. QR-02 não pode resolver para preview ausente.
8. QR-03 não executa merge silencioso; abre contexto de revisão/autorização.
9. tokens QR não contêm segredos nem URLs efêmeras.
10. toda transição gera um evento de auditoria.
11. falha de QR ou impressão não desfaz uma publicação já concluída.
12. 3–9–36 não é dependência obrigatória deste contrato.

## 5. Comandos de domínio

```text
createPublication
validatePublication
prepareEditorialPackage
runInternalQualityRules
createGitHubArtifact
syncVercelPreview
requestReview
requestChanges
approvePublication
publishPublication
registerProduction
issueQrTokens
generatePrintArtifact
archivePublication
```

Cada comando deve:

- validar o estado anterior;
- aplicar uma única transição coerente;
- registrar ator e timestamp;
- retornar erro tipado em vez de alterar parcialmente o objeto;
- ser idempotente quando repetido com a mesma chave de operação.

## 6. Endpoints candidatos

```text
POST   /api/editorial/publications
GET    /api/editorial/publications
GET    /api/editorial/publications/:id
POST   /api/editorial/publications/:id/validate
POST   /api/editorial/publications/:id/quality/rules/run
POST   /api/editorial/publications/:id/artifact/create
POST   /api/editorial/publications/:id/preview/sync
POST   /api/editorial/publications/:id/review
POST   /api/editorial/publications/:id/approve
POST   /api/editorial/publications/:id/publish
POST   /api/editorial/publications/:id/qr
POST   /api/editorial/publications/:id/print
GET    /q/:token
```

## 7. Operações MCP candidatas

```text
editorial_create_publication
editorial_validate_publication
editorial_prepare_package
editorial_request_preview
editorial_get_status
editorial_request_review
editorial_approve_publication
editorial_publish_publication
editorial_issue_qr
editorial_generate_print
```

Ações com efeitos externos — criar PR, publicar, fazer merge ou trocar destino
de QR — exigem confirmação explícita e autorização adequada. A API não aceita
branch, SHA, PR ou URL de Preview fornecidos pelo cliente como substituto da
automação E2.

## 8. Contrato do primeiro vertical slice

### Entrada mínima

```json
{
  "title": "Título do artigo",
  "summary": "Resumo editorial",
  "objective": "Resultado esperado",
  "audience": "Público principal",
  "desiredOutcome": "Ação desejada após a leitura",
  "author": "Leonardo",
  "sourceType": "GPT",
  "sourceRefs": []
}
```

### Saída mínima

```json
{
  "publicationId": "PUB-...",
  "status": "PREVIEW_READY",
  "slug": "titulo-do-artigo",
  "branch": "editorial/pub-...",
  "pullRequestUrl": "https://github.com/.../pull/...",
  "previewUrl": "https://...vercel.app/blog/titulo-do-artigo",
  "reviewDecision": "PENDING"
}
```

## 9. Testes de aceite E0/E1

- rejeitar briefing sem título, objetivo ou audiência;
- gerar IDs e slugs determinísticos e sem colisão;
- impedir publicação antes da aprovação;
- impedir `PREVIEW_READY` sem preview registrado;
- preservar histórico de transições;
- permitir recuperação do objeto após reinicialização do serviço;
- não alterar nem duplicar projetos 3–9–36;
- garantir que o QR Router resolva tokens por intenção e não por URL gravada no papel.
