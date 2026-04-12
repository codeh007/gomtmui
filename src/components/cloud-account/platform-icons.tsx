import { Icons } from "mtxuilib/icons/icons";
import type { PlatformName } from "@/lib/cloud-account/platform-configs";

/**
 * Returns the Lucide/MTXUI icon component for the given platform.
 * Used in CloudAccountCard and AddAccountView.
 */
export function getPlatformIcon(name: string): React.ComponentType<{ className?: string }> {
  switch (name.toLowerCase() as PlatformName) {
    case "github":
      // Check if Icons.gitHub exists (it does in mtxuilib/icons/icons.tsx)
      return Icons.gitHub;
    case "telegram":
      // Using PaperPlane as it resembles Telegram logo
      return Icons.PaperPlane;
    case "google":
      // Colored Google logo
      return Icons.google;
    case "qwen":
      // Using Bot icon for AI models
      return Icons.bot;
    default:
      // Fallback
      return Icons.box;
  }
}
