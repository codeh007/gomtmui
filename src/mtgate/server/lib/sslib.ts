export const getServerBaseUrl = () => {
  const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (publicSiteUrl) {
    return publicSiteUrl;
  }

  const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  const baseUrl = process.env.BASE_URL?.trim();
  if (baseUrl) {
    return baseUrl;
  }

  const codespaceName = process.env.CODESPACE_NAME;
  const port = process.env.PORT;
  if (codespaceName && port) {
    return `https://${codespaceName}-${port}.app.github.dev`;
  }

  throw new Error("require NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_BASE_URL, BASE_URL, or both CODESPACE_NAME and PORT");
};
