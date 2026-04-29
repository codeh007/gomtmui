import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockServerClient = {
  auth: { getUser: mockGetUser },
  rpc: mockRpc,
};
const redirectMock = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockServerClient,
}));

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

import { requireAdminSettingsAccess } from "./require-admin";

describe("requireAdminSettingsAccess", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockRpc.mockReset();
    redirectMock.mockClear();
  });

  it("redirects unauthenticated callers to login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(requireAdminSettingsAccess()).rejects.toThrow("redirect:/auth/login");
  });

  it("redirects authenticated non-admin callers to /dash", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(requireAdminSettingsAccess()).rejects.toThrow("redirect:/dash");
    expect(mockRpc).toHaveBeenCalledWith("has_permission", {
      p_resource: "sys_config",
      p_action: "write",
    });
  });

  it("returns the server supabase client for admins", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    mockRpc.mockResolvedValue({ data: true, error: null });

    const client = await requireAdminSettingsAccess();
    expect(client).toBe(mockServerClient);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
