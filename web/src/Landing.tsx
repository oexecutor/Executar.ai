import { useEffect } from "react";

export function Landing() {
  useEffect(() => {
    // Remove any visual entry step: go straight to the workspace.
    if (window.location.pathname === "/app" || window.location.pathname.startsWith("/app/")) {
      return;
    }
    window.location.replace("/app");
  }, []);

  return (
    <main className="boot-screen">
      <span className="brand-mark"><i />EXECUTA.AI</span>
      <div className="boot-line"><i /></div>
      <p>Preparando seu workspace…</p>
    </main>
  );
}
