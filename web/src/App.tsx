import { useCallback, useEffect, useState } from "react";
import { getJson, logout } from "./api";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Today } from "./pages/Today";
import { Board } from "./pages/Board";

type Session = "checking" | "authenticated" | "anonymous";
type View = "today" | "board";

export function App() {
  const [session, setSession] = useState<Session>("checking");
  const [view, setView] = useState<View>("today");

  const checkSession = useCallback(async () => {
    try {
      await getJson("/api/pm/status");
      setSession("authenticated");
    } catch {
      // Any failure (401, network, etc.) sends the user to the login
      // screen — fail closed rather than guess at partial access.
      setSession("anonymous");
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  async function handleLogout() {
    await logout();
    setSession("anonymous");
    setView("today");
  }

  if (session === "checking") {
    return (
      <main>
        <p className="lead" role="status">
          Carregando…
        </p>
      </main>
    );
  }

  if (session === "anonymous") {
    return <Login onSuccess={() => setSession("authenticated")} />;
  }

  return (
    <Layout active={view} onNavigate={setView} onLogout={handleLogout}>
      {view === "today" ? <Today onOpenBoard={() => setView("board")} /> : <Board />}
    </Layout>
  );
}
