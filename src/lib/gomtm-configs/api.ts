import {
  GomtmConfigProfileListResponseSchema,
  GomtmConfigProfileSchema,
  GomtmConfigProfileUpsertSchema,
  GomtmRuntimeUrlResponseSchema,
  type GomtmConfigProfileUpsert,
} from "@/components/gomtm-configs/config-schema";

async function readApiError(response: Response) {
  const text = await response.text().catch(() => response.statusText);
  throw new Error(`${response.status}: ${text || response.statusText}`);
}

export async function fetchConfigProfiles() {
  const response = await fetch("/api/cf/gomtm/config-profiles", {
    credentials: "include",
  });

  if (!response.ok) {
    await readApiError(response);
  }

  return GomtmConfigProfileListResponseSchema.parse(await response.json());
}

export async function fetchConfigProfile(name: string) {
  const response = await fetch(`/api/cf/gomtm/config-profiles/${encodeURIComponent(name)}`, {
    credentials: "include",
  });

  if (!response.ok) {
    await readApiError(response);
  }

  return GomtmConfigProfileSchema.parse(await response.json());
}

export async function createConfigProfile(payload: GomtmConfigProfileUpsert) {
  const parsedPayload = GomtmConfigProfileUpsertSchema.parse(payload);
  const response = await fetch("/api/cf/gomtm/config-profiles", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsedPayload),
  });

  if (!response.ok) {
    await readApiError(response);
  }

  return GomtmConfigProfileSchema.parse(await response.json());
}

export async function saveConfigProfile(name: string, payload: GomtmConfigProfileUpsert) {
  const parsedPayload = GomtmConfigProfileUpsertSchema.parse(payload);
  const response = await fetch(`/api/cf/gomtm/config-profiles/${encodeURIComponent(name)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsedPayload),
  });

  if (!response.ok) {
    await readApiError(response);
  }

  return GomtmConfigProfileSchema.parse(await response.json());
}

export async function publishConfigProfile(name: string) {
  const response = await fetch(`/api/cf/gomtm/config-profiles/${encodeURIComponent(name)}/publish`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    await readApiError(response);
  }

  return GomtmConfigProfileSchema.parse(await response.json());
}

export async function fetchRuntimeConfigUrl(name: string) {
  const response = await fetch(`/api/cf/gomtm/config-profiles/${encodeURIComponent(name)}/runtime-url`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    await readApiError(response);
  }

  return GomtmRuntimeUrlResponseSchema.parse(await response.json());
}
