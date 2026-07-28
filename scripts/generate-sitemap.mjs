#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://executar-ai.vercel.app";

function seedBlogPosts() {
  const source = readFileSync(resolve(repositoryRoot, "web/src/blog/content.ts"), "utf8");
  const postBlocks = source.split(/(?=\n {2}\{\n {4}slug:)/g).slice(1);
  return postBlocks.map((block) => {
    const slug = block.match(/slug:\s*"([^"]+)"/)?.[1];
    const publishedAt = block.match(/publishedAt:\s*"([^"]+)"/)?.[1];
    return slug && publishedAt ? { slug, publishedAt } : null;
  }).filter(Boolean);
}

function generatedBlogPosts() {
  const contentDirectory = resolve(repositoryRoot, "content/blog");
  if (!existsSync(contentDirectory)) return [];
  return readdirSync(contentDirectory)
    .filter((file) => file.endsWith(".meta.json"))
    .map((file) => {
      const metadata = JSON.parse(readFileSync(resolve(contentDirectory, file), "utf8"));
      const slug = typeof metadata.slug === "string" ? metadata.slug : null;
      const updatedAt = typeof metadata.updated_at === "string" ? metadata.updated_at.slice(0, 10) : null;
      return slug && updatedAt ? { slug, publishedAt: updatedAt } : null;
    })
    .filter(Boolean);
}

const posts = [...generatedBlogPosts(), ...seedBlogPosts()];
if (new Set(posts.map((post) => post.slug)).size !== posts.length) {
  throw new Error("Sitemap: duplicate blog slugs detected, refusing to generate.");
}

const staticRoutes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "daily", priority: "0.9" },
];

function urlEntry({ path, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${siteOrigin}${path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n");
}

const entries = [
  ...staticRoutes.map(urlEntry),
  ...posts.map((post) => urlEntry({
    path: `/blog/${post.slug}`,
    lastmod: post.publishedAt,
    changefreq: "monthly",
    priority: "0.7",
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

const outputPath = resolve(repositoryRoot, "web/public/sitemap.xml");
writeFileSync(outputPath, xml, "utf8");
console.log(`Generated sitemap with ${entries.length} URLs (${posts.length} articles).`);
