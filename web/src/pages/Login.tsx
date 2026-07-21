import { useState, type FormEvent } from "react";
import { login } from "../api";

interface LoginProps {
  onSuccess: () => void;
}

export function Login({ onSuccess }: LoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(password);
      setPassword("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-form" onSubmit={handleSubmit} aria-labelledby="login-heading">
        <h1 id="login-heading">DESK-OS</h1>
        <p className="lead">Entre com a senha do operador para continuar.</p>
        <label htmlFor="login-password">Senha do operador</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-required="true"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </button>
        <p role="alert" className="form-error">
          {error}
        </p>
      </form>
    </main>
  );
}
