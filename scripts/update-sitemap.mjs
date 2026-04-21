import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_ORIGIN = "https://numbermatch.top";
const OUTPUT_FILE = path.join(ROOT_DIR, "sitemap.xml");
const LASTMOD = process.env.SITEMAP_LASTMOD || new Date().toISOString().slice(0, 10);

const orderedPaths = [
  "/game/number-match",
  "/cn",
  "/jp",
  "/de",
  "/fr",
  "/ru",
  "/es",
  "/pt",
  "/kr",
  "/tag/puzzle-games",
  "/tag/relaxing-games",
  "/privacy",
  "/terms",
  "/cookies",
  "/disclaimer",
];

const languagePaths = new Set([
  "/game/number-match",
  "/cn",
  "/jp",
  "/de",
  "/fr",
  "/ru",
  "/es",
  "/pt",
  "/kr",
]);

const languageOrder = ["x-default", "en", "zh-CN", "ja", "de", "fr", "ru", "es", "pt", "ko"];
const ignoredDirs = new Set([".git", "node_modules"]);

async function main() {
  const files = await findIndexFiles(ROOT_DIR);
  const entries = [];

  for (const file of files) {
    const relativePath = normalizePath(path.relative(ROOT_DIR, file));
    if (relativePath === "index.html") continue;

    const html = await fs.readFile(file, "utf8");
    const canonical = readCanonicalUrl(html);
    if (!canonical || !canonical.startsWith(`${SITE_ORIGIN}/`)) continue;

    const url = new URL(canonical);
    entries.push({
      loc: canonical,
      pathname: normalizeCanonicalPath(url.pathname),
      alternates: readAlternateUrls(html),
    });
  }

  entries.sort((left, right) => {
    const rankDiff = pathRank(left.pathname) - pathRank(right.pathname);
    return rankDiff || left.pathname.localeCompare(right.pathname);
  });

  const xml = renderSitemap(entries);
  await fs.writeFile(OUTPUT_FILE, `${xml}\n`, "utf8");
  console.log(`Updated sitemap.xml with ${entries.length} URLs.`);
}

async function findIndexFiles(directory) {
  const files = [];
  const items = await fs.readdir(directory, { withFileTypes: true });

  for (const item of items) {
    if (ignoredDirs.has(item.name)) continue;

    const itemPath = path.join(directory, item.name);
    if (item.isDirectory()) {
      files.push(...await findIndexFiles(itemPath));
      continue;
    }

    if (item.isFile() && item.name === "index.html") {
      files.push(itemPath);
    }
  }

  return files;
}

function readCanonicalUrl(html) {
  for (const tag of readLinkTags(html)) {
    const attrs = readAttributes(tag);
    if (!hasRel(attrs, "canonical") || !attrs.href) continue;
    return new URL(attrs.href, SITE_ORIGIN).href.replace(/\/$/, "");
  }

  return "";
}

function readAlternateUrls(html) {
  const alternates = [];

  for (const tag of readLinkTags(html)) {
    const attrs = readAttributes(tag);
    if (!hasRel(attrs, "alternate") || !attrs.href || !attrs.hreflang) continue;

    alternates.push({
      hreflang: attrs.hreflang,
      href: new URL(attrs.href, SITE_ORIGIN).href.replace(/\/$/, ""),
    });
  }

  return alternates.sort((left, right) => languageRank(left.hreflang) - languageRank(right.hreflang));
}

function readLinkTags(html) {
  return html.match(/<link\b[^>]*>/gi) || [];
}

function readAttributes(tag) {
  const attrs = {};
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(tag))) {
    const name = match[1].toLowerCase();
    if (name === "link") continue;
    attrs[name] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
}

function hasRel(attrs, relName) {
  return (attrs.rel || "").split(/\s+/).includes(relName);
}

function renderSitemap(entries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  for (const entry of entries) {
    const settings = sitemapSettings(entry.pathname);

    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);

    for (const alternate of entry.alternates) {
      lines.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}" />`);
    }

    lines.push(`    <lastmod>${LASTMOD}</lastmod>`);
    lines.push(`    <changefreq>${settings.changefreq}</changefreq>`);
    lines.push(`    <priority>${settings.priority}</priority>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return lines.join("\n");
}

function sitemapSettings(pathname) {
  if (pathname === "/game/number-match") {
    return { changefreq: "weekly", priority: "1.0" };
  }

  if (languagePaths.has(pathname)) {
    return { changefreq: "weekly", priority: "0.9" };
  }

  if (pathname.startsWith("/tag/")) {
    return { changefreq: "monthly", priority: "0.6" };
  }

  return { changefreq: "yearly", priority: "0.3" };
}

function pathRank(pathname) {
  const index = orderedPaths.indexOf(pathname);
  return index === -1 ? orderedPaths.length : index;
}

function languageRank(hreflang) {
  const index = languageOrder.indexOf(hreflang);
  return index === -1 ? languageOrder.length : index;
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function normalizeCanonicalPath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
