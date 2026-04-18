import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolveWikiHref, rewriteWikiLinks } from "@/app/(web)/wiki/wiki-links";

type WikiMarkdownProps = {
  currentPath: string;
  markdown: string;
};

export function WikiMarkdown(props: WikiMarkdownProps) {
  const normalizedMarkdown = rewriteWikiLinks(props.markdown);

  return (
    <div className="mx-auto w-full max-w-4xl rounded-3xl border bg-background/95 px-5 py-8 shadow-sm sm:px-8 sm:py-10 [&_a]:break-all [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mb-6 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_hr]:my-8 [&_img]:rounded-xl [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_tbody_tr]:border-t [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = "", children, ...anchorProps }) => {
            const resolvedHref = resolveWikiHref(props.currentPath, href);
            if (resolvedHref.startsWith("/wiki")) {
              return <Link href={resolvedHref}>{children}</Link>;
            }
            return (
              <a {...anchorProps} href={resolvedHref} rel="noreferrer" target={resolvedHref.startsWith("http") ? "_blank" : undefined}>
                {children}
              </a>
            );
          },
        }}
      >
        {normalizedMarkdown}
      </ReactMarkdown>
    </div>
  );
}
