export type WikiPagePayload = {
  title: string;
  path: string;
  sourcePath: string;
  markdown: string;
  frontmatter: {
    title?: string;
    created?: string;
    updated?: string;
    type?: string;
    tags?: string[];
    sources?: string[];
  };
  kind: "page" | "index";
};

function getGomtmServerUrl() {
  const configuredUrl = process.env.GOMTM_SERVER_URL?.trim() || process.env.NEXT_PUBLIC_GOMTM_SERVER_URL?.trim();
  if (!configuredUrl) {
    throw new Error("missing GOMTM_SERVER_URL or NEXT_PUBLIC_GOMTM_SERVER_URL");
  }
  return configuredUrl.replace(/\/$/, "");
}

export async function fetchWikiPage(slug: string[]) {
  const baseUrl = getGomtmServerUrl();
  const cleanSegments = slug
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .map(encodeURIComponent);
  const url = cleanSegments.length === 0 ? `${baseUrl}/api/wiki/page` : `${baseUrl}/api/wiki/page/${cleanSegments.join("/")}`;
  return fetch(url, { cache: "no-store" });
}
