declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    NEXT_PUBLIC_SITE_URL?: string;
    NEXT_PUBLIC_BASE_URL?: string;
    NEXT_PUBLIC_GITHUB_CLIENT_ID?: string;
    NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    NEXT_PUBLIC_QWEN_CLIENT_ID?: string;
    NEXT_PUBLIC_LANGFUSE_BASE_URL?: string;
    BASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    NEXT_BUILD_OUTPUT?: string;
    CODESPACE_NAME?: string;
  }
}

export {};
