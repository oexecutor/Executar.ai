export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
}

export type DeployContext = "production" | "preview";

export function deployContext(): DeployContext {
  return process.env.CONTEXT === "production" ? "production" : "preview";
}
