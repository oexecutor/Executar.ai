import { DEFAULT_EDITORIAL_GITHUB_REPOSITORY } from "../src/editorial/github-publisher.js";
import {
  DEFAULT_EDITORIAL_VERCEL_PROJECT_ID,
  DEFAULT_EDITORIAL_VERCEL_TEAM_ID,
} from "../src/editorial/vercel-preview.js";
import { json, methodNotAllowed } from "../src/lib/http.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";

function value(environment: NodeJS.ProcessEnv, key: string): string | null {
  return environment[key]?.trim() || null;
}

export function deploymentEvidence(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const repositoryOwner = value(environment, "VERCEL_GIT_REPO_OWNER");
  const repositorySlug = value(environment, "VERCEL_GIT_REPO_SLUG");

  return {
    commit_sha:
      value(environment, "VERCEL_GIT_COMMIT_SHA")
      ?? value(environment, "GITHUB_SHA"),
    branch:
      value(environment, "VERCEL_GIT_COMMIT_REF")
      ?? value(environment, "GITHUB_HEAD_REF")
      ?? value(environment, "GITHUB_REF_NAME"),
    repository:
      repositoryOwner && repositorySlug
        ? `${repositoryOwner}/${repositorySlug}`
        : DEFAULT_EDITORIAL_GITHUB_REPOSITORY,
    deployment_url: value(environment, "VERCEL_URL"),
    environment: value(environment, "VERCEL_ENV"),
    target_environment: value(environment, "VERCEL_TARGET_ENV"),
    project_id:
      value(environment, "VERCEL_PROJECT_ID")
      ?? DEFAULT_EDITORIAL_VERCEL_PROJECT_ID,
    team_id:
      value(environment, "VERCEL_ORG_ID")
      ?? DEFAULT_EDITORIAL_VERCEL_TEAM_ID,
  };
}

export async function deploymentEvidenceHandler(
  request: Request,
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  return json(
    {
      ok: true,
      data: deploymentEvidence(),
    },
    {
      headers: {
        "Cache-Control": "public, no-store, max-age=0",
      },
    },
  );
}

export default createVercelNodeHandler(deploymentEvidenceHandler);
