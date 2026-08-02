import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Landing } from "./Landing";
import { registerPwa } from "./pwa";
import "./styles.css";
import "./entry.css";
import "./entry-refine.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);

registerPwa();
