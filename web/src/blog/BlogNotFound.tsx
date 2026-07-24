import { ArrowLeft } from "lucide-react";
import { BlogFooter } from "./BlogFooter";
import { BlogHeader } from "./BlogHeader";

export function BlogNotFound() {
  return (
    <div className="blog-site">
      <BlogHeader />
      <main className="blog-not-found">
        <span>404</span>
        <h1>Este artigo ainda não existe.</h1>
        <p>Volte para o journal e explore as publicações disponíveis.</p>
        <a className="button button-dark" href="/blog"><ArrowLeft size={16} /> Voltar ao blog</a>
      </main>
      <BlogFooter />
    </div>
  );
}
