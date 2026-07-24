import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { ArticleCarousel } from "./ArticleCarousel";
import { BlogCover } from "./BlogCover";
import { BlogFooter } from "./BlogFooter";
import { BlogHeader } from "./BlogHeader";
import { blogPosts } from "./content";
import { FilterPanel } from "./FilterPanel";
import { formatBlogDate, normalizeSearch } from "./format";
import { NewsletterForm } from "./NewsletterForm";
import type { BlogCategory, BlogSort, BlogView } from "./types";

const PAGE_SIZE = 6;
const CAROUSEL_POSTS = blogPosts.filter((post) => !post.featured);

export function BlogIndex() {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [sort, setSort] = useState<BlogSort>("newest");
  const [view, setView] = useState<BlogView>(() =>
    window.localStorage.getItem("executa-blog-view") === "list" ? "list" : "grid",
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredPosts = useMemo(() => {
    const term = normalizeSearch(query);
    const matching = blogPosts.filter((post) => {
      const categoryMatch = categories.length === 0 || categories.includes(post.category);
      const haystack = normalizeSearch(
        `${post.title} ${post.excerpt} ${post.category} ${post.sections.map((section) => section.heading).join(" ")}`,
      );
      return categoryMatch && (!term || haystack.includes(term));
    });

    return [...matching].sort((left, right) => {
      if (sort === "az") return left.title.localeCompare(right.title, "pt-BR");
      if (sort === "za") return right.title.localeCompare(left.title, "pt-BR");
      return right.publishedAt.localeCompare(left.publishedAt);
    });
  }, [categories, query, sort]);

  const showFeatured = query.length === 0 && categories.length === 0 && sort === "newest";
  const featured = showFeatured ? blogPosts.find((post) => post.featured) : undefined;
  const listing = featured
    ? filteredPosts.filter((post) => post.slug !== featured.slug)
    : filteredPosts;
  const visiblePosts = listing.slice(0, visibleCount);

  useEffect(() => {
    window.localStorage.setItem("executa-blog-view", view);
  }, [view]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [categories, query, sort]);

  const reset = () => {
    setQuery("");
    setCategories([]);
    setSort("newest");
  };

  return (
    <div className="blog-site">
      <BlogHeader />
      <main>
        <section className="blog-hero">
          <div>
            <p className="eyebrow eyebrow-orange">EXECUTA JOURNAL</p>
            <h1>Ideias para transformar contexto em execução.</h1>
          </div>
          <p>
            Produto, método e práticas para projetos mais claros, verificáveis
            e neurocompatíveis — escritos por quem está construindo o sistema.
          </p>
        </section>

        {featured && (
          <section className="blog-featured" aria-labelledby="featured-title">
            <BlogCover
              label={featured.coverLabel}
              pattern={featured.coverPattern}
              index="DESTAQUE"
              large
            />
            <div>
              <div className="blog-featured-meta">
                <span>{featured.category}</span>
                <time dateTime={featured.publishedAt}>{formatBlogDate(featured.publishedAt)}</time>
              </div>
              <h2 id="featured-title">{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <a className="button button-dark" href={`/blog/${featured.slug}`}>
                Ler destaque <ArrowUpRight size={17} />
              </a>
            </div>
          </section>
        )}

        {showFeatured && <ArticleCarousel posts={CAROUSEL_POSTS} />}

        <FilterPanel
          categories={categories}
          onCategoriesChange={setCategories}
          onQueryChange={setQuery}
          onReset={reset}
          onSortChange={setSort}
          onViewChange={setView}
          query={query}
          resultCount={filteredPosts.length}
          sort={sort}
          view={view}
        />

        <section className="blog-results" aria-labelledby="latest-title">
          <div className="blog-results-heading">
            <div>
              <p className="eyebrow">Biblioteca editorial</p>
              <h2 id="latest-title">{query || categories.length ? "Resultados" : "Publicações recentes"}</h2>
            </div>
            <span>{filteredPosts.length.toString().padStart(2, "0")} / ARTIGOS</span>
          </div>

          {visiblePosts.length ? (
            <>
              <div className={`blog-card-collection blog-card-collection-${view}`}>
                {visiblePosts.map((post, index) => (
                  <ArticleCard
                    key={post.slug}
                    post={post}
                    position={index + 1}
                    view={view}
                  />
                ))}
              </div>
              {visibleCount < listing.length && (
                <button
                  className="blog-load-more"
                  type="button"
                  onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                >
                  Carregar mais <ArrowRight size={18} />
                </button>
              )}
            </>
          ) : (
            <div className="blog-empty">
              <span>00</span>
              <h3>Nenhum artigo encontrado.</h3>
              <p>Remova um filtro ou tente uma busca mais ampla.</p>
              <button className="button button-dark" type="button" onClick={reset}>
                Limpar busca
              </button>
            </div>
          )}
        </section>

        <NewsletterForm />
      </main>
      <BlogFooter />
    </div>
  );
}
