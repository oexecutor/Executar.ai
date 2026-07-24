import { ArticlePage } from "./ArticlePage";
import { BlogIndex } from "./BlogIndex";
import { BlogNotFound } from "./BlogNotFound";
import { findBlogPost } from "./content";

export function BlogApp() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/blog") return <BlogIndex />;

  const match = pathname.match(/^\/blog\/([^/]+)$/);
  if (!match) return <BlogNotFound />;

  const post = findBlogPost(decodeURIComponent(match[1] ?? ""));
  return post ? <ArticlePage post={post} /> : <BlogNotFound />;
}
