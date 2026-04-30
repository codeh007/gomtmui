"use client";

import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createDefaultGomtmConfigProfile,
  GomtmConfigDocumentSchema,
  GomtmConfigProfileSchema,
  type GomtmConfigDocument,
  type GomtmConfigProfile,
  type GomtmConfigProfileUpsert,
} from "./config-schema";
import { createConfigProfile, deleteConfigProfile, fetchStartupCommand, saveConfigProfile } from "@/lib/gomtm-configs/api";

const CONFIG_PROFILES_QUERY_KEY = ["gomtm-config-profiles"] as const;

interface ConfigEditorViewProps {
  initialProfile: GomtmConfigProfile;
  isNew?: boolean;
}

type ConfigEditorFormValues = {
  name: string;
  description: string;
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

function getFormValues(profile: GomtmConfigProfile, document: GomtmConfigDocument): ConfigEditorFormValues {
  return {
    name: profile.name,
    description: profile.description,
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

function buildStructuredPayload(
  values: ConfigEditorFormValues,
): GomtmConfigProfileUpsert {
  const nextDocument = getDocumentFromFormValues(values);

  return {
    name: values.name,
    description: values.description,
    config_document: nextDocument,
  };
}

function createEditorState(profile: GomtmConfigProfile) {
  return getFormValues(profile, profile.config_document);
}

function hasUnsavedNewProfile(profile: Pick<GomtmConfigProfile, "updated_at">, isNew: boolean) {
  return isNew && profile.updated_at == null;
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
  const [profile, setProfile] = useState(() => GomtmConfigProfileSchema.parse(initialProfile));
  const [formDefaults, setFormDefaults] = useState(() => createEditorState(profile));
  const isUnsavedNewProfile = hasUnsavedNewProfile(profile, isNew);

  const form = useForm({
    defaultValues: formDefaults,
    onSubmit: async ({ value }) => {
      try {
        const payload = buildStructuredPayload(value);
        const nextProfile = await saveMutation.mutateAsync(payload);
        setProfile(nextProfile);
        toast.success("配置已保存");
      } catch (error) {
        const saveErrorMessage = getSaveErrorMessage(error);
        toast.error(saveErrorMessage);
      }
    },
  });

  useEffect(() => {
    form.reset(formDefaults);
  }, [formDefaults]);

  useEffect(() => {
    const nextState = createEditorState(profile);
    setFormDefaults(nextState);
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
  });

  const startupCommandMutation = useMutation({
    mutationFn: () => fetchStartupCommand(profile.name),
    onSuccess: async ({ command }) => {
      await navigator.clipboard.writeText(command);
      toast.success("启动命令已复制");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "复制启动命令失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConfigProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CONFIG_PROFILES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["gomtm-config-profile", profile.name] });
      toast.success("配置已删除");
      router.replace("/dash/gomtm/configs");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "删除配置失败");
    },
  });

  const handleDelete = () => {
    if (!window.confirm(`确定要删除配置 ${profile.name} 吗？`)) {
      return;
    }

    deleteMutation.mutate(profile.name);
  };

  const deletePending = deleteMutation.isPending;
  const copyPending = startupCommandMutation.isPending;
  const headerActionsDisabled = deletePending || saveMutation.isPending || copyPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">{profile.name}</CardTitle>
            <CardDescription>编辑 gomtm worker 当前配置；保存后，后续新启动实例会读取最新远程配置。</CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {!isUnsavedNewProfile ? (
              <Button type="button" variant="outline" disabled={headerActionsDisabled} onClick={handleDelete}>
                {deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                删除
              </Button>
            ) : null}
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

            <form.Field name="description">
              {(field) => (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={field.name}>描述</Label>
                  <Input id={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
                </div>
              )}
            </form.Field>
          </div>

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

          <form.Subscribe
            selector={(state) => state.values}
            children={(values) => {
              void values;

              return (
                <>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={copyPending || deletePending || isUnsavedNewProfile}
                      onClick={() => startupCommandMutation.mutate()}
                    >
                      {copyPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                      复制启动命令
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending || deletePending}>
                      {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      保存
                    </Button>
                  </div>
                  {isUnsavedNewProfile ? <div className="text-sm text-muted-foreground">请先保存当前配置后再复制启动命令</div> : null}
                </>
              );
            }}
          />
        </form>
      </CardContent>
    </Card>
  );
}

export function EmptyConfigEditorView({ name }: { name: string }) {
  const defaultProfile = createDefaultGomtmConfigProfile(name);

  return <ConfigEditorView isNew initialProfile={defaultProfile} />;
}
