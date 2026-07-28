import { describe, expect, it } from "vitest";
import {
  GitHubEditorialPublisher,
  githubEditorialPublisherFromEnv,
} from "../src/editorial/github-publisher.js";
import {
  VercelEditorialPreviewResolver,
  vercelEditorialPreviewResolverFromEnv,
} from "../src/editorial/vercel-preview.js";

describe("editorial E2 environment bootstrap", () => {
  it("requires only the GitHub token when using the canonical repository", () => {
    expect(githubEditorialPublisherFromEnv({})).toBeNull();
    expect(githubEditorialPublisherFromEnv({
      EDITORIAL_GITHUB_TOKEN: "github-token",
    })).toBeInstanceOf(GitHubEditorialPublisher);
  });

  it("requires only the Vercel token when using the canonical project", () => {
    expect(vercelEditorialPreviewResolverFromEnv({})).toBeNull();
    expect(vercelEditorialPreviewResolverFromEnv({
      EDITORIAL_VERCEL_TOKEN: "vercel-token",
    })).toBeInstanceOf(VercelEditorialPreviewResolver);
  });

  it("continues to accept explicit non-secret overrides", () => {
    expect(githubEditorialPublisherFromEnv({
      EDITORIAL_GITHUB_TOKEN: "github-token",
      EDITORIAL_GITHUB_REPOSITORY: "example/editorial",
      EDITORIAL_GITHUB_BASE_BRANCH: "release",
    })).toBeInstanceOf(GitHubEditorialPublisher);
    expect(vercelEditorialPreviewResolverFromEnv({
      EDITORIAL_VERCEL_TOKEN: "vercel-token",
      EDITORIAL_VERCEL_PROJECT_ID: "prj_example",
      EDITORIAL_VERCEL_TEAM_ID: "team_example",
    })).toBeInstanceOf(VercelEditorialPreviewResolver);
  });
});
