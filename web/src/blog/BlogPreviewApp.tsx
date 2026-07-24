import { useState, type MouseEvent } from "react";
import { ArticlePage } from "./ArticlePage";
import { BlogIndex } from "./BlogIndex";
import { findBlogPost } from "./content";
import type { BlogPost } from "./types";

const DEFAULT_NOTICE =
  "Prévia autônoma: navegação editorial e interações funcionam neste arquivo. Login e gravações externas estão simulados.";

export function BlogPreviewApp() {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [notice, setNotice] = useState(DEFAULT_NOTICE);

  const navigate = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target === "_blank") return;

    const href = anchor.getAttribute("href") ?? "";
    if (href === "/blog") {
      event.preventDefault();
      setPost(null);
      setNotice(DEFAULT_NOTICE);
      window.scrollTo({ top: 0 });
      return;
    }

    const articleMatch = href.match(/^\/blog\/([^/?#]+)/);
    if (articleMatch) {
      const nextPost = findBlogPost(decodeURIComponent(articleMatch[1] ?? ""));
      if (nextPost) {
        event.preventDefault();
        setPost(nextPost);
        setNotice(DEFAULT_NOTICE);
        window.scrollTo({ top: 0 });
      }
      return;
    }

    if (href.startsWith("/") || href.startsWith("#")) {
      event.preventDefault();
      setNotice("Esse link será conectado à landing, ao login ou à política no ambiente publicado.");
    }
  };

  return (
    <div onClick={navigate}>
      <aside className="blog-preview-notice" aria-label="Modo de visualização">
        <strong>PREVIEW REACT</strong>
        <span aria-live="polite">{notice}</span>
      </aside>
      {post ? <ArticlePage post={post} /> : <BlogIndex />}
    </div>
  );
}
