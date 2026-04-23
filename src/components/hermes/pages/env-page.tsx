"use client";

import { ExternalLink, KeyRound, Settings, Wrench, Zap } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { useEffect, useMemo, useState } from "react";

import { hermesApi } from "@/lib/hermes/api";
import type { EnvVarInfo } from "@/lib/hermes/types";

const PROVIDER_GROUPS: Array<{ name: string; prefix: string; priority: number }> = [
  { prefix: "NOUS_", name: "Nous Portal", priority: 0 },
  { prefix: "ANTHROPIC_", name: "Anthropic", priority: 1 },
  { prefix: "DASHSCOPE_", name: "DashScope (Qwen)", priority: 2 },
  { prefix: "HERMES_QWEN_", name: "DashScope (Qwen)", priority: 2 },
  { prefix: "DEEPSEEK_", name: "DeepSeek", priority: 3 },
  { prefix: "GOOGLE_", name: "Gemini", priority: 4 },
  { prefix: "GEMINI_", name: "Gemini", priority: 4 },
  { prefix: "GLM_", name: "GLM / Z.AI", priority: 5 },
  { prefix: "ZAI_", name: "GLM / Z.AI", priority: 5 },
  { prefix: "Z_AI_", name: "GLM / Z.AI", priority: 5 },
  { prefix: "HF_", name: "Hugging Face", priority: 6 },
  { prefix: "KIMI_", name: "Kimi / Moonshot", priority: 7 },
  { prefix: "MINIMAX_", name: "MiniMax", priority: 8 },
  { prefix: "MINIMAX_CN_", name: "MiniMax (China)", priority: 9 },
  { prefix: "OPENCODE_GO_", name: "OpenCode Go", priority: 10 },
  { prefix: "OPENCODE_ZEN_", name: "OpenCode Zen", priority: 11 },
  { prefix: "OPENROUTER_", name: "OpenRouter", priority: 12 },
  { prefix: "XIAOMI_", name: "Xiaomi MiMo", priority: 13 },
];

function getProviderGroup(key: string): { name: string; priority: number } {
  const match = PROVIDER_GROUPS.find((group) => key.startsWith(group.prefix));
  if (match) return { name: match.name, priority: match.priority };
  return { name: "Other", priority: 99 };
}

function getCategoryIcon(category: string) {
  if (category === "provider") return Zap;
  if (category === "tool") return Wrench;
  return Settings;
}

export function HermesEnvPage() {
  const [vars, setVars] = useState<Record<string, EnvVarInfo> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hermesApi
      .getEnvVars()
      .then((response) => {
        if (cancelled) return;
        setVars(response);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const providerGroups = useMemo(() => {
    if (!vars) return [];

    const grouped = new Map<string, { priority: number; entries: Array<[string, EnvVarInfo]> }>();

    for (const entry of Object.entries(vars).filter(([, info]) => info.category === "provider")) {
      const group = getProviderGroup(entry[0]);
      const current = grouped.get(group.name);
      if (current) {
        current.entries.push(entry);
      } else {
        grouped.set(group.name, { priority: group.priority, entries: [entry] });
      }
    }

    return [...grouped.entries()]
      .map(([name, value]) => ({
        configured: value.entries.filter(([, info]) => info.is_set).length,
        entries: value.entries.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
        name,
        priority: value.priority,
      }))
      .sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name));
  }, [vars]);

  const otherGroups = useMemo(() => {
    if (!vars) return [];

    const categories = ["tool", "messaging", "setting"];

    return categories
      .map((category) => ({
        category,
        entries: Object.entries(vars)
          .filter(([, info]) => info.category === category)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
      }))
      .filter((group) => group.entries.length > 0);
  }, [vars]);

  if (loading) {
    return <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">Loading environment keys...</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>;
  }

  if (!vars) {
    return <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">No environment metadata available.</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Provider Keys
          </CardTitle>
          <CardDescription>Read-only visibility into provider configuration state, grouped by provider.</CardDescription>
        </CardHeader>
      </Card>

      {providerGroups.map((group) => (
        <Card key={group.name}>
          <CardHeader>
            <CardTitle className="text-base">{group.name}</CardTitle>
            <CardDescription>
              {group.configured} of {group.entries.length} configured
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.entries.map(([key, info]) => (
              <div key={key} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-mono text-sm">{key}</div>
                  <Badge variant={info.is_set ? "default" : "secondary"}>{info.is_set ? "set" : "not set"}</Badge>
                  {info.advanced ? <Badge variant="outline">advanced</Badge> : null}
                  {info.is_password ? <Badge variant="outline">secret</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{info.description || "No description provided."}</p>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                  <div className="space-y-2">
                    <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground break-all">
                      {info.is_set ? info.redacted_value || "configured" : "not configured"}
                    </div>
                    {info.tools.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {info.tools.map((tool) => (
                          <Badge key={tool} variant="secondary" className="font-mono text-[10px]">
                            {tool}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {info.url ? (
                    <a
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      href={info.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Provider docs
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {otherGroups.map((group) => {
        const Icon = getCategoryIcon(group.category);

        return (
          <Card key={group.category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {group.category}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.entries.map(([key, info]) => (
                <div key={key} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-mono text-sm">{key}</div>
                    <Badge variant={info.is_set ? "default" : "secondary"}>{info.is_set ? "set" : "not set"}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{info.description || "No description provided."}</p>
                  {info.tools.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {info.tools.map((tool) => (
                        <Badge key={tool} variant="secondary" className="font-mono text-[10px]">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
