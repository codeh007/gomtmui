import React from "react";
import type { AuthFlowType, PlatformConfig } from "@/lib/cloud-account/platform-configs";
import { DeviceFlow } from "./auth-flows/DeviceFlow";
import { OAuth2AuthCodeFlow } from "./auth-flows/OAuth2AuthCodeFlow";
import { PasswordFlow } from "./auth-flows/PasswordFlow";
import { PhoneVerificationFlow } from "./auth-flows/PhoneVerificationFlow";
import { QRCodeFlow } from "./auth-flows/QRCodeFlow";

interface AuthFlowRouterProps {
  platform: PlatformConfig;
  accountId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AuthFlowRouter: React.FC<AuthFlowRouterProps> = ({ platform, accountId, onSuccess, onCancel }) => {
  const flowProps = {
    platform,
    accountId,
    onSuccess,
    onCancel,
  };

  switch (platform.authFlow as AuthFlowType) {
    case "oauth2_device":
      return <DeviceFlow {...flowProps} />;
    case "oauth2_authorization_code":
      return <OAuth2AuthCodeFlow {...flowProps} />;
    case "qrcode":
      return <QRCodeFlow {...flowProps} />;
    case "password":
      return <PasswordFlow platform={platform} />;
    case "phone_verification":
      return <PhoneVerificationFlow {...flowProps} />;
    default:
      return (
        <div className="p-4 text-center">
          <p className="text-destructive font-medium">Unsupported authentication flow: {platform.authFlow}</p>
        </div>
      );
  }
};
