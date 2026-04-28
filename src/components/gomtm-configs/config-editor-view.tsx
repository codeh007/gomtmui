"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Rocket, Save } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Textarea } from "mtxuilib/ui/textarea";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createDefaultGomtmConfigDocument,
  createDefaultGomtmConfigProfile,
  extractGomtmConfigDocument,
  gomtmConfigTargetKinds,
  GomtmConfigDocumentSchema,
  GomtmConfigProfileSchema,
  overlayGomtmConfigDocument,
  parseGomtmConfigYaml,
  resolveGomtmConfigSource,
  stringifyGomtmConfigSource,
  type GomtmConfigDocument,
  type GomtmConfigProfile,
  type GomtmConfigProfileUpsert,
  type GomtmConfigTargetKind,
} from "./config-schema";
import { createConfigProfile, fetchRuntimeConfigUrl, publishConfigProfile, saveConfigProfile } from "@/lib/gomtm-configs/api";

const CONFIG_PROFILES_QUERY_KEY = ["gomtm-config-profiles"] as const;

type EditorMode = "form" | "yaml";

interface ConfigEditorViewProps {
  initialProfile: GomtmConfigProfile;
  isNew?: boolean;
}

type ConfigEditorFormValues = {
  name: string;
  description: string;
  target_kind: GomtmConfigTargetKind;
  server_listen: string;
  server_instance_id: string;
  server_storage_root_dir: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
  cloudflare_api_token: string;
  cloudflare_account_id: string;
  cloudflare_zone_id: string;
  cloudflare_tunnel_domain: string;
  hermes_gateway_enable: boolean;
};

function hasSameFormValues(left: ConfigEditorFormValues, right: ConfigEditorFormValues) {
  return (
    left.name === right.name &&
    left.description === right.description &&
    left.target_kind === right.target_kind &&
    left.server_listen === right.server_listen &&
    left.server_instance_id === right.server_instance_id &&
    left.server_storage_root_dir === right.server_storage_root_dir &&
    left.supabase_url === right.supabase_url &&
    left.supabase_anon_key === right.supabase_anon_key &&
    left.supabase_service_role_key === right.supabase_service_role_key &&
    left.cloudflare_api_token === right.cloudflare_api_token &&
    left.cloudflare_account_id === right.cloudflare_account_id &&
    left.cloudflare_zone_id === right.cloudflare_zone_id &&
    left.cloudflare_tunnel_domain === right.cloudflare_tunnel_domain &&
    left.hermes_gateway_enable === right.hermes_gateway_enable
  );
}

function getFormValues(profile: GomtmConfigProfile, document: GomtmConfigDocument): ConfigEditorFormValues {
  return {
    name: profile.name,
    description: profile.description,
    target_kind: profile.target_kind,
    server_listen: document.server.listen,
    server_instance_id: document.server.instance_id,
    server_storage_root_dir: document.server.storage.root_dir,
    supabase_url: document.supabase.url,
    supabase_anon_key: document.supabase.anon_key,
    supabase_service_role_key: document.supabase.service_role_key,
    cloudflare_api_token: document.cloudflare.cloudflare_api_token,
    cloudflare_account_id: document.cloudflare.cloudflare_account_id,
    cloudflare_zone_id: document.cloudflare.cloudflare_zone_id,
    cloudflare_tunnel_domain: document.cloudflare.tunnel_domain,
    hermes_gateway_enable: document.mtmai.hermes_gateway.enable,
  };
}

function getDocumentFromFormValues(values: ConfigEditorFormValues) {
  return GomtmConfigDocumentSchema.parse({
    server: {
      listen: values.server_listen,
      instance_id: values.server_instance_id,
      storage: {
        root_dir: values.server_storage_root_dir,
      },
    },
    supabase: {
      url: values.supabase_url,
      anon_key: values.supabase_anon_key,
      service_role_key: values.supabase_service_role_key,
    },
    cloudflare: {
      cloudflare_api_token: values.cloudflare_api_token,
      cloudflare_account_id: values.cloudflare_account_id,
      cloudflare_zone_id: values.cloudflare_zone_id,
      tunnel_domain: values.cloudflare_tunnel_domain,
    },
    mtmai: {
      hermes_gateway: {
        enable: values.hermes_gateway_enable,
      },
    },
  });
}

function buildStructuredPayload(values: ConfigEditorFormValues, baseConfigSource: Record<string, unknown>): GomtmConfigProfileUpsert {
  const nextDocument = getDocumentFromFormValues(values);
  const nextConfigSource = overlayGomtmConfigDocument(baseConfigSource, nextDocument);

  return {
    name: values.name,
    description: values.description,
    target_kind: values.target_kind,
    config_yaml: stringifyGomtmConfigSource(nextConfigSource),
  };
}

function buildYamlPayload(values: ConfigEditorFormValues, rawYaml: string): GomtmConfigProfileUpsert {
  const parsedSource = parseGomtmConfigYaml(rawYaml);

  return {
    name: values.name,
    description: values.description,
    target_kind: values.target_kind,
    config_yaml: stringifyGomtmConfigSource(parsedSource),
  };
}

function createEditorState(profile: GomtmConfigProfile) {
  const configSource = resolveGomtmConfigSource(profile);
  const configDocument = extractGomtmConfigDocument(configSource);

  return {
    configSource,
    formValues: getFormValues(profile, configDocument),
    rawYaml: profile.config_yaml || stringifyGomtmConfigSource(overlayGomtmConfigDocument({}, createDefaultGomtmConfigDocument())),
  };
}

function hasUnsavedNewProfile(profile: Pick<GomtmConfigProfile, "current_version" | "published_version" | "updated_at">, isNew: boolean) {
  return isNew && profile.current_version == null && profile.published_version == null && profile.updated_at == null;
}

function getSaveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.startsWith("409:")) {
    return "配置名称已存在，请更换名称后再保存";
  }

  return error instanceof Error ? error.message : "保存失败";
}

export function ConfigEditorView({ initialProfile, isNew = false }: ConfigEditorViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<EditorMode>("form");
  const [profile, setProfile] = useState(() => GomtmConfigProfileSchema.parse(initialProfile));
  const initialEditorState = useMemo(() => createEditorState(profile), [profile]);
  const [formDefaults, setFormDefaults] = useState(initialEditorState.formValues);
  const [rawConfigSource, setRawConfigSource] = useState<Record<string, unknown>>(initialEditorState.configSource);
  const [rawConfigYaml, setRawConfigYaml] = useState(initialEditorState.rawYaml);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const rawConfigYamlRef = useRef(initialEditorState.rawYaml);
  const isUnsavedNewProfile = hasUnsavedNewProfile(profile, isNew);

  const updateRawConfigYaml = (nextYaml: string) => {
    rawConfigYamlRef.current = nextYaml;
    setRawConfigYaml(nextYaml);
    setYamlError(null);
  };

  const form = useForm({
    defaultValues: formDefaults,
    onSubmit: async ({ value }) => {
      try {
        const payload = mode === "yaml" ? buildYamlPayload(value, rawConfigYamlRef.current) : buildStructuredPayload(value, rawConfigSource);

        setRawConfigSource(parseGomtmConfigYaml(payload.config_yaml));
        updateRawConfigYaml(payload.config_yaml);
        setYamlError(null);

        const nextProfile = await saveMutation.mutateAsync(payload);
        setProfile(nextProfile);
        toast.success("配置已保存");
      } catch (error) {
        const saveErrorMessage = getSaveErrorMessage(error);
        setYamlError(saveErrorMessage);
        toast.error(saveErrorMessage);
      }
    },
  });

  useEffect(() => {
    form.reset(formDefaults);
  }, [formDefaults]);

  useEffect(() => {
    const nextState = createEditorState(profile);
    setFormDefaults(nextState.formValues);
    setRawConfigSource(nextState.configSource);
    rawConfigYamlRef.current = nextState.rawYaml;
    setRawConfigYaml(nextState.rawYaml);
    setYamlError(null);
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (payload: GomtmConfigProfileUpsert) =>
      isUnsavedNewProfile ? createConfigProfile(payload) : saveConfigProfile(profile.name, payload),
    onSuccess: async (nextProfile) => {
      await queryClient.invalidateQueries({ queryKey: CONFIG_PROFILES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["gomtm-config-profile", profile.name] });
      await queryClient.invalidateQueries({ queryKey: ["gomtm-config-profile", nextProfile.name] });
      if (isNew || nextProfile.name !== profile.name) {
        router.replace(`/dash/gomtm/configs/${nextProfile.name}`);
      }
      return nextProfile;
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "保存失败");
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishConfigProfile(profile.name),
    onSuccess: async (nextProfile) => {
      setProfile(nextProfile);
      toast.success("配置已发布");
      await queryClient.invalidateQueries({ queryKey: CONFIG_PROFILES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["gomtm-config-profile", profile.name] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "发布失败");
    },
  });

  const runtimeUrlMutation = useMutation({
    mutationFn: () => fetchRuntimeConfigUrl(profile.name),
    onSuccess: async ({ runtime_url }) => {
      await navigator.clipboard.writeText(runtime_url);
      toast.success("Runtime URL 已复制");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "复制 Runtime URL 失败");
    },
  });

  const metadataBadges = useMemo(
    () => [
      { label: `status: ${profile.status}` },
      { label: `draft v${profile.current_version ?? "-"}` },
      { label: `published v${profile.published_version ?? "-"}` },
    ],
    [profile.current_version, profile.published_version, profile.status],
  );

  const savedState = createEditorState(profile);

  const handleModeChange = (nextMode: EditorMode) => {
    if (nextMode === mode) {
      return;
    }

    if (nextMode === "yaml") {
      try {
        const payload = buildStructuredPayload(form.state.values, rawConfigSource);
        setRawConfigSource(parseGomtmConfigYaml(payload.config_yaml));
        updateRawConfigYaml(payload.config_yaml);
        setYamlError(null);
        setMode("yaml");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "结构化配置同步失败");
      }
      return;
    }

    try {
      const parsedSource = parseGomtmConfigYaml(rawConfigYamlRef.current);
      const parsedDocument = extractGomtmConfigDocument(parsedSource);
      const nextFormValues: ConfigEditorFormValues = {
        ...form.state.values,
        ...getFormValues(profile, parsedDocument),
        name: form.state.values.name,
        description: form.state.values.description,
        target_kind: form.state.values.target_kind,
      };

      setRawConfigSource(parsedSource);
      setFormDefaults(nextFormValues);
      setYamlError(null);
      setMode("form");
    } catch (error) {
      setYamlError(error instanceof Error ? error.message : "YAML 解析失败");
      toast.error(error instanceof Error ? error.message : "YAML 解析失败");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">{profile.name}</CardTitle>
            <CardDescription>编辑 gomtm worker 配置 envelope，并发布供 runtime 消费的 YAML 文档。</CardDescription>
            <div className="flex flex-wrap gap-2">
              {metadataBadges.map((badge) => (
                <Badge key={badge.label} variant="secondary">
                  {badge.label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={mode === "form" ? "default" : "outline"} onClick={() => handleModeChange("form")}>
              表单
            </Button>
            <Button type="button" variant={mode === "yaml" ? "default" : "outline"} onClick={() => handleModeChange("yaml")}>
              YAML
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>配置名称</Label>
                  <Input
                    id={field.name}
                    disabled={!isNew}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="target_kind">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="target-kind">目标类型</Label>
                  <Select value={field.state.value} onValueChange={(value) => field.handleChange(value as GomtmConfigTargetKind)}>
                    <SelectTrigger id="target-kind">
                      <SelectValue placeholder="选择目标类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {gomtmConfigTargetKinds.map((targetKind) => (
                        <SelectItem key={targetKind} value={targetKind}>
                          {targetKind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={field.name}>描述</Label>
                  <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                </div>
              )}
            </form.Field>
          </div>

          {mode === "form" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Server</h3>
                  <p className="text-xs text-muted-foreground">运行时监听、实例标识与本地存储目录。</p>
                </div>

                <form.Field name="server_listen">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>监听地址</Label>
                      <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="server_instance_id">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>实例 ID</Label>
                      <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="server_storage_root_dir">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>存储目录</Label>
                      <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Supabase</h3>
                  <p className="text-xs text-muted-foreground">数据库入口与匿名/服务角色密钥。</p>
                </div>

                <form.Field name="supabase_url">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Supabase URL</Label>
                      <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="supabase_anon_key">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Supabase Anon Key</Label>
                      <Input type="password" id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="supabase_service_role_key">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Supabase Service Role Key</Label>
                      <Input type="password" id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Cloudflare</h3>
                  <p className="text-xs text-muted-foreground">Cloudflare Token、Account、Zone 与 Tunnel 域名。</p>
                </div>

                <form.Field name="cloudflare_api_token">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Cloudflare API Token</Label>
                      <Input type="password" id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="cloudflare_account_id">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Cloudflare Account ID</Label>
                      <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="cloudflare_zone_id">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Cloudflare Zone ID</Label>
                      <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="cloudflare_tunnel_domain">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Tunnel Domain</Label>
                      <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="text-sm font-semibold">MTMAI</h3>
                  <p className="text-xs text-muted-foreground">Hermes Gateway 的开关位。</p>
                </div>

                <form.Field name="hermes_gateway_enable">
                  {(field) => (
                    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                      <input
                        id={field.name}
                        type="checkbox"
                        checked={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.checked)}
                      />
                      <Label htmlFor={field.name}>启用 Hermes Gateway</Label>
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="raw-yaml">原始 YAML</Label>
              <Textarea
                id="raw-yaml"
                className="min-h-[420px] font-mono text-sm"
                value={rawConfigYaml}
                onChange={(event) => updateRawConfigYaml(event.target.value)}
              />
            </div>
          )}

          <form.Subscribe
            selector={(state) => state.values}
            children={(values) => {
              const hasUnsavedChanges = !hasSameFormValues(values, savedState.formValues) || rawConfigYaml !== savedState.rawYaml;

              return (
                <>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" disabled={runtimeUrlMutation.isPending || isUnsavedNewProfile} onClick={() => runtimeUrlMutation.mutate()}>
                      {runtimeUrlMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                      复制 Runtime URL
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={publishMutation.isPending || saveMutation.isPending || hasUnsavedChanges || isUnsavedNewProfile}
                      onClick={() => publishMutation.mutate()}
                    >
                      {publishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                      发布
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      保存
                    </Button>
                  </div>
                  {isUnsavedNewProfile ? <div className="text-sm text-muted-foreground">请先保存当前配置后再发布或复制 Runtime URL</div> : null}
                  {!isUnsavedNewProfile && hasUnsavedChanges ? <div className="text-sm text-muted-foreground">请先保存当前修改后再发布</div> : null}
                </>
              );
            }}
          />
          {yamlError ? <div className="text-sm text-destructive">{yamlError}</div> : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function EmptyConfigEditorView({ name }: { name: string }) {
  const defaultProfile = createDefaultGomtmConfigProfile(name);
  const defaultSource = overlayGomtmConfigDocument({}, createDefaultGomtmConfigDocument());

  return (
    <ConfigEditorView
      isNew
      initialProfile={{
        ...defaultProfile,
        config_yaml: stringifyGomtmConfigSource(defaultSource),
      }}
    />
  );
}
