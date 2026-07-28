import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  Printer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { BlogCover } from "./BlogCover";
import { BlogFooter } from "./BlogFooter";
import { BlogHeader } from "./BlogHeader";
import { blogPosts, postToMarkdown, relatedBlogPosts } from "./content";
import { formatBlogDate } from "./format";
import { NewsletterForm } from "./NewsletterForm";
import type { BlogPost } from "./types";

interface ArticlePageProps {
  post: BlogPost;
}

type CopyState = "idle" | "link" | "markdown" | "error";

async function writeClipboard(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível.");
  await navigator.clipboard.writeText(value);
}

export function ArticlePage({ post }: ArticlePageProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const related = useMemo(() => relatedBlogPosts(post), [post]);
  const postIndex = blogPosts.findIndex((candidate) => candidate.slug === post.slug);
  const previous = postIndex > 0 ? blogPosts[postIndex - 1] : undefined;
  const next = postIndex >= 0 && postIndex < blogPosts.length - 1 ? blogPosts[postIndex + 1] : undefined;
  const articleUrl = `${window.location.origin}/blog/${post.slug}`;

  useEffect(() => {
    const originalTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const originalDescription = description?.content;
    document.title = `${post.title} — EXECUTA.AI`;
    if (description) description.content = post.excerpt;

    const url = `${window.location.origin}/blog/${post.slug}`;
    const cleanups: Array<() => void> = [];

    function setMeta(selector: string, create: () => HTMLElement, content: string) {
      let element = document.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
      const isNew = !element;
      if (!element) {
        element = create() as HTMLMetaElement | HTMLLinkElement;
        document.head.appendChild(element);
      }
      const attribute = element.tagName === "LINK" ? "href" : "content";
      const original = element.getAttribute(attribute);
      element.setAttribute(attribute, content);
      cleanups.push(() => {
        if (isNew) element?.remove();
        else if (original !== null) element?.setAttribute(attribute, original);
      });
    }

    setMeta('link[rel="canonical"]', () => {
      const link = document.createElement("link");
      link.rel = "canonical";
      return link;
    }, url);
    setMeta('meta[property="og:title"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:title");
      return meta;
    }, post.title);
    setMeta('meta[property="og:description"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:description");
      return meta;
    }, post.excerpt);
    setMeta('meta[property="og:url"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:url");
      return meta;
    }, url);
    setMeta('meta[property="og:type"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:type");
      return meta;
    }, "article");
    setMeta('meta[name="twitter:title"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "twitter:title");
      return meta;
    }, post.title);
    setMeta('meta[name="twitter:description"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "twitter:description");
      return meta;
    }, post.excerpt);

    return () => {
      document.title = originalTitle;
      if (description && originalDescription !== undefined) description.content = originalDescription;
      for (const cleanup of cleanups) cleanup();
    };
  }, [post]);

  const copyLink = async () => {
    try {
      await writeClipboard(articleUrl);
      setCopyState("link");
    } catch {
      setCopyState("error");
    }
  };

  const copyMarkdown = async () => {
    try {
      await writeClipboard(postToMarkdown(post));
      setCopyState("markdown");
    } catch {
      setCopyState("error");
    }
  };

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    inLanguage: "pt-BR",
    author: { "@type": "Organization", name: "EXECUTA.AI" },
    publisher: { "@type": "Organization", name: "EXECUTA.AI" },
    mainEntityOfPage: articleUrl,
  };

  return (
    <div className="blog-site">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <BlogHeader />
      <main>
        <nav className="blog-breadcrumb" aria-label="Breadcrumb">
          <a href="/blog"><ArrowLeft size={15} /> Blog</a>
          <span aria-hidden="true">/</span>
          <span>{post.category}</span>
        </nav>

        <article className="blog-article">
          <header className="blog-article-header">
            <div className="blog-article-title">
              <p className="eyebrow eyebrow-orange">{post.category}</p>
              <h1>{post.title}</h1>
              <p>{post.excerpt}</p>
            </div>
            <dl className="blog-article-meta">
              <div><dt>Categoria</dt><dd>{post.category}</dd></div>
              <div><dt>Data</dt><dd><time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time></dd></div>
              <div><dt>Leitura</dt><dd>{post.readingMinutes} min</dd></div>
            </dl>
          </header>

          <BlogCover
            label={post.coverLabel}
            pattern={post.coverPattern}
            index={String(postIndex + 1).padStart(2, "0")}
            large
          />

          <div className="blog-article-layout">
            <aside className="blog-article-tools" aria-label="Ferramentas do artigo">
              <span>EXPLORAR</span>
              <button type="button" onClick={copyLink}>
                {copyState === "link" ? <Check size={16} /> : <Copy size={16} />}
                {copyState === "link" ? "Link copiado" : "Copiar link"}
              </button>
              <button type="button" onClick={copyMarkdown}>
                {copyState === "markdown" ? <Check size={16} /> : <Clipboard size={16} />}
                {copyState === "markdown" ? "Markdown copiado" : "Copiar Markdown"}
              </button>
              <button type="button" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir
              </button>
              <a href={`/app?origem=blog&artigo=${encodeURIComponent(post.slug)}`}>
                <ExternalLink size={16} /> Transformar em projeto
              </a>
              {copyState === "error" && <small role="alert">Seu navegador bloqueou a cópia.</small>}
            </aside>

            <div className="blog-article-body">
              {post.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets && (
                    <ul>
                      {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  )}
                  {section.callout && <blockquote>{section.callout}</blockquote>}
                </section>
              ))}
            </div>
          </div>
        </article>

        <nav className="blog-article-pagination" aria-label="Outros artigos">
          {previous ? (
            <a href={`/blog/${previous.slug}`}>
              <ArrowLeft size={18} />
              <span><small>Anterior</small>{previous.title}</span>
            </a>
          ) : <span />}
          {next ? (
            <a href={`/blog/${next.slug}`}>
              <span><small>Próximo</small>{next.title}</span>
              <ArrowRight size={18} />
            </a>
          ) : <span />}
        </nav>

        <section className="blog-related" aria-labelledby="related-title">
          <div className="blog-results-heading">
            <div>
              <p className="eyebrow">Continue explorando</p>
              <h2 id="related-title">Artigos relacionados</h2>
            </div>
          </div>
          <div className="blog-card-collection blog-card-collection-grid">
            {related.map((relatedPost, index) => (
              <ArticleCard
                key={relatedPost.slug}
                post={relatedPost}
                position={index + 1}
                view="grid"
              />
            ))}
          </div>
        </section>

        <NewsletterForm />
      </main>
      <BlogFooter />
    </div>
  );
}
