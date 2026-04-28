import { describe, expect, it } from "vitest";
import { mproxyExtractRowSchema, mproxyNodeRowSchema } from "./schemas";

describe("mproxy schemas", () => {
  it("preserves the richer extract runtime row fields from the database view", () => {
    const parsed = mproxyExtractRowSchema.parse({
      id: null,
      display_name: null,
      username: null,
      password: null,
      expires_at: null,
      disabled: null,
      traffic_mode: null,
      allow_plain_proxy: null,
      allow_vmess_wrapper: null,
      upstream_id: null,
      upstream_tag: null,
      upstream_protocol: null,
      upstream_subscription_id: null,
      upstream_source_name: null,
      upstream_outbound: null,
    });

    expect(parsed).toMatchObject({
      traffic_mode: null,
      allow_plain_proxy: null,
      allow_vmess_wrapper: null,
      upstream_id: null,
      upstream_tag: null,
      upstream_protocol: null,
      upstream_subscription_id: null,
      upstream_source_name: null,
      upstream_outbound: null,
    });
  });

  it("preserves direct upstream fields for the upstream list row", () => {
    const parsed = mproxyNodeRowSchema.parse({
      id: null,
      subscription_id: null,
      source_name: null,
      source_url: null,
      tag: null,
      protocol: null,
      server: null,
      server_port: null,
      outbound: null,
      disabled: null,
      is_direct: null,
      created_at: null,
      updated_at: null,
    });

    expect(parsed).toMatchObject({
      source_url: null,
      outbound: null,
      is_direct: null,
      created_at: null,
      updated_at: null,
    });
  });
});
