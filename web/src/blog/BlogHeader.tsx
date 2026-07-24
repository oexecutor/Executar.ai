import { ArrowRight, Menu } from "lucide-react";

export function BlogHeader() {
  return (
    <header className="blog-header">
      <a className="blog-brand" href="/" aria-label="EXECUTA.AI — início">
        <span className="brand-mark"><i aria-hidden="true" />EXECUTA.AI</span>
        <span>JOURNAL</span>
      </a>

      <nav className="blog-desktop-nav" aria-label="Navegação pública">
        <a href="/#metodo">Método</a>
        <a href="/blog" aria-current="page">Blog</a>
        <a href="/entrar">Entrar</a>
        <a className="button button-orange button-compact" href="/entrar">
          Começar <ArrowRight size={15} />
        </a>
      </nav>

      <details className="blog-mobile-nav">
        <summary aria-label="Abrir navegação"><Menu size={20} /></summary>
        <nav aria-label="Navegação móvel">
          <a href="/">Início</a>
          <a href="/#metodo">Método</a>
          <a href="/blog" aria-current="page">Blog</a>
          <a href="/entrar">Entrar</a>
        </nav>
      </details>
    </header>
  );
}
