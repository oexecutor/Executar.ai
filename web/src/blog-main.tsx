import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BlogApp } from "./blog/BlogApp";
import { registerPwa } from "./pwa";
import "./styles.css";
import "./blog/blog.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(
  <StrictMode>
    <BlogApp />
  </StrictMode>,
);

registerPwa();
