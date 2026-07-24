import type { BlogCoverPattern } from "./types";

interface BlogCoverProps {
  label: string;
  pattern: BlogCoverPattern;
  index?: string;
  large?: boolean;
}

export function BlogCover({ label, pattern, index = "EX", large = false }: BlogCoverProps) {
  return (
    <div
      className={`blog-cover blog-cover-${pattern}${large ? " blog-cover-large" : ""}`}
      aria-hidden="true"
    >
      <span className="blog-cover-index">{index}</span>
      <span className="blog-cover-label">{label}</span>
      <i className="blog-cover-shape" />
      <i className="blog-cover-axis" />
    </div>
  );
}
