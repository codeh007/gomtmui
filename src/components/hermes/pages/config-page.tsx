"use client";

import { Bot, Search, Settings2 } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "mtxuilib/ui/tabs";
import { useEffect, useMemo, useState } from "react";

import { hermesApi } from "@/lib/hermes/api";
import { formatTokenCount } from "@/lib/hermes/format";
import { getNestedValue } from "@/lib/hermes/nested";
import type { ModelInfoResponse } from "@/lib/hermes/types";

type SchemaField = {
  category?: string;
  default?: unknown;
  description?: string;
  enum?: unknown[];
  type?: string;
};

type SchemaResponse = {
  category_order: string[];
  fields: Record<string, SchemaField>;
};

type LoadState = {
  config: Record<string, unknown>;
  defaults: Record<string, unknown>;
  modelInfo: ModelInfoResponse | null;
  schema: SchemaResponse;
};

function prettyCategory(raw: string): string {
  return raw
    .split(/[\/_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" / ");
}

function formatValue(value: unknown): string {
  if (value === undefined) return "-";
  if (value === null) return "null";
  if (typeof value === "string") return value || '""';
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatFieldType(field: SchemaField): string {
  if (field.type) return field.type;
  if (Array.isArray(field.enum) && field.enum.length > 0) return "enum";
  return "unknown";
}

export function HermesConfigPage() {
  const [data, setData] = useState<LoadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([hermesApi.getConfig(), hermesApi.getSchema(), hermesApi.getDefaults(), hermesApi.getModelInfo()])
      .then(([config, schema, defaults, modelInfo]) => {
        if (cancelled) return;
        const nextData: LoadState = {
          config,
          defaults,
          modelInfo,
          schema: {
            category_order: schema.category_order,
            fields: schema.fields as Record<string, SchemaField>,
          },
        };
        setData(nextData);
        setActiveCategory(schema.category_order[0] || "general");
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

  const categories = useMemo(() => {
    if (!data) return [];

    const schemaCategories = new Set(
      Object.values(data.schema.fields).map((field) => String(field.category || "general")),
    );

    const ordered = data.schema.category_order.filter((category) => schemaCategories.has(category));
    const extras = [...schemaCategories].filter((category) => !ordered.includes(category)).sort();

    return [...ordered, ...extras];
  }, [data]);

  const normalizedSearch = search.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!data || !normalizedSearch) return [];

    return Object.entries(data.schema.fields).filter(([key, field]) => {
      return [key, field.description, field.category, field.type]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [data, normalizedSearch]);

  const activeFields = useMemo(() => {
    if (!data || normalizedSearch) return [];
    return Object.entries(data.schema.fields).filter(([, field]) => String(field.category || "general") === activeCategory);
  }, [activeCategory, data, normalizedSearch]);

  if (loading) {
    return <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">Loading config...</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>;
  }

  if (!data) {
    return <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">No config data available.</div>;
  }

  const visibleFields = normalizedSearch ? searchResults : activeFields;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Config Browser
          </CardTitle>
          <CardDescription>Read-only browse of Hermes config, schema defaults, and resolved model metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search config fields" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {categories.map((category) => {
              const isActive = !normalizedSearch && activeCategory === category;
              const count = Object.values(data.schema.fields).filter((field) => String(field.category || "general") === category).length;

              return (
                <button
                  key={category}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setSearch("");
                    setActiveCategory(category);
                  }}
                >
                  <span>{prettyCategory(category)}</span>
                  <Badge variant="secondary">{count}</Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Tabs defaultValue="fields" className="space-y-4">
            <TabsList>
              <TabsTrigger value="fields">Fields ({visibleFields.length})</TabsTrigger>
              <TabsTrigger value="model">Model Info</TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {normalizedSearch ? "Search Results" : prettyCategory(activeCategory || "general")}
                  </CardTitle>
                  <CardDescription>
                    {normalizedSearch
                      ? `Showing fields that match "${search.trim()}".`
                      : "Current value, default value, and schema metadata are shown side by side."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {visibleFields.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No config fields match the current view.</div>
                  ) : (
                    <div className="space-y-3">
                      {visibleFields.map(([key, field]) => {
                        const currentValue = getNestedValue(data.config, key);
                        const defaultValue = getNestedValue(data.defaults, key) ?? field.default;

                        return (
                          <div key={key} className="rounded-lg border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-mono text-sm">{key}</div>
                              <Badge variant="outline">{formatFieldType(field)}</Badge>
                              <Badge variant="secondary">{prettyCategory(String(field.category || "general"))}</Badge>
                            </div>

                            {field.description ? <p className="mt-2 text-sm text-muted-foreground">{field.description}</p> : null}

                            <div className="mt-3 grid gap-3 xl:grid-cols-2">
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Current Value</div>
                                <pre className="overflow-x-auto rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
                                  {formatValue(currentValue)}
                                </pre>
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Default Value</div>
                                <pre className="overflow-x-auto rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
                                  {formatValue(defaultValue)}
                                </pre>
                              </div>
                            </div>

                            {Array.isArray(field.enum) && field.enum.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {field.enum.map((entry) => (
                                  <Badge key={String(entry)} variant="secondary" className="font-mono text-[10px]">
                                    {String(entry)}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="model" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    Resolved Model
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.modelInfo ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border p-4">
                          <div className="text-xs text-muted-foreground">Model</div>
                          <div className="mt-1 font-mono text-sm">{data.modelInfo.model || "-"}</div>
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="text-xs text-muted-foreground">Provider</div>
                          <div className="mt-1 text-sm">{data.modelInfo.provider || "-"}</div>
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="text-xs text-muted-foreground">Effective Context</div>
                          <div className="mt-1 text-sm">{formatTokenCount(data.modelInfo.effective_context_length || 0)}</div>
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="text-xs text-muted-foreground">Configured Context</div>
                          <div className="mt-1 text-sm">{formatTokenCount(data.modelInfo.config_context_length || 0)}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {data.modelInfo.capabilities?.supports_tools ? <Badge>tools</Badge> : null}
                        {data.modelInfo.capabilities?.supports_vision ? <Badge variant="secondary">vision</Badge> : null}
                        {data.modelInfo.capabilities?.supports_reasoning ? <Badge variant="secondary">reasoning</Badge> : null}
                        {data.modelInfo.capabilities?.model_family ? <Badge variant="outline">{data.modelInfo.capabilities.model_family}</Badge> : null}
                        {data.modelInfo.capabilities?.context_window ? (
                          <Badge variant="outline">ctx {formatTokenCount(data.modelInfo.capabilities.context_window)}</Badge>
                        ) : null}
                        {data.modelInfo.capabilities?.max_output_tokens ? (
                          <Badge variant="outline">max out {formatTokenCount(data.modelInfo.capabilities.max_output_tokens)}</Badge>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No model metadata returned by Hermes.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
