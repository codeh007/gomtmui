"use client";

import { InstanceWindowsManualBootstrapView } from "./instance-windows-manual-bootstrap-view";

interface InstanceCreateViewProps {
  onCreated: (result: { id: string }) => void;
  onCancel: () => void;
}

export function InstanceCreateView({ onCreated, onCancel }: InstanceCreateViewProps) {
  return <InstanceWindowsManualBootstrapView onCreated={onCreated} onCancel={onCancel} />;
}
