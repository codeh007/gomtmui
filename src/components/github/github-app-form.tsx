"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, GithubIcon, Key, Loader2, Lock, RefreshCw, Save, Trash2, Zap } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "mtxuilib/ui/alert-dialog";
import { Button } from "mtxuilib/ui/button";
import { Field, FieldError, FieldLabel } from "mtxuilib/ui/field";
import { Input } from "mtxuilib/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Separator } from "mtxuilib/ui/separator";
import { Textarea } from "mtxuilib/ui/textarea";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  type GithubConfig,
  githubConfigSchema,
  githubListInstallationReposResultSchema,
  githubListRepoBranchesResultSchema,
  normalizeGithubInstallationReposResult,
  normalizeGithubRepoBranchesResult,
} from "./types";

export interface GithubAppFormProps {
  defaultValues: GithubConfig;
  isSynced: boolean;
  isSyncing: boolean;
  onSync: (values: GithubConfig) => Promise<void>;
  onRunSetup: () => void;
  isSetupLoading: boolean;
  onDelete: () => Promise<void>;
  onInstallToRepo?: () => void;
}

export const GithubAppForm = ({
  defaultValues,
  isSynced,
  isSyncing,
  onSync,
  onRunSetup,
  isSetupLoading,
  onDelete,
  onInstallToRepo,
}: GithubAppFormProps) => {
  const queryClient = useQueryClient();
  const isConfigured = !!defaultValues.app_id;
  const installationId = defaultValues.installation_id ?? "";

  const saveMutation = useRpcMutation("sys_config_set", {
    onSuccess: (result) => {
      if (result.error) {
        toast.error("Failed to save GitHub configuration", {
          description: result.error.message,
        });
        return;
      }
      toast.success("GitHub Configuration saved successfully");
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("sys_config_get") });
    },
    onError: (error) => {
      toast.error("Failed to save GitHub configuration", {
        description: error.message,
      });
    },
  });

  const form = useForm({
    defaultValues,
    validators: {
      onChange: githubConfigSchema,
      onSubmit: githubConfigSchema,
    },
    onSubmit: async ({ value }) => {
      saveMutation.mutate({
        p_key: "github_app",
        p_value: value,
        p_description: "GitHub Application Configuration for System",
      });
    },
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues]);

  const selectedRepoFullName = form.state.values.repo_full_name;

  const repositoriesQuery = useRpcQuery("github_list_installation_repos", undefined, {
    schema: githubListInstallationReposResultSchema,
    enabled: !!installationId,
    queryKeySuffix: installationId ? [installationId] : undefined,
  });

  const branchesQuery = useRpcQuery(
    "github_list_repo_branches",
    selectedRepoFullName ? { p_repo_full_name: selectedRepoFullName } : undefined,
    {
      schema: githubListRepoBranchesResultSchema,
      enabled: !!selectedRepoFullName,
    },
  );

  const { repositories, errorMessage: repositoriesErrorMessage } = useMemo(
    () => normalizeGithubInstallationReposResult(repositoriesQuery.data, repositoriesQuery.error),
    [repositoriesQuery.data, repositoriesQuery.error],
  );

  const { branches, errorMessage: branchesErrorMessage } = useMemo(
    () => normalizeGithubRepoBranchesResult(branchesQuery.data, branchesQuery.error),
    [branchesQuery.data, branchesQuery.error],
  );

  useEffect(() => {
    if (!selectedRepoFullName || branches.length === 0 || form.state.values.repo_branch) {
      return;
    }

    const selectedRepo = repositories.find((repo) => repo.full_name === selectedRepoFullName);
    const defaultBranch = selectedRepo?.default_branch || branches[0]?.name;
    if (defaultBranch) {
      form.setFieldValue("repo_branch", defaultBranch);
    }
  }, [selectedRepoFullName, repositories, branches, form.state.values.repo_branch, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="p-8 space-y-10">
        <div className="p-6 rounded-2xl bg-linear-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-100/50 dark:border-indigo-900/30 flex flex-col md:flex-row items-center gap-6">
          <div className="p-4 bg-white dark:bg-slate-900 shadow-sm rounded-xl text-primary">
            <Zap className="h-8 w-8" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">One-Click Setup</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Recommended for most users. This will automatically create and configure a new GitHub App for you with all
              required permissions.
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={onRunSetup}
            disabled={isSetupLoading}
            className="w-full md:w-auto px-10 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all font-semibold"
          >
            {isSetupLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4 fill-current" />
            )}
            {isConfigured ? "Run Setup Wizard Again" : "Start Setup Wizard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5 space-y-6">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Lock className="h-3 w-3" /> Basic Information
              </h4>
              <p className="text-xs text-slate-500">Standard identifiers for your GitHub App.</p>
            </div>

            <div className="space-y-6">
              <form.Field name="app_id">
                {(field) => (
                  <Field>
                    <FieldLabel className="text-slate-600 dark:text-slate-400">App ID</FieldLabel>
                    <Input
                      placeholder="e.g. 123456"
                      className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="slug">
                {(field) => (
                  <Field>
                    <FieldLabel className="text-slate-600 dark:text-slate-400">App Slug</FieldLabel>
                    <Input
                      placeholder="e.g. gomtm-github-app"
                      className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="html_url">
                {(field) => (
                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel className="text-slate-600 dark:text-slate-400">App Homepage URL</FieldLabel>
                      {field.state.value && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-blue-500" asChild>
                          <a href={field.state.value} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Visit
                          </a>
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="https://github.com/settings/apps/..."
                      className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-mono text-xs"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            </div>
          </div>

          <div className="hidden md:block md:col-span-1 py-4">
            <Separator orientation="vertical" className="mx-auto" />
          </div>

          <div className="md:col-span-6 space-y-6">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Key className="h-3 w-3" /> Authentication & Security
              </h4>
              <p className="text-xs text-slate-500">Credentials and secrets required for API access.</p>
            </div>

            <div className="space-y-6">
              <form.Field name="client_id">
                {(field) => (
                  <Field>
                    <FieldLabel className="text-slate-600 dark:text-slate-400">Client ID</FieldLabel>
                    <Input
                      placeholder="Iv1..."
                      className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-mono"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="client_secret">
                {(field) => (
                  <Field>
                    <FieldLabel className="text-slate-600 dark:text-slate-400">Client Secret</FieldLabel>
                    <Input
                      type="password"
                      placeholder="••••••••••••••••"
                      className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            </div>
          </div>
        </div>

        <Separator />

        <form.Field name="private_key">
          {(field) => (
            <Field className="space-y-4">
              <div className="space-y-1">
                <FieldLabel className="text-lg font-bold">Private Key (PEM)</FieldLabel>
                <p className="text-sm text-slate-500">
                  The RSA private key used to sign requests and generate installation tokens.
                </p>
              </div>
              <div className="relative group">
                <Textarea
                  className="font-mono text-[11px] h-48 bg-slate-900 text-slate-300 dark:bg-slate-950 border-slate-800 focus:ring-slate-700 leading-normal p-4 resize-none transition-all"
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
              </div>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        {isConfigured && (
          <div className="space-y-4 pt-6">
            <div className="space-y-1">
              <h4 className="text-lg font-bold flex items-center gap-2">
                <GithubIcon className="h-5 w-5" /> Repository Installation
              </h4>
              <p className="text-sm text-slate-500">
                Install this GitHub App to a specific repository to enable automated Actions bootstrapping.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 gap-4">
              <div className="flex items-center gap-3">
                {defaultValues.installation_id ? (
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Installed Successfully
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Installation ID:{" "}
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                        {defaultValues.installation_id}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Not Installed</p>
                    <p className="text-xs text-slate-500 mt-0.5">App has not been installed to any repository yet.</p>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant={defaultValues.installation_id ? "outline" : "default"}
                onClick={onInstallToRepo}
              >
                {defaultValues.installation_id ? "Re-Install / Manage" : "Install to Target Repository"}
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
            {!defaultValues.installation_id && (
              <p className="text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200 dark:border-amber-900/30 flex items-center gap-2">
                <span>⚠️</span>
                <span>
                  Without completing this step, the system will not be able to trigger GitHub Actions for automated
                  bootstrapping.
                </span>
              </p>
            )}

            {defaultValues.installation_id && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <form.Field name="repo_full_name">
                  {(field) => (
                    <Field>
                      <FieldLabel className="text-slate-600 dark:text-slate-400 font-semibold mb-2 block">
                        Target Repository
                      </FieldLabel>
                      {repositoriesQuery.isFetching ? (
                        <div className="flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-800 rounded-md bg-slate-50/50 dark:bg-slate-900/50">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                          <span className="text-sm text-slate-500">Loading repositories...</span>
                        </div>
                      ) : repositories.length > 0 ? (
                        <>
                          <Select value={field.state.value || ""} onValueChange={(value) => field.handleChange(value)}>
                            <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                              <SelectValue placeholder="Select a repository" />
                            </SelectTrigger>
                            <SelectContent>
                              {repositories.map((repo) => (
                                <SelectItem key={repo.id} value={repo.full_name}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm">{repo.full_name}</span>
                                    {repo.private && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                        Private
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500 mt-2">
                            Select the repository used for GitHub Actions workflow dispatch.
                          </p>
                        </>
                      ) : (
                        <>
                          {repositoriesErrorMessage ? (
                            <div className="mb-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-md">
                              <p className="text-xs text-amber-700 dark:text-amber-400">{repositoriesErrorMessage}</p>
                            </div>
                          ) : null}
                          <Input
                            placeholder="e.g. username/my-repo"
                            className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-mono"
                            value={field.state.value || ""}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-md">
                            <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                              <span>ℹ️</span>
                              <span>
                                <strong>To see repository dropdown:</strong> Please sign in with GitHub OAuth (not
                                email/password). The system needs your GitHub token to list available repositories.
                              </span>
                            </p>
                          </div>
                        </>
                      )}
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>

                {form.state.values.repo_full_name && (
                  <form.Field name="repo_branch">
                    {(field) => (
                      <Field>
                        <FieldLabel className="text-slate-600 dark:text-slate-400 font-semibold mb-2 block">
                          Target Branch
                        </FieldLabel>
                        {branchesQuery.isFetching ? (
                          <div className="flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-800 rounded-md bg-slate-50/50 dark:bg-slate-900/50">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            <span className="text-sm text-slate-500">Loading branches...</span>
                          </div>
                        ) : branches.length > 0 ? (
                          <>
                            <Select
                              value={field.state.value || ""}
                              onValueChange={(value) => field.handleChange(value)}
                            >
                              <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                                <SelectValue placeholder="Select a branch" />
                              </SelectTrigger>
                              <SelectContent>
                                {branches.map((branch) => (
                                  <SelectItem key={branch.name} value={branch.name}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm">{branch.name}</span>
                                      {branch.protected && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                          Protected
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 mt-2">
                              Select the branch where the workflow will be executed.
                            </p>
                          </>
                        ) : (
                          <>
                            {branchesErrorMessage ? (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{branchesErrorMessage}</p>
                            ) : null}
                            <Input
                              placeholder="e.g. main"
                              className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-mono"
                              value={field.state.value || ""}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Enter the branch name manually if the dropdown is not available.
                            </p>
                          </>
                        )}
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isConfigured && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the GitHub App credentials from the system. This action cannot be
                      undone and will break existing integrations.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-red-500 hover:bg-red-600">
                      Delete Configuration
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex items-center gap-2 ml-2">
                {!isSynced ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onSync(form.state.values)}
                    disabled={isSyncing}
                    className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
                  >
                    {isSyncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync to Supabase Auth
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Synced with Supabase Auth
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSync(form.state.values)}
                      disabled={isSyncing}
                      className="ml-1 h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-full"
                      title="Resync"
                    >
                      {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto ml-auto">
          <form.Subscribe
            selector={(state) => state.errors}
            children={(formErrors) => {
              if (!formErrors || formErrors.length === 0) return null;
              const errorMessages = formErrors.map((err) => ({
                message: typeof err === "string" ? err : JSON.stringify(err),
              }));
              return (
                <div className="mr-auto">
                  <FieldError errors={errorMessages} />
                </div>
              );
            }}
          />
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}
            children={([canSubmit, isSubmitting, isDirty]) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting || (!isDirty && isConfigured)}
                className="w-full sm:w-auto px-10 shadow-md transition-all active:scale-95"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isConfigured ? "Update Configuration" : "Save Configuration"}
              </Button>
            )}
          />
        </div>
      </div>
    </form>
  );
};
