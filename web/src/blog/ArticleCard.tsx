import { ArrowUpRight } from "lucide-react";
import { BlogCover } from "./BlogCover";
import { formatBlogDate } from "./format";
import type { BlogPost, BlogView } from "./types";

interface ArticleCardProps {
  post: BlogPost;
  position: number;
  view: BlogView;
}

export function ArticleCard({ post, position, view }: ArticleCardProps) {
  return (
    <article className={`blog-card blog-card-${view}`}>
      <a href={`/blog/${post.slug}`} aria-label={`Ler: ${post.title}`}>
        <BlogCover
          label={post.coverLabel}
          pattern={post.coverPattern}
          index={String(position).padStart(2, "0")}
        />
        <div className="blog-card-copy">
          <div className="blog-card-meta">
            <span>{post.category}</span>
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
          </div>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
          <span className="blog-card-link">
            Ler artigo <ArrowUpRight size={16} />
          </span>
        </div>
      </a>
    </article>
  );
}
