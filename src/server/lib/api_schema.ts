import { z } from "zod";
import { zBaseListResponse } from "./schema/base_schema";

export const zUserRole = z.string().min(1);

export const zUser = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().optional(),
    role: zUserRole.default("USER"),
    avatarUrl: z.string().optional(),
  })
  .describe("用户")
  .meta({ ref: "User" });

export type User = z.infer<typeof zUser>;

export const ErrorCodeEnum = z.enum([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INTERNAL_ERROR",
  "CONFLICT",
  "BAD_REQUEST",
  "UNPROCESSABLE_ENTITY",
]);

// 统一的 API 错误响应格式
export const zApiError = z
  .object({
    error: z.object({
      code: ErrorCodeEnum.optional(),
      message: z.string(),
      cause: z.string().optional(),

      details: z.string().optional(),
      field: z.string().optional(), // 用于验证错误
    }),
  })
  .describe("API错误响应")
  .meta({ ref: "ApiError" });

export const zApiCommonDeleteResponse = z
  .object({
    id: z.string().optional(),
    message: z.string().optional(),
  })
  .describe("API通用删除响应")
  .meta({ ref: "ApiCommonDelete" });

export const z400Response = zApiError;
export const z401Response = zApiError;
export const z403Response = zApiError;
export const z404Response = zApiError;
export const z422Response = zApiError;
export const z500Response = zApiError;

export const api400Response = {
  400: {
    content: {
      "application/json": {
        schema: z400Response,
      },
    },
    description: "Bad Request - 请求参数错误",
  },
};

export const api401Response = {
  401: {
    content: {
      "application/json": {
        schema: z401Response,
      },
    },
    description: "Unauthorized - 未授权访问",
  },
};

export const Openapi403Response = {
  403: {
    content: {
      "application/json": {
        schema: z403Response,
      },
    },
    description: "Forbidden - 禁止访问",
  },
};

export const api404Response = {
  404: {
    content: {
      "application/json": {
        schema: z404Response,
      },
    },
    description: "Not Found - 资源不存在",
  },
};

export const api422Response = {
  422: {
    content: {
      "application/json": {
        schema: z422Response,
      },
    },
    description: "Unprocessable Entity",
  },
};

export const api500Response = {
  500: {
    content: {
      "application/json": {
        schema: z500Response,
      },
    },
    description: "Internal Server Error",
  },
};

export const CommonErrorResponses = {
  ...api400Response,
  ...api401Response,
  ...Openapi403Response,
  ...api404Response,
  ...api422Response,
  ...api500Response,
};

export const createErrorResponse = (
  code: z.infer<typeof ErrorCodeEnum>,
  message: string,
  details?: string,
  field?: string,
) => {
  return zApiError.parse({
    error: {
      code,
      message,
      details,
      field,
    },
  });
};

export const createValidationError = (message: string, field?: string) =>
  createErrorResponse("VALIDATION_ERROR", message, undefined, field);

export const createNotFoundError = (message: string = "资源不存在") => createErrorResponse("NOT_FOUND", message);

export const createUnauthorizedError = (message: string = "未授权访问") => createErrorResponse("UNAUTHORIZED", message);

export const createForbiddenError = (message: string = "禁止访问") => createErrorResponse("FORBIDDEN", message);

export const createInternalError = (message: string = "internal error") =>
  createErrorResponse("INTERNAL_ERROR", message);

export const createBadRequestError = (message: string = "请求参数错误") => createErrorResponse("BAD_REQUEST", message);

export const zSite = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    organizationId: z.string(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    state: z.record(z.string(), z.unknown()).optional(),
    automationEnabled: z.boolean(),
  })
  .describe("站点")
  .meta({ ref: "Site" });

export const zSiteListRequest = z
  .object({
    limit: z.number().min(1).max(100).default(10),
    offset: z.number().min(0).default(0),
    enabled: z.boolean().optional(),
    search: z.string().optional(),
    organizationId: z.string(),
  })
  .describe("站点列表请求")
  .meta({ ref: "SiteListRequest" });

export const zSiteCreateRequest = z
  .object({
    title: z.string().min(1, "站点标题不能为空"),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
    automationEnabled: z.boolean().default(false),
    state: z.record(z.string(), z.unknown()).default({}),
    organizationId: z.string(),
  })
  .describe("站点创建请求")
  .meta({ ref: "SiteCreateRequest" });

export const zSiteUpdateRequest = z
  .object({
    id: z.string(),
    title: z.string().min(1, "站点标题不能为空").optional(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
    automationEnabled: z.boolean().optional(),
    state: z.record(z.string(), z.unknown()).optional(),
    tenantId: z.string(),
  })
  .describe("站点更新请求")
  .meta({ ref: "SiteUpdateRequest" });

export const zSiteDeleteRequest = z
  .object({
    id: z.string(),
    tenantId: z.string(),
  })
  .describe("站点删除请求")
  .meta({ ref: "SiteDeleteRequest" });

export const zGetSiteByIdRequest = z
  .object({
    id: z.string(),
  })
  .describe("根据ID获取站点请求")
  .meta({ ref: "GetSiteByIdRequest" });

export const zSiteQueryParams = z
  .object({
    limit: z.string().default("10").transform(Number),
    offset: z.string().default("0").transform(Number),
    enabled: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    search: z.string().optional(),
  })
  .describe("站点查询参数")
  .meta({ ref: "SiteQueryParams" });

export const zSiteListResponse = zBaseListResponse
  .extend({
    rows: z.array(zSite),
  })
  .describe("站点列表响应")
  .meta({ ref: "SiteList" });

export type Site = z.infer<typeof zSite>;
export type SiteListRequest = z.infer<typeof zSiteListRequest>;
export type SiteCreateRequest = z.infer<typeof zSiteCreateRequest>;
export type SiteUpdateRequest = z.infer<typeof zSiteUpdateRequest>;
export type SiteDeleteRequest = z.infer<typeof zSiteDeleteRequest>;
export type GetSiteByIdRequest = z.infer<typeof zGetSiteByIdRequest>;
export type SiteQueryParams = z.infer<typeof zSiteQueryParams>;
export type SiteListResponse = z.infer<typeof zSiteListResponse>;

// 通用删除请求
export const zDeleteRequest = z
  .object({
    ids: z.array(z.string()),
  })
  .describe("删除请求")
  .meta({ ref: "DeleteReq" });
// 通用删除响应
export const zDeleteResponse = z
  .object({
    success: z.boolean(),
    error: z.string().optional(),
  })
  .describe("删除响应")
  .meta({ ref: "DeleteResp" });

export const api400Res = {
  400: {
    content: {
      "application/json": {
        schema: z400Response,
      },
    },
    description: "Bad Request",
  },
};

export const apiStreamEventContent = {
  schema: {
    type: "object",
    properties: {
      event: {
        type: "string",
        description: "The type of event",
      },
      data: {
        type: "string",
        description: "The event payload",
      },
      id: {
        type: "string",
        description: "The event id",
      },
    },
  },
};
