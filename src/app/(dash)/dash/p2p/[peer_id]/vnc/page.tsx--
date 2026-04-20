import { P2PVncPageView } from "./p2p-vnc-page-view";

export default async function P2PVncPage({ params }: { params: Promise<{ peer_id: string }> }) {
  const { peer_id } = await params;

  return <P2PVncPageView peerId={peer_id} />;
}
