export function requiredEnv(name: string): string {
  const value = Netlify.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required Netlify environment variable: ${name}`);
  return value;
}

export function baseUrl(): string {
  return requiredEnv("PUBLIC_BASE_URL").replace(/\/$/, "");
}

export function resourceUrl(): string {
  return `${baseUrl()}/mcp`;
}

export function isProduction(): boolean {
  return Netlify.env.get("CONTEXT") === "production";
}
