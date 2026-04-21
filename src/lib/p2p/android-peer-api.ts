import type { BrowserNodeLike } from "./libp2p-stream";
import { parseDeviceStatus, toPeerCapabilityTruth, type PeerCapabilityTruth } from "./discovery-contracts";
import { requestPeerHTTP } from "./peer-http-client";

export async function requestAndroidPeerCapabilityTruth(params: {
  address: string;
  node: BrowserNodeLike;
  peerId?: string;
}): Promise<PeerCapabilityTruth> {
  const payload = await requestPeerHTTP({
    address: params.address,
    method: "GET",
    node: params.node,
    path: "/api/android/device_status",
  });
  const status = parseDeviceStatus(payload);
  const truth = toPeerCapabilityTruth(status);
  if (truth == null) {
    throw new Error("android peer returned no capability truth");
  }
  return truth;
}
