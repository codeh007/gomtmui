import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstanceWindowsManualBootstrapView } from "./instance-windows-manual-bootstrap-view";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("InstanceWindowsManualBootstrapView", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("creates a Windows manual instance and shows the copyable command", async () => {
    const onCreated = vi.fn();
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "72494de4-9863-4100-9254-e899dc1b583f",
        hostname: "d1-1b583f.example.com",
        command: 'irm "https://example.com/api/cf/server/windows/install.ps1?token=abc" | iex',
      }),
    });

    render(<InstanceWindowsManualBootstrapView onCancel={vi.fn()} onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "生成启动命令" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/cf/server/windows/manual-bootstrap", {
        body: "{}",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });

    expect(
      await screen.findByDisplayValue('irm "https://example.com/api/cf/server/windows/install.ps1?token=abc" | iex'),
    ).toBeTruthy();
    expect(onCreated).toHaveBeenCalledWith({ id: "72494de4-9863-4100-9254-e899dc1b583f" });
    expect(screen.getByRole("button", { name: "复制启动命令" })).toBeTruthy();
  });
});
