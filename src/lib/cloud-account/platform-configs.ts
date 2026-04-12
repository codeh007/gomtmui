export type AuthFlowType =
  | "oauth2_authorization_code"
  | "oauth2_device"
  | "qrcode"
  | "password"
  | "api_key"
  | "phone_verification";

export interface PlatformConfig {
  readonly name: string;
  readonly displayName: string;
  readonly authFlow: AuthFlowType;
  readonly baseUrl?: string;
  readonly oauth?: {
    readonly clientId: string;
    readonly clientSecret?: string;
    readonly tokenUrl: string;
    readonly authUrl?: string;
    readonly deviceAuthorizationUrl?: string;
    readonly scope?: readonly string[];
  };
  readonly qrcode?: {
    readonly generateUrl: string;
    readonly pollUrl: string;
  };
}

export const PLATFORM_CONFIGS = {
  qwen: {
    name: "qwen",
    displayName: "通义千问",
    authFlow: "oauth2_device",
    baseUrl: "https://dashscope.aliyuncs.com",
    oauth: {
      clientId: process.env.NEXT_PUBLIC_QWEN_CLIENT_ID || "",
      tokenUrl: "https://oauth.aliyun.com/v1/token",
      deviceAuthorizationUrl: "https://oauth.aliyun.com/v1/device/user/code",
    },
  },
  telegram: {
    name: "telegram",
    displayName: "Telegram",
    authFlow: "phone_verification",
    baseUrl: "https://telegram.org",
  },
  github: {
    name: "github",
    displayName: "GitHub",
    authFlow: "oauth2_authorization_code",
    baseUrl: "https://api.github.com",
    oauth: {
      clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "",
      authUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scope: ["read:user", "user:email"],
    },
  },
  google: {
    name: "google",
    displayName: "Google",
    authFlow: "oauth2_authorization_code",
    baseUrl: "https://www.googleapis.com",
    oauth: {
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
    },
  },
} as const;

export type PlatformName = keyof typeof PLATFORM_CONFIGS;
