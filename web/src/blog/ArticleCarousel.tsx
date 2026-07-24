import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArticleCard } from "./ArticleCard";
import type { BlogPost } from "./types";

interface ArticleCarouselProps {
  posts: BlogPost[];
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function ArticleCarousel({ posts }: ArticleCarouselProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());

  const getCardStep = useCallback(() => {
    const rail = railRef.current;
    const card = rail?.querySelector<HTMLElement>(".blog-card");
    if (!rail || !card) return 0;
    const parsedGap = Number.parseFloat(window.getComputedStyle(rail).columnGap);
    const gap = Number.isNaN(parsedGap) ? 0 : parsedGap;
    return card.getBoundingClientRect().width + gap;
  }, []);

  const move = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;

    const step = getCardStep();
    const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (!step || !maximum) return;

    let nextPosition = rail.scrollLeft + step * direction;
    if (direction === 1 && nextPosition >= maximum - 2) nextPosition = 0;
    if (direction === -1 && rail.scrollLeft <= 2) nextPosition = maximum;

    rail.scrollTo({
      left: nextPosition,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [getCardStep]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const updateActiveIndex = () => {
      const step = getCardStep();
      if (!step) return;
      setActiveIndex(Math.min(posts.length - 1, Math.max(0, Math.round(rail.scrollLeft / step))));
    };

    updateActiveIndex();
    rail.addEventListener("scroll", updateActiveIndex, { passive: true });
    const observer = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(updateActiveIndex);
    observer?.observe(rail);

    return () => {
      rail.removeEventListener("scroll", updateActiveIndex);
      observer?.disconnect();
    };
  }, [getCardStep, posts.length]);

  useEffect(() => {
    if (!isPlaying || posts.length < 2) return;
    const interval = window.setInterval(() => move(1), 4800);
    return () => window.clearInterval(interval);
  }, [isPlaying, move, posts.length]);

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setIsPlaying(false);
      move(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIsPlaying(false);
      move(-1);
    }
  };

  return (
    <section className="blog-carousel" aria-labelledby="carousel-title">
      <div className="blog-carousel-heading">
        <div>
          <p className="eyebrow eyebrow-orange">Seleção editorial</p>
          <h2 id="carousel-title">Deslize pelas ideias.</h2>
          <p>Arraste no iPad ou use as setas para navegar lateralmente.</p>
        </div>

        <div className="blog-carousel-status">
          <span aria-label={`Artigo ${activeIndex + 1} de ${posts.length}`}>
            {String(activeIndex + 1).padStart(2, "0")} / {String(posts.length).padStart(2, "0")}
          </span>
          <div className="blog-carousel-actions">
            <button
              type="button"
              aria-label="Artigo anterior"
              onClick={() => {
                setIsPlaying(false);
                move(-1);
              }}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={isPlaying ? "Pausar movimento dos artigos" : "Retomar movimento dos artigos"}
              aria-pressed={isPlaying}
              onClick={() => setIsPlaying((current) => !current)}
            >
              {isPlaying
                ? <Pause size={17} aria-hidden="true" />
                : <Play size={17} aria-hidden="true" />}
            </button>
            <button
              type="button"
              aria-label="Próximo artigo"
              onClick={() => {
                setIsPlaying(false);
                move(1);
              }}
            >
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={railRef}
        className="blog-card-collection-carousel"
        role="region"
        aria-label="Artigos em carrossel"
        aria-roledescription="carrossel"
        tabIndex={0}
        onKeyDown={handleKeyboard}
        onPointerDown={() => setIsPlaying(false)}
      >
        {posts.map((post, index) => (
          <ArticleCard
            key={post.slug}
            post={post}
            position={index + 1}
            view="grid"
          />
        ))}
      </div>
    </section>
  );
}
