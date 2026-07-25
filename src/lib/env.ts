export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

/**
 * Resolves the public application origin.
 *
 * PUBLIC_BASE_URL remains the explicit override for custom domains and local
 * development. On Vercel, system-provided hostnames keep previews and
 * production functional even when that optional override was not configured.
 */
export function baseUrl(): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return normalizeBaseUrl(configured);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const deploymentHost = process.env.VERCEL_URL?.trim();
  const vercelHost = process.env.VERCEL_ENV === "production"
    ? productionHost || deploymentHost
    : deploymentHost || productionHost;

  if (vercelHost) return normalizeBaseUrl(vercelHost);

  throw new Error(
    "Missing required environment variable: PUBLIC_BASE_URL (or VERCEL_URL on Vercel)",
  );
}

export function resourceUrl(): string {
  return `${baseUrl()}/mcp`;
}

export function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}
