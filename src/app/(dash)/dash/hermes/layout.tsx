import { loadHermesSessionToken } from "@/lib/hermes/session-token";

export default async function Layout({ children }: { children: React.ReactNode }) {
  let sessionToken: string | null = null;

  try {
    sessionToken = await loadHermesSessionToken();
  } catch {
    sessionToken = null;
  }

  return (
    <>
      {sessionToken ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__HERMES_SESSION_TOKEN__=${JSON.stringify(sessionToken)};`,
          }}
        />
      ) : null}
      {children}
    </>
  );
}
