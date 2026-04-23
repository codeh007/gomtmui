"use client";

import {
  Activity,
  BarChart3,
  Clock3,
  FileText,
  KeyRound,
  MessageSquare,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "mtxuilib/lib/utils";

type HermesNavItem = {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
};

const HERMES_ITEMS: HermesNavItem[] = [
  {
    href: "/dash/hermes",
    label: "Status",
    icon: Activity,
    description: "Gateway runtime, platform health, and live sessions.",
  },
  {
    href: "/dash/hermes/sessions",
    label: "Sessions",
    icon: MessageSquare,
    description: "Conversation history and search.",
  },
  {
    href: "/dash/hermes/analytics",
    label: "Analytics",
    icon: BarChart3,
    description: "Usage, tokens, and model breakdown.",
  },
  {
    href: "/dash/hermes/logs",
    label: "Logs",
    icon: FileText,
    description: "Agent, gateway, and error logs.",
  },
  {
    href: "/dash/hermes/cron",
    label: "Cron",
    icon: Clock3,
    description: "Scheduled jobs and delivery status.",
  },
  {
    href: "/dash/hermes/skills",
    label: "Skills",
    icon: Package,
    description: "Installed skills and toolsets.",
  },
  {
    href: "/dash/hermes/config",
    label: "Config",
    icon: Settings,
    description: "Resolved config, defaults, and model info.",
  },
  {
    href: "/dash/hermes/env",
    label: "Keys",
    icon: KeyRound,
    description: "Provider credentials and environment state.",
  },
];

export function HermesNav() {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto rounded-xl border bg-card/40">
      <div className="flex min-w-max gap-0">
      {HERMES_ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.description}
            className={cn(
              "group relative flex min-w-[132px] flex-col gap-1 border-r px-4 py-3 text-left transition-colors last:border-r-0",
              active
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]">
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </div>
            <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground transition-colors group-hover:text-foreground/80">
              {item.description}
            </span>
            {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" /> : null}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
