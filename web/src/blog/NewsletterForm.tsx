import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

type NewsletterState = "idle" | "submitting" | "success" | "error";

interface NewsletterResponse {
  ok?: boolean;
  error?: { message?: string };
}

export function NewsletterForm() {
  const startedAt = useRef(Date.now());
  const [state, setState] = useState<NewsletterState>("idle");
  const [message, setMessage] = useState("");

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "");
    const website = String(data.get("website") ?? "");
    const consent = data.get("consent") === "on";

    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/blog/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website,
          consent,
          source: "executa-blog",
          started_at: startedAt.current,
        }),
      });
      const body = await response.json().catch(() => ({})) as NewsletterResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error?.message ?? "Não foi possível concluir sua inscrição.");
      }
      form.reset();
      setState("success");
      setMessage("Inscrição confirmada. Você receberá apenas atualizações editoriais do EXECUTA.AI.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir sua inscrição.");
    }
  }

  return (
    <section className="blog-newsletter" aria-labelledby="newsletter-title">
      <div>
        <p className="eyebrow eyebrow-orange">EXECUTA JOURNAL</p>
        <h2 id="newsletter-title">Método útil. Sem ruído.</h2>
        <p>Notas mensais sobre produto, projetos, IA responsável e execução neurocompatível.</p>
      </div>

      {state === "success" ? (
        <p className="blog-newsletter-success" role="status">
          <CheckCircle2 size={22} /> {message}
        </p>
      ) : (
        <form onSubmit={subscribe}>
          <div className="blog-newsletter-field">
            <label htmlFor="newsletter-email">Seu melhor e-mail</label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="voce@empresa.com"
            />
            <button type="submit" disabled={state === "submitting"}>
              {state === "submitting" ? "Enviando…" : "Assinar"} <ArrowRight size={17} />
            </button>
          </div>

          <label className="blog-consent">
            <input name="consent" type="checkbox" required />
            <span>
              Concordo em receber o journal e posso cancelar a qualquer momento.
              Consulte a <a href="/privacy.html">política de privacidade</a>.
            </span>
          </label>

          <label className="blog-honeypot" aria-hidden="true">
            Website
            <input name="website" type="text" tabIndex={-1} autoComplete="off" />
          </label>

          {state === "error" && <p className="blog-newsletter-error" role="alert">{message}</p>}
        </form>
      )}
    </section>
  );
}
