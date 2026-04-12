import { z } from "zod";

export const zBaseListRequest = z
  .object({
    kw: z.string().optional().describe("Keyword for search"),
    page: z.coerce.number().default(1).describe("Page number (1-based)"),
    pageSize: z.coerce.number().default(24).describe("Number of records per page"),
  })
  .describe("基础列表请求")
  .meta({ ref: "BaseListRequest" });

export const zPaginate = z.object({
  total: z.number().describe("Total number of records"),
  page: z.number().describe("Current page number"),
  pageSize: z.number().describe("Number of records per page"),
  totalPages: z.number().describe("Total number of pages"),
  hasNext: z.boolean().describe("Whether there is a next page"),
});
export const zBaseListResponse = z
  .object({
    paginate: zPaginate,
  })
  .describe("基础列表响应")
  .meta({ ref: "BaseListResp" });

export const zRpcResponseBase = z.object({
  error: z.string().optional(),
  data: z.any(),
});
