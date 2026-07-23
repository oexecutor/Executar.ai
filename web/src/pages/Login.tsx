import { ArrowLeft, ArrowRight, Check, LoaderCircle, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  getBrowserSession,
  loadMemberships,
  selectWorkspace,
  signIn,
  signUp,
  type WorkspaceMembership,
} from "../auth";

interface LoginProps {
  onSuccess?: () => void;
}

function safeReturnTo(): string {
  const value = new URLSearchParams(window.location.search).get("return_to");
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export function Login({ onSuccess }: LoginProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [memberships, setMemberships] = useState<WorkspaceMembership[] | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const finish = useCallback(() => {
    if (onSuccess) onSuccess();
    else window.location.assign(safeReturnTo());
  }, [onSuccess]);

  const chooseWorkspace = useCallback(async (membership: WorkspaceMembership, token: string) => {
    setPending(true);
    setError(null);
    try {
      await selectWorkspace(token, membership);
      finish();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível abrir esse workspace.");
      setPending(false);
    }
  }, [finish]);

  const prepareWorkspaces = useCallback(async (token: string) => {
    setPending(true);
    setError(null);
    try {
      const available = await loadMemberships(token);
      setAccessToken(token);
      setMemberships(available);
      if (available.length === 1) await chooseWorkspace(available[0], token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar seus workspaces.");
    } finally {
      setPending(false);
    }
  }, [chooseWorkspace]);

  useEffect(() => {
    void getBrowserSession().then((session) => {
      if (session?.access_token) void prepareWorkspaces(session.access_token);
    });
  }, [prepareWorkspaces]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    try {
      const session = mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, String(form.get("name") ?? ""));
      if (!session) {
        setMessage("Conta criada. Confirme o e-mail para ativar seu workspace.");
        setPending(false);
        return;
      }
      await prepareWorkspaces(session.access_token);
    } catch {
      setError(mode === "signin"
        ? "Não foi possível entrar. Verifique o e-mail e a senha."
        : "Não foi possível criar a conta. Revise os dados ou tente outro e-mail.");
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-context">
        <a className="brand-mark brand-inverse" href="/"><i aria-hidden="true" />EXECUTA.AI</a>
        <div>
          <p className="eyebrow eyebrow-orange">Workspace autenticado</p>
          <h1>Seu contexto.<br />Em movimento.</h1>
          <p>Projetos, ações, checkpoints e documentos protegidos por workspace.</p>
        </div>
        <span className="auth-security"><LockKeyhole size={17} /> Supabase Auth + RLS</span>
      </section>

      <section className="auth-panel">
        <a className="auth-back" href="/"><ArrowLeft size={16} /> Voltar</a>

        {memberships ? (
          <div className="workspace-picker">
            <p className="eyebrow">Selecionar workspace</p>
            <h2>Onde vamos executar?</h2>
            {memberships.length ? (
              <div className="workspace-options">
                {memberships.map((membership) => (
                  <button
                    type="button"
                    key={membership.workspaceId}
                    onClick={() => void chooseWorkspace(membership, accessToken)}
                    disabled={pending}
                  >
                    <span>{membership.role}</span>
                    <strong>{membership.workspaceName}</strong>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="auth-empty">Sua conta ainda não possui uma membership ativa.</p>
            )}
          </div>
        ) : (
          <div className="auth-form-wrap">
            <p className="eyebrow">{mode === "signin" ? "Bem-vindo de volta" : "Criar workspace"}</p>
            <h2>{mode === "signin" ? "Entre para continuar." : "Comece a executar."}</h2>
            <form className="auth-form" onSubmit={submit}>
              {mode === "signup" && (
                <label>
                  <span>Seu nome</span>
                  <input name="name" type="text" autoComplete="name" required />
                </label>
              )}
              <label>
                <span>E-mail</span>
                <input name="email" type="email" autoComplete="email" required autoFocus />
              </label>
              <label>
                <span>Senha</span>
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={8}
                  required
                />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              {message && <p className="form-success" role="status"><Check size={16} />{message}</p>}
              <button className="button button-orange auth-submit" type="submit" disabled={pending}>
                {pending ? <><LoaderCircle className="spin" size={17} /> Aguarde…</> : (
                  <>{mode === "signin" ? "Entrar" : "Criar conta"} <ArrowRight size={17} /></>
                )}
              </button>
            </form>
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setMessage(null);
              }}
            >
              {mode === "signin" ? "Ainda não tem uma conta? Criar agora" : "Já tem conta? Entrar"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
