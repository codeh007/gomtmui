"use client";

import { Package, Search, Wrench } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "mtxuilib/ui/tabs";
import { useEffect, useMemo, useState } from "react";

import { useHermesApi } from "@/components/hermes/use-hermes-api";
import type { SkillInfo, ToolsetInfo } from "@/lib/hermes/types";

function prettyCategory(raw: string | null | undefined): string {
  if (!raw) return "General";
  return raw
    .split(/[\/_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" / ");
}

export function HermesSkillsPage() {
  const hermesApi = useHermesApi();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [toolsets, setToolsets] = useState<ToolsetInfo[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([hermesApi.getSkills(), hermesApi.getToolsets()])
      .then(([skillResponse, toolsetResponse]) => {
        if (cancelled) return;
        setSkills(skillResponse);
        setToolsets(toolsetResponse);
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
  }, [hermesApi]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSkills = useMemo(() => {
    return skills
      .filter((skill) => {
        if (!normalizedQuery) return true;
        return [skill.name, skill.description, skill.category].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [normalizedQuery, skills]);

  const filteredToolsets = useMemo(() => {
    return toolsets
      .filter((toolset) => {
        if (!normalizedQuery) return true;
        return [toolset.name, toolset.label, toolset.description, ...toolset.tools].some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [normalizedQuery, toolsets]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-muted-foreground" />
            Skills Inventory
          </CardTitle>
          <CardDescription>Browse configured Hermes skills and toolsets. This page is read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search skills or toolsets" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error ? <div className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {loading ? <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">Loading skills...</div> : null}

      {!loading && !error ? (
        <Tabs defaultValue="skills" className="space-y-4">
          <TabsList>
            <TabsTrigger value="skills">Skills ({filteredSkills.length})</TabsTrigger>
            <TabsTrigger value="toolsets">Toolsets ({filteredToolsets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="skills" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Available Skills</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredSkills.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No skills match the current search.</div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {filteredSkills.map((skill) => (
                      <div key={skill.name} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="font-mono text-sm">{skill.name}</div>
                            <div className="text-xs text-muted-foreground">{prettyCategory(skill.category)}</div>
                          </div>
                          <Badge variant={skill.enabled ? "default" : "secondary"}>{skill.enabled ? "enabled" : "disabled"}</Badge>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">{skill.description || "No description provided."}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="toolsets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  Toolsets
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredToolsets.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No toolsets match the current search.</div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {filteredToolsets.map((toolset) => (
                      <div key={toolset.name} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="font-medium">{toolset.label}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">{toolset.name}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={toolset.enabled ? "default" : "secondary"}>{toolset.enabled ? "enabled" : "disabled"}</Badge>
                            <Badge variant={toolset.configured ? "outline" : "secondary"}>{toolset.configured ? "configured" : "needs setup"}</Badge>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">{toolset.description}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {toolset.tools.length > 0 ? (
                            toolset.tools.map((tool) => (
                              <Badge key={tool} variant="secondary" className="font-mono text-[10px]">
                                {tool}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No tool metadata reported.</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
