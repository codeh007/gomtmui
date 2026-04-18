import * as path from "node:path";

const WIKI_ROOT = "/wiki";
const WIKI_SECTION_PREFIXES = ["concepts", "queries", "comparisons", "reports", "entities"] as const;

function splitHash(input: string) {
  const hashIndex = input.indexOf("#");
  if (hashIndex < 0) {
    return { pathname: input, hash: "" };
  }
  return {
    pathname: input.slice(0, hashIndex),
    hash: input.slice(hashIndex),
  };
}

function normalizeWikiTarget(target: string) {
  const normalized = target.trim().replace(/\\/g, "/");
  const { pathname, hash } = splitHash(normalized);
  const withoutPrefix = pathname.replace(/^\/+/, "").replace(/\.md$/i, "");
  const clean = path.posix.normalize(`/${withoutPrefix}`).replace(/^\/+/, "");
  const withoutIndex = clean === "index" ? "" : clean.replace(/\/index$/i, "");
  return {
    pathname: withoutIndex,
    href: withoutIndex === "" ? `${WIKI_ROOT}${hash}` : `${WIKI_ROOT}/${withoutIndex}${hash}`,
  };
}

function isExternalHref(href: string) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function hasWikiSectionPrefix(target: string) {
  const normalized = normalizeWikiTarget(target).pathname;
  if (normalized === "") {
    return true;
  }
  const firstSegment = normalized.split("/")[0];
  return WIKI_SECTION_PREFIXES.includes(firstSegment as (typeof WIKI_SECTION_PREFIXES)[number]);
}

export function rewriteWikiLinks(markdown: string) {
  return markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, rawTarget: string, rawLabel?: string) => {
    const label = (rawLabel ?? rawTarget).trim();
    const target = normalizeWikiTarget(rawTarget).href;
    return `[${label}](${target})`;
  });
}

export function resolveWikiHref(currentPath: string, href: string) {
  const trimmed = href.trim();
  if (trimmed === "" || trimmed.startsWith("#") || isExternalHref(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith(WIKI_ROOT)) {
    return normalizeWikiTarget(trimmed.slice(WIKI_ROOT.length)).href;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (!/\.md(?:#.*)?$/i.test(trimmed)) {
    return trimmed;
  }

  const currentRelative = currentPath === WIKI_ROOT ? "" : currentPath.replace(`${WIKI_ROOT}/`, "");
  const baseDir = currentRelative === "" ? "/" : `/${path.posix.dirname(currentRelative)}`;
  return normalizeWikiTarget(path.posix.join(baseDir, trimmed)).href;
}

export function resolveWikiApiSlug(slug: string[]) {
  const cleaned = slug
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  if (cleaned.length === 0) {
    return [];
  }

  if (hasWikiSectionPrefix(cleaned.join("/"))) {
    return cleaned;
  }

  return ["concepts", ...cleaned];
}
