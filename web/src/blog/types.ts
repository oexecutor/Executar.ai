export type BlogCategory =
  | "Método EXECUTA"
  | "Produto"
  | "IA e agentes"
  | "Gestão de projetos"
  | "Neurocompatibilidade"
  | "Governança";

export type BlogCoverPattern =
  | "grid"
  | "orbit"
  | "steps"
  | "signal"
  | "stack"
  | "bridge";

export interface BlogSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  publishedAt: string;
  readingMinutes: number;
  featured?: boolean;
  coverPattern: BlogCoverPattern;
  coverLabel: string;
  sections: BlogSection[];
}

export type BlogView = "grid" | "list";
export type BlogSort = "newest" | "az" | "za";
