import { SiteHeader } from "@/components/site/site-header";
import { WikiMarkdown } from "@/components/wiki/wiki-markdown";
import { notFound } from "next/navigation";
import { fetchWikiPage, type WikiPagePayload } from "../wiki-client";

export const dynamic = "force-dynamic";

type WikiPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

async function readWikiPayload(response: Response) {
  try {
    return (await response.json()) as WikiPagePayload | { error?: string; sourceDir?: string };
  } catch {
    return null;
  }
}

function renderErrorState(title: string, message: string, detail?: string) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border bg-background/95 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          {detail ? <pre className="mt-4 overflow-x-auto rounded-2xl bg-muted p-4 text-xs text-muted-foreground">{detail}</pre> : null}
        </div>
      </main>
    </div>
  );
}

export default async function WikiPage(props: WikiPageProps) {
  const { slug = [] } = await props.params;

  let response: Response;
  try {
    response = await fetchWikiPage(slug);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return renderErrorState("wiki 暂不可用", "当前无法连接 gomtm wiki API。", message);
  }

  if (response.status === 404) {
    notFound();
  }

  const payload = await readWikiPayload(response);
  if (!response.ok) {
    const errorMessage = payload && "error" in payload && typeof payload.error === "string" ? payload.error : `request failed: ${response.status}`;
    const detail = payload && "sourceDir" in payload && typeof payload.sourceDir === "string" ? `source_dir: ${payload.sourceDir}` : undefined;
    if (response.status === 503) {
      return renderErrorState("wiki 暂未就绪", errorMessage, detail);
    }
    return renderErrorState("wiki 加载失败", errorMessage, detail);
  }

  if (!payload || !("markdown" in payload) || typeof payload.markdown !== "string") {
    return renderErrorState("wiki 渲染失败", "gomtm wiki API 返回了无效响应。", response.statusText || "invalid payload");
  }

  const updated = payload.frontmatter?.updated?.trim() ?? "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border bg-background/95 px-5 py-4 shadow-sm sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">GoMTM Wiki</p>
              <h1 className="mt-1 text-2xl font-semibold">{payload.title}</h1>
            </div>
            <div className="text-xs text-muted-foreground sm:text-right">
              {updated ? <div>updated: {updated}</div> : null}
              <div>{payload.sourcePath}</div>
            </div>
          </div>
        </div>

        <WikiMarkdown currentPath={payload.path} markdown={payload.markdown} />
      </main>
    </div>
  );
}
