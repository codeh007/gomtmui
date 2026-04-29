// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useCurrentUserRoleMock = vi.fn();

vi.mock("@/hooks/use-current-user-role", () => ({
  useCurrentUserRole: () => useCurrentUserRoleMock(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dash/settings/profile",
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock("mtxuilib/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarRail: () => <div />,
  SidebarSeparator: () => <div />,
}));

import { SidebarSettings } from "./sidebar";

describe("SidebarSettings", () => {
  afterEach(() => {
    cleanup();
    useCurrentUserRoleMock.mockReset();
  });

  it("hides admin-only settings entries from non-admins", () => {
    useCurrentUserRoleMock.mockReturnValue({ isAdmin: false, isLoading: false });
    render(<SidebarSettings />);

    expect(screen.queryByText("系统配置")).toBeNull();
    expect(screen.queryByText("集成")).toBeNull();
    expect(screen.getByText("个人资料")).toBeTruthy();
  });

  it("shows admin-only settings entries to admins", () => {
    useCurrentUserRoleMock.mockReturnValue({ isAdmin: true, isLoading: false });
    render(<SidebarSettings />);

    expect(screen.getByText("系统配置")).toBeTruthy();
    expect(screen.getByText("集成")).toBeTruthy();
  });
});
