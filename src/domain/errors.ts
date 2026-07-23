/**
 * Domain-level failure with the same shape the HTTP/MCP adapters expose
 * (code/message/suggestion + status hint). The domain layer stays pure:
 * no imports from src/lib, netlify/functions or MCP code.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly suggestion: string,
    public readonly status: number = 422,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
