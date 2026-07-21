import type { ReactNode } from "react";

interface LayoutProps {
  active: "today" | "board";
  onNavigate: (view: "today" | "board") => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Layout({ active, onNavigate, onLogout, children }: LayoutProps) {
  return (
    <div className="shell">
      <header className="app-header">
        <span className="brand">DESK-OS</span>
        <nav aria-label="Navegação principal" className="nav">
          <button
            type="button"
            className="nav-link"
            aria-current={active === "today" ? "page" : undefined}
            onClick={() => onNavigate("today")}
          >
            Hoje
          </button>
          <button
            type="button"
            className="nav-link"
            aria-current={active === "board" ? "page" : undefined}
            onClick={() => onNavigate("board")}
          >
            Sprint
          </button>
        </nav>
        <button type="button" className="button secondary" onClick={onLogout}>
          Sair
        </button>
      </header>
      <main className="content" id="main-content">
        {children}
      </main>
    </div>
  );
}
