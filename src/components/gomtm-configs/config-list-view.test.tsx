// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigListView } from "./config-list-view";

const fetchConfigProfiles = vi.fn();
const fetchStartupCommand = vi.fn();
const deleteConfigProfile = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const pushMock = vi.fn();

vi.mock("@/lib/gomtm-configs/api", () => ({
  fetchConfigProfiles: (...args: unknown[]) => fetchConfigProfiles(...args),
  fetchStartupCommand: (...args: unknown[]) => fetchStartupCommand(...args),
  deleteConfigProfile: (...args: unknown[]) => deleteConfigProfile(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => pushMock(...args),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children, className }: { children: ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableCell: ({ children, className }: { children: ReactNode; className?: string }) => <td className={className}>{children}</td>,
}));

describe("ConfigListView", () => {
  const defaultItem = {
    name: "custom1",
    description: "Demo profile",
    updated_at: "2026-04-29T03:00:00Z",
  };

  function renderView() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ConfigListView />
      </QueryClientProvider>,
    );
  }

  afterEach(() => {
    cleanup();
    fetchConfigProfiles.mockReset();
    fetchStartupCommand.mockReset();
    deleteConfigProfile.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    pushMock.mockReset();
    vi.restoreAllMocks();
  });

  it("shows only current-config columns and copies the startup command", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [defaultItem],
    });
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

    await screen.findByText("custom1");

    expect(screen.queryByRole("columnheader", { name: "状态" })).toBeNull();
    expect(screen.queryByRole("button", { name: "发布" })).toBeNull();
    expect(screen.getByText("Demo profile")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "复制启动命令" }));

    await waitFor(() => {
      expect(fetchStartupCommand.mock.calls[0]?.[0]).toBe("custom1");
      expect(writeText).toHaveBeenCalledWith(
        'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/custom1?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
      );
    });
  });

  it("keeps startup-command copy available for any saved profile", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [
        {
          name: "saved-config",
          description: "Saved profile",
          updated_at: "2026-04-29T03:00:00Z",
        },
      ],
    });
    fetchStartupCommand.mockResolvedValue({
      command: 'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/saved-config?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
    });

    renderView();

    await screen.findByText("saved-config");

    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    expect(copyButton.disabled).toBe(false);

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(fetchStartupCommand.mock.calls[0]?.[0]).toBe("saved-config");
    });
  });

  it("navigates from the title, removes row edit, and deletes after confirmation", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [defaultItem],
    });
    deleteConfigProfile.mockResolvedValue({ success: true });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    const titleButton = await screen.findByRole("button", { name: "custom1" });
    expect(screen.queryByRole("button", { name: "编辑" })).toBeNull();

    fireEvent.click(titleButton);
    expect(pushMock).toHaveBeenCalledWith("/dash/gomtm/configs/custom1");

    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("确定要删除配置 custom1 吗？");
      expect(deleteConfigProfile.mock.calls[0]?.[0]).toBe("custom1");
      expect(toastSuccess).toHaveBeenCalledWith("配置已删除");
    });
  });

  it("does not delete when confirmation is cancelled", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [defaultItem],
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "删除" }));

    expect(confirmSpy).toHaveBeenCalledWith("确定要删除配置 custom1 吗？");
    expect(deleteConfigProfile).not.toHaveBeenCalled();
  });

  it("surfaces the delete error toast message", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [defaultItem],
    });
    deleteConfigProfile.mockRejectedValue(new Error("后端删除失败"));

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("后端删除失败");
    });
  });

  it("disables same-row actions while delete is pending", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [defaultItem],
    });

    let resolveDelete: ((value: { success: boolean }) => void) | undefined;
    deleteConfigProfile.mockReturnValue(
      new Promise<{ success: boolean }>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    const titleButton = (await screen.findByRole("button", { name: "custom1" })) as HTMLButtonElement;
    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    const deleteButton = screen.getByRole("button", { name: "删除" }) as HTMLButtonElement;

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(titleButton.disabled).toBe(true);
      expect(copyButton.disabled).toBe(true);
      expect(deleteButton.disabled).toBe(true);
    });

    fireEvent.click(titleButton);
    fireEvent.click(copyButton);

    expect(pushMock).not.toHaveBeenCalled();
    expect(fetchStartupCommand).not.toHaveBeenCalled();

    resolveDelete?.({ success: true });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("配置已删除");
    });
  });

  it("disables delete while startup-command copy is pending", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [defaultItem],
    });

    let resolveCopy: ((value: { command: string }) => void) | undefined;
    fetchStartupCommand.mockReturnValue(
      new Promise<{ command: string }>((resolve) => {
        resolveCopy = resolve;
      }),
    );

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    const titleButton = (await screen.findByRole("button", { name: "custom1" })) as HTMLButtonElement;
    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    const deleteButton = screen.getByRole("button", { name: "删除" }) as HTMLButtonElement;

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(titleButton.disabled).toBe(true);
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

  it("refreshes the list after a successful delete", async () => {
    fetchConfigProfiles.mockResolvedValueOnce({
      items: [defaultItem],
    });
    fetchConfigProfiles.mockResolvedValueOnce({
      items: [],
    });
    deleteConfigProfile.mockResolvedValue({ success: true });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(screen.queryByText("custom1")).toBeNull();
      expect(screen.getByText("暂无配置 profiles。")).toBeTruthy();
    });
  });
});
