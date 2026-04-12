import dynamic from "next/dynamic";
import type React from "react";

export interface ResourceViewProps {
  resourceId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export type ResourceComponent = React.ComponentType<ResourceViewProps>;

const GenericResourceContainer = dynamic(
  () => import("@/components/resources/GenericResourceContainer").then((mod) => mod.GenericResourceContainer),
  { loading: () => null },
);

// 注册表映射
const RESOURCE_REGISTRY: Record<string, ResourceComponent> = {};

/**
 * 根据资源类型获取对应的容器组件
 */
export function getResourceComponent(type: string): ResourceComponent {
  const normalizedType = type?.toLowerCase();
  return RESOURCE_REGISTRY[normalizedType] || GenericResourceContainer;
}
