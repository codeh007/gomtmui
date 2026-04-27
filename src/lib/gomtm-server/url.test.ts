import { describe, expect, it } from "vitest";
import { isValidGomtmServerUrl, normalizeGomtmServerUrl } from "./url";

describe("gomtm server url", () => {
  it("normalizes an http(s) URL down to its bare origin", () => {
    expect(normalizeGomtmServerUrl(" https://foo.example.com/dash/hermes?tab=1#hash ")).toBe(
      "https://foo.example.com",
    );
  });

  it("accepts only valid http(s) origins after normalization", () => {
    expect(isValidGomtmServerUrl(normalizeGomtmServerUrl("https://foo.example.com/dash/hermes"))).toBe(true);
    expect(isValidGomtmServerUrl(normalizeGomtmServerUrl("ftp://foo.example.com/path"))).toBe(false);
    expect(isValidGomtmServerUrl(normalizeGomtmServerUrl("not a url"))).toBe(false);
  });
});
