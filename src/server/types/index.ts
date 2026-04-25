// declare global {
declare namespace NodeJS {
  export interface ProcessEnv {
    PORT: string;
    MTX_CACHE_DISABLED: string;
    MTX_CACHE_DEFAULT_SECONDS: string;
    GITHUB_APP_TOKEN: string;
    GITHUB_APP_ID: string;
    GITHUB_APP_PRIVATE_KEY: string;
    GITHUB_ID: string;
    GITHUB_SECRET: string;
    GITHUB_CLIENT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    MTXP2P_BACKEND_URL: string;
    NEXTAUTH_SECRET: string;
    FACEBOOK_ID: string;
    FACEBOOK_SECRET: string;
    TWITTER_ID: string;
    TWITTER_SECRET: string;
    GOOGLE_APP_ID: string;
    GOOGLE_APP_SECRET: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_EMAIL: string;
    CLOUDFLARE_API_TOKEN: string;
  }
}

export type Bindings = Env & {
  // OAUTH_PROVIDER: OAuthHelpers;
};

export type Variables = {
  // userId?: string;
  // user?: {
  //   id: string;
  //   email: string;
  //   name: string | null;
  //   role: string;
  // };
  // organizationId?: string | null;
  // // 向后兼容的别名
  // tenantId?: string | null;
};

export type AppContext = {
  Bindings: Bindings;
  Variables: Variables;
};
