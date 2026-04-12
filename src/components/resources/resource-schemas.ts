import { z } from "zod";

/**
 * 资源列表项 Schema (用于 resource_list RPC)
 */
export const zResourceListItem = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  type: z.string(),
  target_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const zResourceListResult = z.array(zResourceListItem);

/**
 * 单个资源详情 Schema (用于 resource_get RPC)
 */
export const zResourceDetail = zResourceListItem.extend({
  data: z.any().nullable().optional(),
  meta: z.any().nullable().optional(),
  user_id: z.string().optional(),
});
