import { ArrowRight, Check, Layers3, LockKeyhole, Network, Sparkles } from "lucide-react";
import { lazy, Suspense } from "react";

const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));

function Brand() {
  return <span className="brand-mark"><i aria-hidden="true" />EXECUTA.AI</span>;
}

export function Landing() {
  if (window.location.pathname.startsWith("/entrar")) {
    return <Suspense fallback={<main className="boot-screen"><span className="brand-mark"><i />EXECUTA.AI</span></main>}><Login /></Suspense>;
  }

  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Principal">
        <a href="/" aria-label="EXECUTA.AI — início"><Brand /></a>
        <div className="landing-nav-actions">
          <a href="#metodo">Método</a>
          <a className="button button-dark button-compact" href="/entrar">
            Entrar <ArrowRight size={16} />
          </a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow eyebrow-orange">Workspace de execução com IA</p>
          <h1>Contexto complexo.<br /><span>Próxima ação clara.</span></h1>
          <p className="hero-lead">
            O EXECUTA.AI transforma objetivos em uma estrutura operacional de
            3 fases, 9 áreas e 36 itens — com tarefas, checkpoints, evidências e progresso no mesmo lugar.
          </p>
          <div className="hero-actions">
            <a className="button button-orange" href="/entrar">
              Começar a executar <ArrowRight size={18} />
            </a>
            <span><LockKeyhole size={16} /> Supabase + isolamento por workspace</span>
          </div>
        </div>

        <div className="product-frame" aria-label="Prévia do workspace EXECUTA.AI">
          <div className="frame-bar">
            <Brand />
            <span>PROJETO / LANÇAMENTO</span>
          </div>
          <div className="frame-body">
            <aside>
              <span className="active">Visão geral</span>
              <span>Hoje</span>
              <span>Portfólio</span>
              <span>Documentos</span>
            </aside>
            <div className="frame-content">
              <p className="eyebrow">Entrega dominante</p>
              <h2>Lançar a primeira versão operável.</h2>
              <div className="frame-progress"><i /></div>
              <div className="frame-stats">
                <article><strong>62%</strong><span>Ações</span></article>
                <article><strong>18/27</strong><span>Tarefas</span></article>
                <article><strong>5/9</strong><span>Checkpoints</span></article>
              </div>
              <div className="next-action">
                <span>PRÓXIMA AÇÃO</span>
                <strong>Validar fluxo de cadastro</strong>
                <i><Check size={15} /></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Capacidades">
        <span>PORTFÓLIO</span><i />
        <span>HOJE</span><i />
        <span>LISTA · TABELA · KANBAN</span><i />
        <span>VAULT + MCP</span>
      </section>

      <section className="method-section" id="metodo">
        <div className="section-intro">
          <p className="eyebrow">Um sistema, não mais uma lista</p>
          <h2>Da intenção à evidência.</h2>
          <p>
            Cada camada reduz ambiguidade sem aumentar a carga cognitiva.
            O Cloud e você operam sobre a mesma fonte de dados.
          </p>
        </div>
        <div className="method-grid">
          {[
            { icon: Sparkles, n: "01", title: "Estruture", text: "Contexto vira fases, áreas, tarefas, ações e entregáveis." },
            { icon: Layers3, n: "02", title: "Execute", text: "Hoje, Lista, Tabela e Kanban apresentam o mesmo estado." },
            { icon: Network, n: "03", title: "Comprove", text: "Checkpoints, documentos e evidências registram a evolução." },
          ].map(({ icon: Icon, n, title, text }) => (
            <article key={n}>
              <div><span>{n}</span><Icon size={22} strokeWidth={1.6} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-section">
        <p className="eyebrow eyebrow-orange">Arquitetura única</p>
        <h2>Cloud, aplicativo e documentos.<br />Sempre sincronizados.</h2>
        <div className="architecture-flow">
          <span>CLOUD</span><ArrowRight />
          <span>MCP EXECUTA</span><ArrowRight />
          <span>SUPABASE</span><ArrowRight />
          <span>PWA</span>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="eyebrow">Pronto para sair do contexto?</p>
          <h2>Entre em modo de execução.</h2>
        </div>
        <a className="button button-orange" href="/entrar">
          Acessar workspace <ArrowRight size={18} />
        </a>
      </section>

      <footer className="landing-footer">
        <Brand />
        <span>Projetos claros. Execução verificável.</span>
        <a href="/privacy.html">Privacidade</a>
      </footer>
    </main>
  );
}
