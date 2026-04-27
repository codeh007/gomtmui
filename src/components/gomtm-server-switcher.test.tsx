// @vitest-environment jsdom

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cloneElement, createContext, isValidElement, useContext } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GomtmServerProvider } from "@/lib/gomtm-server/provider";
import { GomtmServerSwitcher } from "./gomtm-server-switcher";

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

const PopoverContext = createContext<{ onOpenChange?: (open: boolean) => void; open?: boolean } | null>(null);

vi.mock("mtxuilib/ui/popover", () => ({
  Popover: ({ children, onOpenChange, open }: { children: ReactNode; onOpenChange?: (open: boolean) => void; open?: boolean }) => (
    <PopoverContext.Provider value={{ onOpenChange, open }}>
      <div data-testid="popover-root" data-open={String(Boolean(open))}>
        {children}
      </div>
    </PopoverContext.Provider>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => {
    const context = useContext(PopoverContext);

    if (!isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(children)) {
      return <>{children}</>;
    }

    const originalOnClick = children.props.onClick;
    return cloneElement(children, {
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        originalOnClick?.(event);
        context?.onOpenChange?.(!context.open);
      },
    });
  },
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("GomtmServerSwitcher", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows the icon trigger and saves a valid override", async () => {
    render(
      <GomtmServerProvider defaultServerUrl="https://default.example.com">
        <GomtmServerSwitcher />
      </GomtmServerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "切换 gomtm server" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " https://next.example.com/dash/hermes?tab=1#hash " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(localStorage.getItem("gomtm:dash:server-url")).toBe("https://next.example.com");
    });

    expect(screen.getByTestId("popover-root").getAttribute("data-open")).toBe("false");
  });

  it("shows a short error for an invalid URL", async () => {
    render(
      <GomtmServerProvider defaultServerUrl="https://default.example.com">
        <GomtmServerSwitcher />
      </GomtmServerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "切换 gomtm server" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ftp://invalid.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByText("请输入 http(s) 地址")).toBeTruthy();
    });

    expect(localStorage.getItem("gomtm:dash:server-url")).toBeNull();
    expect(screen.getByTestId("popover-root").getAttribute("data-open")).toBe("true");
  });
});
