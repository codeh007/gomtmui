// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getInitialGomtmServerState, GomtmServerProvider, useGomtmServer } from "./provider";

function Probe() {
  const runtime = useGomtmServer();

  return (
    <>
      <div data-testid="server-url">{runtime.serverUrl}</div>
      <div data-testid="server-url-input">{runtime.serverUrlInput}</div>
      <div data-testid="default-server-url">{runtime.defaultServerUrl}</div>
      <div data-testid="is-using-default">{String(runtime.isUsingDefault)}</div>
      <button type="button" onClick={() => runtime.setServerUrlInput(" https://override.example.com/dash/hermes?tab=1#hash ")}>
        set override
      </button>
      <button type="button" onClick={() => runtime.saveServerUrl()}>
        save
      </button>
    </>
  );
}

describe("getInitialGomtmServerState", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("reads a normalized saved override synchronously", () => {
    localStorage.setItem("gomtm:dash:server-url", " https://saved.example.com/ ");

    expect(getInitialGomtmServerState("https://default.example.com")).toEqual({
      serverUrl: "https://saved.example.com",
      serverUrlInput: "https://saved.example.com",
    });
  });

  it("falls back to the normalized default when no valid override exists", () => {
    localStorage.setItem("gomtm:dash:server-url", "ftp://invalid.example.com/");

    expect(getInitialGomtmServerState(" https://default.example.com/ ")).toEqual({
      serverUrl: "https://default.example.com",
      serverUrlInput: "https://default.example.com",
    });
  });
});

describe("GomtmServerProvider", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("uses the default URL when no dash override exists", async () => {
    localStorage.setItem("gomtm:p2p:server-url", "https://ignored.example.com");

    render(
      <GomtmServerProvider defaultServerUrl=" https://default.example.com/ ">
        <Probe />
      </GomtmServerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://default.example.com");
    });

    expect(screen.getByTestId("server-url-input").textContent).toBe("https://default.example.com");
    expect(screen.getByTestId("default-server-url").textContent).toBe("https://default.example.com");
    expect(screen.getByTestId("is-using-default").textContent).toBe("true");
  });

  it("saves a normalized override to the dash localStorage key", async () => {
    render(
      <GomtmServerProvider defaultServerUrl="https://default.example.com">
        <Probe />
      </GomtmServerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "set override" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(localStorage.getItem("gomtm:dash:server-url")).toBe("https://override.example.com");
    });

    expect(screen.getByTestId("server-url").textContent).toBe("https://override.example.com");
    expect(screen.getByTestId("server-url-input").textContent).toBe("https://override.example.com");
    expect(screen.getByTestId("is-using-default").textContent).toBe("false");
    expect(localStorage.getItem("gomtm:p2p:server-url")).toBeNull();
  });

  it("restores a saved override after remount", async () => {
    localStorage.setItem("gomtm:dash:server-url", "https://saved.example.com/");

    const { unmount } = render(
      <GomtmServerProvider defaultServerUrl="https://default.example.com">
        <Probe />
      </GomtmServerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://saved.example.com");
    });

    unmount();

    render(
      <GomtmServerProvider defaultServerUrl="https://default.example.com">
        <Probe />
      </GomtmServerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://saved.example.com");
    });

    expect(screen.getByTestId("server-url-input").textContent).toBe("https://saved.example.com");
    expect(screen.getByTestId("is-using-default").textContent).toBe("false");
  });

  it("exposes the saved override on the first render when localStorage already has one", () => {
    localStorage.setItem("gomtm:dash:server-url", "https://saved.example.com/");

    render(
      <GomtmServerProvider defaultServerUrl="https://default.example.com">
        <Probe />
      </GomtmServerProvider>,
    );

    expect(screen.getByTestId("server-url").textContent).toBe("https://saved.example.com");
    expect(screen.getByTestId("server-url-input").textContent).toBe("https://saved.example.com");
    expect(screen.getByTestId("is-using-default").textContent).toBe("false");
  });
});
