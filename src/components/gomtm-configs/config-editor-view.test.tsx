// @vitest-environment jsdom

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigEditorView } from "./config-editor-view";

const saveConfigProfile = vi.fn();
const createConfigProfile = vi.fn();
const publishConfigProfile = vi.fn();
const fetchStartupCommand = vi.fn();
const fetchConfigProfile = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const replaceMock = vi.fn();

vi.mock("@/lib/gomtm-configs/api", () => ({
  saveConfigProfile: (...args: unknown[]) => saveConfigProfile(...args),
  createConfigProfile: (...args: unknown[]) => createConfigProfile(...args),
  publishConfigProfile: (...args: unknown[]) => publishConfigProfile(...args),
  fetchStartupCommand: (...args: unknown[]) => fetchStartupCommand(...args),
  fetchConfigProfile: (...args: unknown[]) => fetchConfigProfile(...args),
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

vi.mock("mtxuilib/ui/textarea", () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
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

vi.mock("mtxuilib/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("mtxuilib/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value?: string; onValueChange?: (value: string) => void }) => (
    <div data-select-value={value} data-on-value-change={Boolean(onValueChange)}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("mtxuilib/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value, onClick }: { children: ReactNode; value: string; onClick?: () => void }) => (
    <button type="button" data-value={value} onClick={onClick}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("ConfigEditorView", () => {
  const initialProfile = {
    name: "custom1",
    description: "demo profile",
    target_kind: "generic" as const,
    config_yaml: [
      "server:",
      '  listen: ":7777"',
      '  instance_id: "worker-1"',
      "  storage:",
      '    root_dir: "/var/lib/gomtm"',
      "supabase:",
      '  url: "https://example.supabase.co"',
      '  anon_key: "anon-key"',
      '  service_role_key: "service-role-key"',
      "cloudflare:",
      '  cloudflare_api_token: "cf-token"',
      '  cloudflare_account_id: "cf-account"',
      '  cloudflare_zone_id: "cf-zone"',
      '  tunnel_domain: "worker.example.com"',
      "mtmai:",
      "  hermes_gateway:",
      "    enable: true",
      "",
    ].join("\n"),
    config_json: {
      server: {
        listen: ":7777",
        instance_id: "worker-1",
        storage: { root_dir: "/var/lib/gomtm" },
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
    status: "draft",
    current_version: 2,
    published_version: 1,
    updated_at: "2026-04-27T10:00:00Z",
  };

  function renderView(profileOverrides?: Partial<typeof initialProfile>) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ConfigEditorView initialProfile={{ ...initialProfile, ...profileOverrides }} />
      </QueryClientProvider>,
    );
  }

  afterEach(() => {
    cleanup();
    saveConfigProfile.mockReset();
    createConfigProfile.mockReset();
    publishConfigProfile.mockReset();
    fetchStartupCommand.mockReset();
    fetchConfigProfile.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    replaceMock.mockReset();
    vi.restoreAllMocks();
  });

  it("keeps structured form as the top-level mode and opens YAML through the advanced editor entry", async () => {
    renderView();

    expect(screen.getByLabelText("配置名称")).toBeTruthy();
    expect((screen.getByLabelText("监听地址") as HTMLInputElement).value).toBe(":7777");
    expect((screen.getByLabelText("Supabase URL") as HTMLInputElement).value).toBe("https://example.supabase.co");
    expect((screen.getByLabelText("启用 Hermes Gateway") as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText("原始 YAML")).toBeNull();
    expect(screen.queryByRole("button", { name: "YAML" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "高级 YAML 编辑器" }));

    expect((screen.getByLabelText("原始 YAML") as HTMLTextAreaElement).value).toBe(initialProfile.config_yaml);
    expect(screen.getByRole("button", { name: "返回表单" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "返回表单" }));

    await waitFor(() => {
      expect((screen.getByLabelText("监听地址") as HTMLInputElement).value).toBe(":7777");
    });
  });

  it("syncs structured field edits into YAML mode and save payload", async () => {
    saveConfigProfile.mockResolvedValue({ ...initialProfile, description: "updated profile" });

    renderView();

    fireEvent.change(screen.getByLabelText("描述"), {
      target: { value: "updated profile" },
    });
    fireEvent.change(screen.getByLabelText("监听地址"), {
      target: { value: ":8899" },
    });
    fireEvent.change(screen.getByLabelText("Supabase URL"), {
      target: { value: "https://prod.supabase.co" },
    });
    fireEvent.click(screen.getByLabelText("启用 Hermes Gateway"));

    fireEvent.click(screen.getByRole("button", { name: "高级 YAML 编辑器" }));

    await waitFor(() => {
      expect((screen.getByLabelText("原始 YAML") as HTMLTextAreaElement).value).toContain('listen: ":8899"');
    });
    expect((screen.getByLabelText("原始 YAML") as HTMLTextAreaElement).value).toContain('url: "https://prod.supabase.co"');
    expect((screen.getByLabelText("原始 YAML") as HTMLTextAreaElement).value).toContain("enable: false");

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveConfigProfile).toHaveBeenCalledTimes(1);
    });

    const [, payload] = saveConfigProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.name).toBe("custom1");
    expect(payload.description).toBe("updated profile");
    expect(payload.target_kind).toBe("generic");
    expect(payload.config_yaml).toEqual(expect.stringContaining('listen: ":8899"'));
    expect(payload.config_yaml).toEqual(expect.stringContaining('url: "https://prod.supabase.co"'));
    expect(payload.config_yaml).toEqual(expect.stringContaining("enable: false"));
    expect(payload).not.toHaveProperty("config_json");
  });

  it("parses raw YAML edits back into the structured form and requires save before publish", async () => {
    saveConfigProfile.mockResolvedValue({
      ...initialProfile,
      config_yaml: [
        "server:",
        '  listen: ":9900"',
        '  instance_id: "worker-2"',
        "  storage:",
        '    root_dir: "/srv/gomtm"',
        "supabase:",
        '  url: "https://staging.supabase.co"',
        '  anon_key: "staging-anon"',
        '  service_role_key: "staging-service"',
        "cloudflare:",
        '  cloudflare_api_token: "next-token"',
        '  cloudflare_account_id: "next-account"',
        '  cloudflare_zone_id: "next-zone"',
        '  tunnel_domain: "next.example.com"',
        "mtmai:",
        "  hermes_gateway:",
        "    enable: false",
        "",
      ].join("\n"),
      config_json: {
        server: {
          listen: ":9900",
          instance_id: "worker-2",
          storage: { root_dir: "/srv/gomtm" },
        },
        supabase: {
          url: "https://staging.supabase.co",
          anon_key: "staging-anon",
          service_role_key: "staging-service",
        },
        cloudflare: {
          cloudflare_api_token: "next-token",
          cloudflare_account_id: "next-account",
          cloudflare_zone_id: "next-zone",
          tunnel_domain: "next.example.com",
        },
        mtmai: {
          hermes_gateway: {
            enable: false,
          },
        },
      },
    });
    publishConfigProfile.mockResolvedValue({ ...initialProfile, published_version: 2, status: "published" });

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "高级 YAML 编辑器" }));
    fireEvent.change(screen.getByLabelText("原始 YAML"), {
      target: {
        value: [
          "server:",
          '  listen: ":9900"',
          '  instance_id: "worker-2"',
          "  storage:",
          '    root_dir: "/srv/gomtm"',
          "supabase:",
          '  url: "https://staging.supabase.co"',
          '  anon_key: "staging-anon"',
          '  service_role_key: "staging-service"',
          "cloudflare:",
          '  cloudflare_api_token: "next-token"',
          '  cloudflare_account_id: "next-account"',
          '  cloudflare_zone_id: "next-zone"',
          '  tunnel_domain: "next.example.com"',
          "mtmai:",
          "  hermes_gateway:",
          "    enable: false",
          "",
        ].join("\n"),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "返回表单" }));

    await waitFor(() => {
      expect((screen.getByLabelText("监听地址") as HTMLInputElement).value).toBe(":9900");
    });
    expect((screen.getByLabelText("实例 ID") as HTMLInputElement).value).toBe("worker-2");
    expect((screen.getByLabelText("存储目录") as HTMLInputElement).value).toBe("/srv/gomtm");
    expect((screen.getByLabelText("Supabase URL") as HTMLInputElement).value).toBe("https://staging.supabase.co");
    expect((screen.getByLabelText("启用 Hermes Gateway") as HTMLInputElement).checked).toBe(false);

    expect(screen.getByText("请先保存当前修改后再发布")).toBeTruthy();
    expect((screen.getByRole("button", { name: "发布" }) as HTMLButtonElement).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveConfigProfile).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "发布" }));

    await waitFor(() => {
      expect(publishConfigProfile).toHaveBeenCalledWith("custom1");
    });
  });

  it("disables publish while there are unsaved changes and tells the user to save first", async () => {
    renderView();

    expect((screen.getByRole("button", { name: "发布" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("监听地址"), {
      target: { value: ":9911" },
    });

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "发布" }) as HTMLButtonElement).hasAttribute("disabled")).toBe(true);
    });

    expect(screen.getByText("请先保存当前修改后再发布")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(publishConfigProfile).not.toHaveBeenCalled();
  });

  it("keeps YAML mode active and shows an error when the top-level YAML is not an object", async () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "高级 YAML 编辑器" }));
    fireEvent.change(screen.getByLabelText("原始 YAML"), {
      target: {
        value: ["- not", "- an", "- object", ""].join("\n"),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "返回表单" }));

    await waitFor(() => {
      expect(screen.getByText("YAML 顶层必须是对象")).toBeTruthy();
    });

    expect(screen.getByLabelText("原始 YAML")).toBeTruthy();
    expect(screen.queryByLabelText("监听地址")).toBeNull();
  });

  it("mints and copies the startup command", async () => {
    fetchStartupCommand.mockResolvedValue({
      command: 'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/custom1?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
    });

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });

    renderView({
      status: "published",
      published_version: 2,
    });

    fireEvent.click(screen.getByRole("button", { name: "复制启动命令" }));

    await waitFor(() => {
      expect(fetchStartupCommand).toHaveBeenCalledWith("custom1");
      expect(writeText).toHaveBeenCalledWith(
        'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/custom1?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
      );
    });
  });

  it("disables startup-command copy for draft existing profiles", async () => {
    renderView();

    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    expect(copyButton.disabled).toBe(true);

    fireEvent.click(copyButton);
    expect(fetchStartupCommand).not.toHaveBeenCalled();
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

  it("disables publish and startup-command actions for unsaved new profiles", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ConfigEditorView
          initialProfile={{
            ...initialProfile,
            name: "new-config",
            status: "draft",
            current_version: null,
            published_version: null,
            updated_at: null,
          }}
          isNew
        />
      </QueryClientProvider>,
    );

    expect((screen.getByRole("button", { name: "发布" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    fireEvent.click(screen.getByRole("button", { name: "复制启动命令" }));

    expect(publishConfigProfile).not.toHaveBeenCalled();
    expect(fetchStartupCommand).not.toHaveBeenCalled();
  });

  it("surfaces backend create conflicts without doing a client-side preflight lookup", async () => {
    createConfigProfile.mockRejectedValue(new Error('409: {"error":"conflict"}'));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ConfigEditorView
          initialProfile={{
            ...initialProfile,
            name: "new-config",
            status: "draft",
            current_version: null,
            published_version: null,
            updated_at: null,
          }}
          isNew
        />
      </QueryClientProvider>,
    );

    const nameInput = screen.getByLabelText("配置名称") as HTMLInputElement;
    expect(nameInput.disabled).toBe(false);

    fireEvent.change(nameInput, {
      target: { value: "existing-profile" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createConfigProfile).toHaveBeenCalledTimes(1);
    });

    expect(fetchConfigProfile).not.toHaveBeenCalled();
    expect(saveConfigProfile).not.toHaveBeenCalled();
    expect(screen.getByText("配置名称已存在，请更换名称后再保存")).toBeTruthy();
  });
});
