// @vitest-environment jsdom

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigEditorView } from "./config-editor-view";

const saveConfigProfile = vi.fn();
const createConfigProfile = vi.fn();
const deleteConfigProfile = vi.fn();
const fetchStartupCommand = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const replaceMock = vi.fn();

vi.mock("@/lib/gomtm-configs/api", () => ({
  saveConfigProfile: (...args: unknown[]) => saveConfigProfile(...args),
  createConfigProfile: (...args: unknown[]) => createConfigProfile(...args),
  deleteConfigProfile: (...args: unknown[]) => deleteConfigProfile(...args),
  fetchStartupCommand: (...args: unknown[]) => fetchStartupCommand(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => replaceMock(...args),
  }),
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("mtxuilib/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("ConfigEditorView", () => {
  const initialProfile = {
    name: "custom1",
    description: "demo profile",
    config_document: {
      server: {
        listen: ":7777",
        instance_id: "worker-1",
        storage: {
          root_dir: "/var/lib/gomtm",
        },
      },
      supabase: {
        url: "https://example.supabase.co",
        anon_key: "anon-key",
        service_role_key: "service-role-key",
      },
      cloudflare: {
        cloudflare_api_token: "cf-token",
        cloudflare_account_id: "cf-account",
        cloudflare_zone_id: "cf-zone",
        tunnel_domain: "worker.example.com",
      },
      mtmai: {
        hermes_gateway: {
          enable: true,
        },
      },
    },
    updated_at: "2026-04-27T10:00:00Z",
  };

  function renderView(profileOverrides?: Partial<typeof initialProfile>, isNew = false) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ConfigEditorView initialProfile={{ ...initialProfile, ...profileOverrides }} isNew={isNew} />
      </QueryClientProvider>,
    );
  }

  afterEach(() => {
    cleanup();
    saveConfigProfile.mockReset();
    createConfigProfile.mockReset();
    deleteConfigProfile.mockReset();
    fetchStartupCommand.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    replaceMock.mockReset();
    vi.restoreAllMocks();
  });

  it("renders only the structured form editor", () => {
    renderView();

    expect(screen.getByLabelText("配置名称")).toBeTruthy();
    expect((screen.getByLabelText("监听地址") as HTMLInputElement).value).toBe(":7777");
    expect((screen.getByLabelText("Supabase URL") as HTMLInputElement).value).toBe("https://example.supabase.co");
    expect((screen.getByLabelText("启用 Hermes Gateway") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: "复制启动命令" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "高级 YAML 编辑器" })).toBeNull();
    expect(screen.queryByRole("button", { name: "返回表单" })).toBeNull();
    expect(screen.queryByRole("button", { name: "导入 YAML" })).toBeNull();
    expect(screen.queryByRole("button", { name: "导出 YAML" })).toBeNull();
    expect(screen.queryByLabelText("原始 YAML")).toBeNull();
  });

  it("saves config_document directly from the form", async () => {
    saveConfigProfile.mockResolvedValue({
      ...initialProfile,
      description: "form mode update",
      config_document: {
        ...initialProfile.config_document,
        server: {
          ...initialProfile.config_document.server,
          listen: ":9000",
          instance_id: "worker-form",
        },
        supabase: {
          ...initialProfile.config_document.supabase,
          url: "https://prod.supabase.co",
        },
        mtmai: {
          hermes_gateway: {
            enable: false,
          },
        },
      },
    });

    renderView();

    fireEvent.change(screen.getByLabelText("描述"), {
      target: { value: "form mode update" },
    });
    fireEvent.change(screen.getByLabelText("监听地址"), {
      target: { value: ":9000" },
    });
    fireEvent.change(screen.getByLabelText("实例 ID"), {
      target: { value: "worker-form" },
    });
    fireEvent.change(screen.getByLabelText("Supabase URL"), {
      target: { value: "https://prod.supabase.co" },
    });
    fireEvent.click(screen.getByLabelText("启用 Hermes Gateway"));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveConfigProfile).toHaveBeenCalledTimes(1);
    });

    const [, payload] = saveConfigProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).toEqual({
      name: "custom1",
      description: "form mode update",
      config_document: {
        server: {
          listen: ":9000",
          instance_id: "worker-form",
          storage: {
            root_dir: "/var/lib/gomtm",
          },
        },
        supabase: {
          url: "https://prod.supabase.co",
          anon_key: "anon-key",
          service_role_key: "service-role-key",
        },
        cloudflare: {
          cloudflare_api_token: "cf-token",
          cloudflare_account_id: "cf-account",
          cloudflare_zone_id: "cf-zone",
          tunnel_domain: "worker.example.com",
        },
        mtmai: {
          hermes_gateway: {
            enable: false,
          },
        },
      },
    });
    expect(payload).not.toHaveProperty("target_kind");
  });

  it("creates a new profile from the pure form and redirects to the saved route", async () => {
    createConfigProfile.mockResolvedValue({
      ...initialProfile,
      name: "saved-config",
      description: "new profile",
      updated_at: "2026-04-30T09:00:00Z",
      config_document: {
        ...initialProfile.config_document,
        server: {
          ...initialProfile.config_document.server,
          listen: ":4567",
        },
        mtmai: {
          hermes_gateway: {
            enable: false,
          },
        },
      },
    });

    renderView(
      {
        name: "new-config",
        description: "",
        updated_at: null,
      },
      true,
    );

    fireEvent.change(screen.getByLabelText("配置名称"), {
      target: { value: "saved-config" },
    });
    fireEvent.change(screen.getByLabelText("描述"), {
      target: { value: "new profile" },
    });
    fireEvent.change(screen.getByLabelText("监听地址"), {
      target: { value: ":4567" },
    });
    fireEvent.click(screen.getByLabelText("启用 Hermes Gateway"));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createConfigProfile).toHaveBeenCalledTimes(1);
    });

    expect(createConfigProfile).toHaveBeenCalledWith({
      name: "saved-config",
      description: "new profile",
      config_document: {
        server: {
          listen: ":4567",
          instance_id: "worker-1",
          storage: {
            root_dir: "/var/lib/gomtm",
          },
        },
        supabase: {
          url: "https://example.supabase.co",
          anon_key: "anon-key",
          service_role_key: "service-role-key",
        },
        cloudflare: {
          cloudflare_api_token: "cf-token",
          cloudflare_account_id: "cf-account",
          cloudflare_zone_id: "cf-zone",
          tunnel_domain: "worker.example.com",
        },
        mtmai: {
          hermes_gateway: {
            enable: false,
          },
        },
      },
    });
    expect(replaceMock).toHaveBeenCalledWith("/dash/gomtm/configs/saved-config");
  });

  it("mints and copies the startup command for any saved existing profile", async () => {
    fetchStartupCommand.mockResolvedValue({
      command: 'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/custom1?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
    });

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });

    renderView();

    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    expect(copyButton.disabled).toBe(false);

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(fetchStartupCommand).toHaveBeenCalledWith("custom1");
      expect(writeText).toHaveBeenCalledWith(
        'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/custom1?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
      );
    });
  });

  it("keeps name read-only for existing profiles and saves back to the original profile path", async () => {
    saveConfigProfile.mockResolvedValue({ ...initialProfile, description: "locked path update" });

    renderView();

    const nameInput = screen.getByLabelText("配置名称") as HTMLInputElement;
    expect(nameInput.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("描述"), {
      target: { value: "locked path update" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveConfigProfile).toHaveBeenCalledTimes(1);
    });

    const [saveName] = saveConfigProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(saveName).toBe("custom1");
  });

  it("deletes a saved profile from the detail editor and redirects back to the list", async () => {
    deleteConfigProfile.mockResolvedValue({ success: true });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("确定要删除配置 custom1 吗？");
      expect(deleteConfigProfile.mock.calls[0]?.[0]).toBe("custom1");
      expect(toastSuccess).toHaveBeenCalledWith("配置已删除");
      expect(replaceMock).toHaveBeenCalledWith("/dash/gomtm/configs");
    });
  });

  it("does not delete from the detail editor when confirmation is cancelled", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    expect(confirmSpy).toHaveBeenCalledWith("确定要删除配置 custom1 吗？");
    expect(deleteConfigProfile).not.toHaveBeenCalled();
  });

  it("surfaces the delete error toast in the detail editor", async () => {
    deleteConfigProfile.mockRejectedValue(new Error("后端删除失败"));

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("后端删除失败");
    });
  });

  it("disables conflicting editor actions while delete is pending", async () => {
    let resolveDelete: ((value: { success: boolean }) => void) | undefined;
    deleteConfigProfile.mockReturnValue(
      new Promise<{ success: boolean }>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    const saveButton = screen.getByRole("button", { name: "保存" }) as HTMLButtonElement;
    const deleteButton = screen.getByRole("button", { name: "删除" }) as HTMLButtonElement;

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(copyButton.disabled).toBe(true);
      expect(saveButton.disabled).toBe(true);
      expect(deleteButton.disabled).toBe(true);
    });

    fireEvent.click(copyButton);
    fireEvent.click(saveButton);

    expect(fetchStartupCommand).not.toHaveBeenCalled();
    expect(saveConfigProfile).not.toHaveBeenCalled();

    resolveDelete?.({ success: true });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("配置已删除");
    });
  });

  it("disables header delete while startup-command copy is pending", async () => {
    let resolveCopy: ((value: { command: string }) => void) | undefined;
    fetchStartupCommand.mockReturnValue(
      new Promise<{ command: string }>((resolve) => {
        resolveCopy = resolve;
      }),
    );

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    const deleteButton = screen.getByRole("button", { name: "删除" }) as HTMLButtonElement;

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(copyButton.disabled).toBe(true);
      expect(deleteButton.disabled).toBe(true);
    });

    fireEvent.click(deleteButton);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deleteConfigProfile).not.toHaveBeenCalled();

    resolveCopy?.({ command: "gomtm server --config=demo" });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("启动命令已复制");
    });
  });

  it("disables startup-command copy for unsaved new profiles", () => {
    renderView(
      {
        name: "new-config",
        updated_at: null,
      },
      true,
    );

    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    expect(copyButton.disabled).toBe(true);

    fireEvent.click(copyButton);

    expect(fetchStartupCommand).not.toHaveBeenCalled();
    expect(screen.getByText("请先保存当前配置后再复制启动命令")).toBeTruthy();
  });

  it("surfaces backend create conflicts without doing a client-side preflight lookup", async () => {
    createConfigProfile.mockRejectedValue(new Error('409: {"error":"conflict"}'));

    renderView(
      {
        name: "new-config",
        updated_at: null,
      },
      true,
    );

    fireEvent.change(screen.getByLabelText("配置名称"), {
      target: { value: "new-config" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createConfigProfile).toHaveBeenCalledTimes(1);
    });

    expect(toastError).toHaveBeenCalledWith("配置名称已存在，请更换名称后再保存");
  });
});
