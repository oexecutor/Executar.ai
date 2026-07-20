import path from "node:path";
import type { FileRecord } from "./types.mjs";

const TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".csv", ".tsv", ".json", ".yaml", ".yml", ".xml", ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".toml", ".ini", ".log",
]);

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildVaultBrowserUrl(publicBaseUrl: string, tab: "notes" | "documents" = "notes"): string {
  return `${publicBaseUrl.replace(/\/$/, "")}/?tab=${tab}`;
}

export function buildVaultViewUrl(publicBaseUrl: string, vaultPath: string): string {
  const tab = vaultPath.toLowerCase().endsWith(".md") ? "notes" : "documents";
  return `${buildVaultBrowserUrl(publicBaseUrl, tab)}&path=${encodeURIComponent(vaultPath)}`;
}

export function buildVaultDownloadUrl(publicBaseUrl: string, vaultPath: string): string {
  return `${publicBaseUrl.replace(/\/$/, "")}/view?path=${encodeURIComponent(vaultPath)}&download=1`;
}

export function buildVaultRawUrl(publicBaseUrl: string, vaultPath: string): string {
  return `${publicBaseUrl.replace(/\/$/, "")}/view?path=${encodeURIComponent(vaultPath)}&raw=1`;
}

function safeHref(rawHref: string, currentPath: string, publicBaseUrl: string): string | null {
  const href = rawHref.trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return null;
  const withoutAnchor = href.split("#", 1)[0] ?? "";
  if (!withoutAnchor) return null;
  let target: string;
  try { target = decodeURIComponent(withoutAnchor).replaceAll("\\", "/"); }
  catch { return null; }
  if (!target.toLowerCase().endsWith(".md") && !path.posix.extname(target)) target += ".md";
  if (target.startsWith("./") || target.startsWith("../")) target = path.posix.normalize(path.posix.join(path.posix.dirname(currentPath), target));
  target = target.replace(/^\/+/, "");
  if (!target || target === "." || target === ".." || target.startsWith("../")) return null;
  return buildVaultViewUrl(publicBaseUrl, target);
}

function renderInline(raw: string, currentPath: string, publicBaseUrl: string): string {
  const tokens: string[] = [];
  const reserve = (html: string): string => {
    const key = `DESKTOKENZZ${tokens.length}ZZ`;
    tokens.push(html);
    return key;
  };

  let value = raw;
  value = value.replace(/`([^`]+)`/g, (_match, code: string) => reserve(`<code>${escapeHtml(code)}</code>`));
  value = value.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_match, target: string, alias?: string) => {
    const href = safeHref(target, currentPath, publicBaseUrl);
    const label = escapeHtml(alias?.trim() || target.trim());
    return href ? reserve(`<a href="${escapeHtml(href)}">${label}</a>`) : label;
  });
  value = value.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, label: string, rawHref: string) => {
    const href = safeHref(rawHref, currentPath, publicBaseUrl);
    const escapedLabel = escapeHtml(label);
    return href ? reserve(`<a href="${escapeHtml(href)}"${/^https?:\/\//i.test(href) ? ' rel="noreferrer"' : ""}>${escapedLabel}</a>`) : escapedLabel;
  });

  let html = escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  tokens.forEach((token, index) => {
    html = html.replace(`DESKTOKENZZ${index}ZZ`, token);
  });
  return html;
}

function tableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isSpecialLine(line: string, nextLine = ""): boolean {
  return /^\s*$/.test(line)
    || /^```/.test(line.trim())
    || /^(#{1,6})\s+/.test(line)
    || /^\s*>\s?/.test(line)
    || /^\s*[-+*]\s+/.test(line)
    || /^\s*\d+\.\s+/.test(line)
    || /^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)
    || (line.includes("|") && isTableDivider(nextLine));
}

export function renderMarkdown(markdown: string, currentPath: string, publicBaseUrl: string): string {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output: string[] = [];
  let index = 0;

  if (lines[0] === "---") {
    const end = lines.slice(1).findIndex((line) => line === "---");
    if (end >= 0) {
      const properties = lines.slice(1, end + 1).join("\n");
      output.push(`<details class="properties"><summary>Propriedades da nota</summary><pre>${escapeHtml(properties)}</pre></details>`);
      index = end + 2;
    }
  }

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.trim().match(/^```([^`]*)$/);
    if (fence) {
      const language = fence[1]?.trim() ?? "";
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      output.push(`<pre class="code"><code${language ? ` data-language="${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const text = heading[2] ?? "";
      output.push(`<h${level}>${renderInline(text, currentPath, publicBaseUrl)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").includes("|") && (lines[index] ?? "").trim()) {
        rows.push(tableCells(lines[index] ?? ""));
        index += 1;
      }
      output.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${renderInline(cell, currentPath, publicBaseUrl)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_header, cellIndex) => `<td>${renderInline(row[cellIndex] ?? "", currentPath, publicBaseUrl)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index] ?? "")) {
        quote.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote>${quote.map((item) => renderInline(item, currentPath, publicBaseUrl)).join("<br>")}</blockquote>`);
      continue;
    }

    if (/^\s*[-+*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-+*]\s+/.test(lines[index] ?? "")) {
        const item = (lines[index] ?? "").replace(/^\s*[-+*]\s+/, "");
        const checkbox = item.match(/^\[([ xX])\]\s*(.*)$/);
        items.push(checkbox
          ? `<li class="task"><input type="checkbox" disabled${checkbox[1]?.toLowerCase() === "x" ? " checked" : ""}> <span>${renderInline(checkbox[2] ?? "", currentPath, publicBaseUrl)}</span></li>`
          : `<li>${renderInline(item, currentPath, publicBaseUrl)}</li>`);
        index += 1;
      }
      output.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? "")) {
        const item = (lines[index] ?? "").replace(/^\s*\d+\.\s+/, "");
        items.push(`<li>${renderInline(item, currentPath, publicBaseUrl)}</li>`);
        index += 1;
      }
      output.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && !isSpecialLine(lines[index] ?? "", lines[index + 1] ?? "")) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(" "), currentPath, publicBaseUrl)}</p>`);
  }

  return output.join("\n");
}

export function isTextFile(filePath: string, bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  const extension = path.posix.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || extension === "";
}

export function contentTypeFor(filePath: string): string {
  const extension = path.posix.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".md": "text/markdown; charset=utf-8",
    ".markdown": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".tsv": "text/tab-separated-values; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".yaml": "application/yaml; charset=utf-8",
    ".yml": "application/yaml; charset=utf-8",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return map[extension] ?? "application/octet-stream";
}

function pageStyles(): string {
  return `:root{color-scheme:light;--paper:#efefeb;--surface:#fafaf7;--ink:#202020;--muted:#62625d;--line:#c8c7c0;--accent:#ff5a00}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{width:min(980px,100%);margin:0 auto;padding:20px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0 18px;border-bottom:1px solid var(--ink)}.brand{font:800 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em}.top a,.button{display:inline-flex;align-items:center;min-height:42px;padding:10px 14px;background:var(--ink);color:#fff;text-decoration:none;font-weight:700;border:0}.button.secondary{background:transparent;color:var(--ink);border:1px solid var(--line)}.hero{padding:28px 0 18px}.hero h1{margin:0 0 8px;font-size:clamp(28px,6vw,48px);line-height:1.05;letter-spacing:-.035em}.meta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:13px}.panel{background:var(--surface);border:1px solid var(--line);padding:clamp(18px,4vw,34px)}.actions{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px}.article{overflow-wrap:anywhere}.article h1,.article h2,.article h3,.article h4,.article h5,.article h6{line-height:1.2;margin:1.45em 0 .55em;letter-spacing:-.02em}.article h1{font-size:2em}.article h2{font-size:1.5em;border-bottom:1px solid var(--line);padding-bottom:.3em}.article h3{font-size:1.2em}.article p{margin:.8em 0}.article a{color:#a23a00;text-decoration-thickness:1px;text-underline-offset:3px}.article code{font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#e6e5df;padding:2px 5px}.article pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#222;color:#f5f5f2;padding:16px;overflow:auto}.article blockquote{margin:1em 0;padding:.25em 1em;border-left:4px solid var(--accent);background:#f1eee8}.article ul,.article ol{padding-left:1.5em}.task{list-style:none;margin-left:-1.5em;display:flex;gap:8px}.properties{margin:0 0 22px;border:1px solid var(--line);background:#f3f2ed}.properties summary{cursor:pointer;padding:12px 14px;font-weight:700}.properties pre{margin:0;border-top:1px solid var(--line);background:transparent;color:var(--ink)}.table-wrap{overflow-x:auto;margin:1em 0}table{border-collapse:collapse;width:100%;min-width:540px}th,td{border:1px solid var(--line);padding:9px 11px;text-align:left;vertical-align:top}th{background:#e8e7e1}.browser-tools{display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:18px}input[type=search]{width:100%;min-height:46px;padding:10px 12px;border:1px solid var(--line);background:#fff;font:inherit}.file-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}.file-list li{border-bottom:1px solid var(--line)}.file-list a{display:grid;grid-template-columns:1fr auto;gap:12px;padding:13px 4px;color:var(--ink);text-decoration:none}.file-list a:hover{background:#ecebe5}.file-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.file-meta{color:var(--muted);font-size:12px;white-space:nowrap}.message{min-height:24px;color:var(--muted);margin-top:10px}.empty{padding:28px 0;color:var(--muted)}.foot{margin-top:30px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}@media(max-width:600px){.shell{padding:14px}.top{align-items:flex-start}.browser-tools{grid-template-columns:1fr}.file-list a{grid-template-columns:1fr}.file-meta{white-space:normal}.panel{padding:16px}}`;
}

function shell(title: string, body: string, script = ""): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)} · DESK-OS</title><style>${pageStyles()}</style></head><body><main class="shell"><header class="top"><div class="brand">DESK-OS / OBSIDIAN CLOUD</div><a href="/">PAINEL</a></header>${body}<footer class="foot">Visualização protegida por sessão administrativa · conteúdo armazenado em Netlify Blobs</footer></main>${script ? `<script>${script}</script>` : ""}</body></html>`;
}

export function renderVaultBrowser(records: FileRecord[], publicBaseUrl: string): string {
  const items = records.map((record) => {
    const extension = path.posix.extname(record.path).toLowerCase() || "arquivo";
    return `<li data-path="${escapeHtml(record.path.toLowerCase())}"><a href="${escapeHtml(buildVaultViewUrl(publicBaseUrl, record.path))}"><span class="file-path">${escapeHtml(record.path)}</span><span class="file-meta">${escapeHtml(extension.replace(/^\./, "").toUpperCase())} · ${record.sizeBytes.toLocaleString("pt-BR")} B</span></a></li>`;
  }).join("");
  const body = `<section class="hero"><h1>Arquivos do vault</h1><div class="meta"><span>${records.length.toLocaleString("pt-BR")} arquivos</span><span>Toque em um nome para ler</span></div></section><section class="panel"><div class="browser-tools"><input id="search" type="search" placeholder="Filtrar por nome ou pasta" aria-label="Filtrar arquivos"><a class="button secondary" href="/api/vault/export">EXPORTAR ZIP</a></div><ul class="file-list" id="files">${items}</ul><div class="empty" id="empty" hidden>Nenhum arquivo encontrado.</div></section>`;
  const script = `const s=document.getElementById('search'),items=[...document.querySelectorAll('#files li')],empty=document.getElementById('empty');s.addEventListener('input',()=>{const q=s.value.trim().toLowerCase();let shown=0;for(const item of items){const visible=!q||item.dataset.path.includes(q);item.hidden=!visible;if(visible)shown++}empty.hidden=shown!==0});`;
  return shell("Arquivos do vault", body, script);
}

export function renderVaultFile(input: { record: FileRecord; bytes: Uint8Array; publicBaseUrl: string }): string {
  const { record, bytes, publicBaseUrl } = input;
  const filename = path.posix.basename(record.path);
  const downloadUrl = buildVaultDownloadUrl(publicBaseUrl, record.path);
  const rawUrl = buildVaultRawUrl(publicBaseUrl, record.path);
  const textFile = isTextFile(record.path, bytes);
  let content: string;
  if (textFile) {
    const text = Buffer.from(bytes).toString("utf8");
    content = record.path.toLowerCase().endsWith(".md")
      ? `<article class="article">${renderMarkdown(text, record.path, publicBaseUrl)}</article>`
      : `<article class="article"><pre>${escapeHtml(text)}</pre></article>`;
  } else {
    content = `<div class="empty">Este arquivo é binário e não pode ser renderizado como texto. Use o botão de download.</div>`;
  }
  const body = `<section class="hero"><h1>${escapeHtml(filename)}</h1><div class="meta"><span>${escapeHtml(record.path)}</span><span>${record.sizeBytes.toLocaleString("pt-BR")} bytes</span><span>Atualizado em ${escapeHtml(new Date(record.modifiedAt).toLocaleString("pt-BR"))}</span></div></section><section class="actions"><a class="button secondary" href="${escapeHtml(buildVaultBrowserUrl(publicBaseUrl))}">← TODOS OS ARQUIVOS</a>${textFile ? `<a class="button secondary" href="${escapeHtml(rawUrl)}">TEXTO BRUTO</a>` : ""}<a class="button" href="${escapeHtml(downloadUrl)}">BAIXAR</a></section><section class="panel">${content}</section>`;
  return shell(filename, body);
}

export function renderViewerError(status: number, message: string): string {
  const body = `<section class="hero"><h1>Não foi possível abrir o arquivo</h1><p>${escapeHtml(message)}</p></section><section class="actions"><a class="button" href="/?tab=notes">VOLTAR AOS ARQUIVOS</a></section>`;
  return shell(`Erro ${status}`, body);
}
