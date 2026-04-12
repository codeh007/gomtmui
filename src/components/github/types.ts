import z from "zod";

export const githubRpcErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});

export const githubRepositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  html_url: z.string(),
  default_branch: z.string(),
  private: z.boolean().default(false),
});

export const githubListInstallationReposResultSchema = z.union([
  githubRpcErrorSchema,
  z.object({
    repositories: z.array(githubRepositorySchema).default([]),
  }),
]);

export const githubBranchSchema = z.object({
  name: z.string(),
  protected: z.boolean().default(false),
});

export const githubListRepoBranchesResultSchema = z.union([githubRpcErrorSchema, z.array(githubBranchSchema)]);

const isGithubRpcError = (value: unknown): value is GithubRpcError => {
  return !!value && typeof value === "object" && "error" in value && typeof value.error === "string";
};

const formatGithubRpcErrorMessage = (error: GithubRpcError) => {
  return error.error + (error.details ? `: ${JSON.stringify(error.details)}` : "");
};

const getGithubRpcErrorMessage = (data: unknown, queryError: unknown) => {
  if (queryError instanceof Error) {
    return queryError.message;
  }

  if (isGithubRpcError(data)) {
    return formatGithubRpcErrorMessage(data);
  }

  return null;
};

export const normalizeGithubInstallationReposResult = (
  data: GithubListInstallationReposResult | undefined,
  queryError: unknown,
) => {
  return {
    repositories: data && !isGithubRpcError(data) ? data.repositories : [],
    errorMessage: getGithubRpcErrorMessage(data, queryError),
  };
};

export const normalizeGithubRepoBranchesResult = (
  data: GithubListRepoBranchesResult | undefined,
  queryError: unknown,
) => {
  return {
    branches: Array.isArray(data) ? data : [],
    errorMessage: getGithubRpcErrorMessage(data, queryError),
  };
};

export const githubConfigSchema = z.object({
  app_id: z.string().min(1, "App ID is required"),
  slug: z.string().min(1, "App Slug is required"),
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client Secret is required"),
  private_key: z.string().min(1, "Private Key is required"),
  html_url: z.string().optional(),
  installation_id: z.string().optional(),
  repo_full_name: z.string().optional(),
  repo_branch: z.string().optional(),
});

export type GithubConfig = z.infer<typeof githubConfigSchema>;
export type GithubRepository = z.infer<typeof githubRepositorySchema>;
export type GithubBranch = z.infer<typeof githubBranchSchema>;
export type GithubRpcError = z.infer<typeof githubRpcErrorSchema>;
export type GithubListInstallationReposResult = z.infer<typeof githubListInstallationReposResultSchema>;
export type GithubListRepoBranchesResult = z.infer<typeof githubListRepoBranchesResultSchema>;
