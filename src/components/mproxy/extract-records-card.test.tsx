// @vitest-environment jsdom

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExtractRecordsCard } from "./extract-records-card";

const useRpcQueryMock = vi.fn();
const useRpcMutationMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const updateMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();

vi.mock("mtmsdk/supabase/use-sb-query/use-rpc-query", () => ({
  getRpcQueryKey: (...parts: unknown[]) => parts,
  useRpcQuery: (...args: unknown[]) => useRpcQueryMock(...args),
}));

vi.mock("mtmsdk/supabase/use-sb-query/use-rpc-mutation", () => ({
  useRpcMutation: (...args: unknown[]) => useRpcMutationMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("mtxuilib/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, className }: { children: ReactNode; className?: string }) => <td className={className}>{children}</td>,
  TableHead: ({ children, className }: { children: ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}));

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ExtractRecordsCard
        onProxyEndpointChange={() => undefined}
        proxyEndpoint="proxy.example.com:10085"
        serverOrigin="https://gomtm.example:8443"
      />
    </QueryClientProvider>,
  );
}

describe("ExtractRecordsCard", () => {
  beforeEach(() => {
    useRpcQueryMock.mockReturnValue({
      data: [
        {
          allow_plain_proxy: true,
          allow_vmess_wrapper: false,
          disabled: false,
          display_name: "Direct Extract",
          expires_at: "2026-05-01T00:00:00.000Z",
          id: "11111111-1111-4111-8111-111111111111",
          password: "secret",
          traffic_mode: "standard",
          upstream_id: "22222222-2222-4222-8222-222222222222",
          upstream_outbound: null,
          upstream_protocol: "trojan",
          upstream_source_name: "manual",
          upstream_subscription_id: null,
          upstream_tag: "route-direct-upstream",
          username: "mpx_user",
        },
      ],
      error: null,
      isError: false,
      isLoading: false,
    });

    updateMutateAsync.mockResolvedValue({
      data: {
        allow_plain_proxy: true,
        allow_vmess_wrapper: true,
        created_at: "2026-04-29T00:00:00.000Z",
        disabled: false,
        display_name: "Direct Extract",
        expires_at: "2026-05-01T00:00:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
        password: "secret",
        traffic_mode: "standard",
        updated_at: "2026-04-29T00:00:00.000Z",
        upstream_id: "22222222-2222-4222-8222-222222222222",
        user_id: "33333333-3333-4333-8333-333333333333",
        username: "mpx_user",
      },
      error: null,
    });
    deleteMutateAsync.mockResolvedValue({ data: true, error: null });

    useRpcMutationMock.mockImplementation((name: string) => {
      if (name === "mproxy_extract_update") {
        return { isPending: false, mutateAsync: updateMutateAsync };
      }
      if (name === "mproxy_extract_delete") {
        return { isPending: false, mutateAsync: deleteMutateAsync };
      }
      throw new Error(`unexpected mutation ${name}`);
    });
  });

  afterEach(() => {
    cleanup();
    deleteMutateAsync.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    updateMutateAsync.mockReset();
    useRpcMutationMock.mockReset();
    useRpcQueryMock.mockReset();
    vi.restoreAllMocks();
  });

  it("saves vmess wrapper enablement for non-vmess upstream extracts", async () => {
    renderCard();

    await screen.findByText("Direct Extract");

    fireEvent.click(screen.getByRole("button", { name: "VMess 输出" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith({
        p_allow_plain_proxy: true,
        p_allow_vmess_wrapper: true,
        p_disabled: false,
        p_expires_at: "2026-05-01T00:00:00.000Z",
        p_id: "11111111-1111-4111-8111-111111111111",
        p_traffic_mode: "standard",
      });
    });
  });
});
