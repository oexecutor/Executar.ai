import { Grid2X2, List, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { blogCategories } from "./content";
import type { BlogCategory, BlogSort, BlogView } from "./types";

interface FilterPanelProps {
  categories: BlogCategory[];
  onCategoriesChange: (categories: BlogCategory[]) => void;
  onQueryChange: (query: string) => void;
  onReset: () => void;
  onSortChange: (sort: BlogSort) => void;
  onViewChange: (view: BlogView) => void;
  query: string;
  resultCount: number;
  sort: BlogSort;
  view: BlogView;
}

export function FilterPanel({
  categories,
  onCategoriesChange,
  onQueryChange,
  onReset,
  onSortChange,
  onViewChange,
  query,
  resultCount,
  sort,
  view,
}: FilterPanelProps) {
  const toggleCategory = (category: BlogCategory) => {
    onCategoriesChange(
      categories.includes(category)
        ? categories.filter((value) => value !== category)
        : [...categories, category],
    );
  };

  return (
    <section className="blog-controls" aria-label="Busca, filtros e visualização">
      <div className="blog-search">
        <Search size={18} aria-hidden="true" />
        <label htmlFor="blog-search">Buscar no journal</label>
        <input
          id="blog-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="Tema, categoria ou palavra-chave"
        />
        <span aria-live="polite">{resultCount} artigos</span>
      </div>

      <details className="blog-filter-disclosure" open>
        <summary><SlidersHorizontal size={17} /> Filtrar e ordenar</summary>
        <div className="blog-filter-panel">
          <fieldset>
            <legend>Categorias</legend>
            <div className="blog-category-options">
              {blogCategories.map((category) => (
                <button
                  type="button"
                  key={category}
                  aria-pressed={categories.includes(category)}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="blog-sort">
            Ordenar
            <select value={sort} onChange={(event) => onSortChange(event.currentTarget.value as BlogSort)}>
              <option value="newest">Mais recentes</option>
              <option value="az">Título: A–Z</option>
              <option value="za">Título: Z–A</option>
            </select>
          </label>

          <div className="blog-control-actions">
            <div className="blog-view-toggle" aria-label="Modo de visualização">
              <button
                type="button"
                aria-label="Visualizar em grade"
                aria-pressed={view === "grid"}
                onClick={() => onViewChange("grid")}
              >
                <Grid2X2 size={17} />
              </button>
              <button
                type="button"
                aria-label="Visualizar em lista"
                aria-pressed={view === "list"}
                onClick={() => onViewChange("list")}
              >
                <List size={18} />
              </button>
            </div>
            <button className="blog-reset" type="button" onClick={onReset}>
              <RotateCcw size={15} /> Limpar
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}
