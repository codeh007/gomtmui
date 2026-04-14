// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetP2PSessionDepsForTest,
  __setP2PSessionDepsForTest,
  P2PSessionProvider,
  useP2PSession,
} from "./use-p2p-session";

function SessionProbe() {
  const session = useP2PSession();

  return (
    <>
      <div data-testid="status">{session.status}</div>
      <div data-testid="bootstrap-input">{session.bootstrapInput}</div>
    </>
  );
}

afterEach(() => {
  cleanup();
  __resetP2PSessionDepsForTest();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("P2PSessionProvider", () => {
  it("does not request system status when no local bootstrap is stored", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    __setP2PSessionDepsForTest({
      readStoredBootstrapTarget: () => ({}),
    });

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("needs-bootstrap");
    });

    expect(screen.getByTestId("bootstrap-input").textContent).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
