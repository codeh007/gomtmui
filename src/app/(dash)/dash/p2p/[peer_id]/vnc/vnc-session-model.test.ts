import { describe, expect, it } from "vitest";
import type { PeerCandidate, PeerCapabilityTruth } from "@/lib/p2p/discovery-contracts";
import { buildP2PVncSessionModel, getP2PVncAvailabilityMeta, getP2PVncViewportCopy } from "./vnc-session-model";

function createPeerCandidate(overrides: Partial<PeerCandidate> = {}): PeerCandidate {
  return {
    peerId: "12D3KooWPeerA",
    multiaddrs: [],
    lastDiscoveredAt: "2026-03-30T10:00:00Z",
    ...overrides,
  };
}

function createCapabilityTruth(overrides: PeerCapabilityTruth = { vnc: { state: "available" } }): PeerCapabilityTruth {
  return overrides;
}

describe("buildP2PVncSessionModel", () => {
  it("keeps the session in connecting state while the browser peer is still joining", () => {
    const model = buildP2PVncSessionModel({
      capabilityTruth: null,
      networkStatus: "joining",
      errorMessage: null,
      targetPeer: null,
    });

    expect(model.phase).toBe("connecting");
    expect(model.availability).toBe("preparing");
  });

  it("moves to ensuring_vnc once the target worker exposes the current desktop control path", () => {
    const model = buildP2PVncSessionModel({
      capabilityTruth: createCapabilityTruth(),
      networkStatus: "peer_candidates_ready",
      errorMessage: null,
      targetPeer: createPeerCandidate(),
    });

    expect(model.phase).toBe("ensuring_vnc");
    expect(model.availability).toBe("preparing");
  });

  it("surfaces permission denied separately from generic disconnects", () => {
    const model = buildP2PVncSessionModel({
      capabilityTruth: createCapabilityTruth(),
      networkStatus: "peer_candidates_ready",
      errorMessage: "permission denied: viewer is not allowed",
      targetPeer: createPeerCandidate(),
      transportPhase: "permission_denied",
    });

    expect(model.phase).toBe("permission_denied");
    expect(model.availability).toBe("permission_denied");
  });

  it("falls back to waiting_for_target when a previously ready peer disappears from discovery", () => {
    const model = buildP2PVncSessionModel({
      capabilityTruth: null,
      networkStatus: "peer_candidates_ready",
      errorMessage: null,
      targetPeer: null,
      transportPhase: "ready",
    });

    expect(model.phase).toBe("waiting_for_target");
    expect(model.availability).toBe("preparing");
  });

  it("marks the session ready once stream and desktop are established", () => {
    const model = buildP2PVncSessionModel({
      capabilityTruth: createCapabilityTruth(),
      networkStatus: "peer_candidates_ready",
      errorMessage: null,
      targetPeer: createPeerCandidate(),
      transportPhase: "ready",
    });

    expect(model.phase).toBe("ready");
    expect(model.availability).toBe("available");
  });
});

describe("getP2PVncAvailabilityMeta", () => {
  it("maps the four user-facing availability states to a single label/tone truth", () => {
    expect(getP2PVncAvailabilityMeta("available")).toEqual({
      label: "可用",
      tone: "default",
    });
    expect(getP2PVncAvailabilityMeta("preparing")).toEqual({
      label: "准备中",
      tone: "secondary",
    });
    expect(getP2PVncAvailabilityMeta("unavailable")).toEqual({
      label: "不可用",
      tone: "destructive",
    });
    expect(getP2PVncAvailabilityMeta("permission_denied")).toEqual({
      label: "拒绝访问",
      tone: "destructive",
    });
  });
});

describe("getP2PVncViewportCopy", () => {
  it("returns a single permission denied copy truth for the viewport", () => {
    expect(getP2PVncViewportCopy("permission_denied", null)).toEqual({
      title: "拒绝访问",
      detail: "目标节点拒绝了当前桌面会话权限。",
    });
  });

  it("uses the current phase to derive the overlay copy", () => {
    expect(getP2PVncViewportCopy("waiting_for_target", null)).toEqual({
      title: "等待目标设备上线",
      detail: "节点上线后自动进入桌面。",
    });
    expect(getP2PVncViewportCopy("disconnected", "远端桌面会话已断开。2 秒后自动重试。")).toEqual({
      title: "正在恢复桌面",
      detail: "远端桌面会话已断开。2 秒后自动重试。",
    });
    expect(getP2PVncViewportCopy("error", null)).toEqual({
      title: "桌面连接失败",
      detail: "目标桌面会话当前无法自动恢复。",
    });
  });

  it("returns null once the desktop is ready", () => {
    expect(getP2PVncViewportCopy("ready", null)).toBeNull();
  });
});
