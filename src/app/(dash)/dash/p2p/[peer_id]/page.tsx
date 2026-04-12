import { P2PPeerPageView } from "./p2p-peer-page-view";

export default async function P2PPeerPage({ params }: { params: Promise<{ peer_id: string }> }) {
  const { peer_id } = await params;

  return <P2PPeerPageView peerId={peer_id} />;
}
