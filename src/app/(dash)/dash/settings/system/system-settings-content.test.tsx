// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockedCards = vi.hoisted(() => ({
  SupabaseConfigCard: vi.fn(() => <div data-testid="supabase-config-card">SupabaseConfigCard</div>),
  CloudflareConfigCard: vi.fn(() => <div data-testid="cloudflare-config-card">CloudflareConfigCard</div>),
  SmsProviderConfigCard: vi.fn(() => <div data-testid="sms-provider-config-card">SmsProviderConfigCard</div>),
  DomainConfigCard: vi.fn(() => <div data-testid="domain-config-card">DomainConfigCard</div>),
  GenericConfigList: vi.fn(() => <div data-testid="generic-config-list">GenericConfigList</div>),
}));

vi.mock("@/components/common/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dash-layout", () => ({
  DashContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./supabase-config-card", () => ({
  SupabaseConfigCard: mockedCards.SupabaseConfigCard,
}));

vi.mock("./cloudflare-config-card", () => ({
  CloudflareConfigCard: mockedCards.CloudflareConfigCard,
}));

vi.mock("./sms-provider-config-card", () => ({
  SmsProviderConfigCard: mockedCards.SmsProviderConfigCard,
}));

vi.mock("./domain-config-card", () => ({
  DomainConfigCard: mockedCards.DomainConfigCard,
}));

vi.mock("./generic-config-list", () => ({
  GenericConfigList: mockedCards.GenericConfigList,
}));

import { SystemSettingsContent } from "./system-settings-content";

describe("SystemSettingsContent", () => {
  afterEach(() => {
    cleanup();
    mockedCards.SupabaseConfigCard.mockClear();
    mockedCards.CloudflareConfigCard.mockClear();
    mockedCards.SmsProviderConfigCard.mockClear();
    mockedCards.DomainConfigCard.mockClear();
    mockedCards.GenericConfigList.mockClear();
  });

  it("renders only private sys_config cards", () => {
    render(<SystemSettingsContent />);

    expect(screen.getByText("SupabaseConfigCard")).toBeTruthy();
    expect(screen.getByText("CloudflareConfigCard")).toBeTruthy();
    expect(screen.getByText("SmsProviderConfigCard")).toBeTruthy();
    expect(mockedCards.SupabaseConfigCard).toHaveBeenCalled();
    expect(mockedCards.CloudflareConfigCard).toHaveBeenCalled();
    expect(mockedCards.SmsProviderConfigCard).toHaveBeenCalled();
    expect(mockedCards.DomainConfigCard).not.toHaveBeenCalled();
    expect(mockedCards.GenericConfigList).not.toHaveBeenCalled();
    expect(screen.queryByTestId("domain-config-card")).toBeNull();
    expect(screen.queryByTestId("generic-config-list")).toBeNull();
    expect(screen.queryByText("DomainConfigCard")).toBeNull();
    expect(screen.queryByText("GenericConfigList")).toBeNull();
  });
});
