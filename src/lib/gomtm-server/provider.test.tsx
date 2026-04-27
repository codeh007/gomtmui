// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { getInitialGomtmServerState } from "./provider";

describe("getInitialGomtmServerState", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("reads a normalized saved override synchronously", () => {
    localStorage.setItem("gomtm:dash:server-url", " https://saved.example.com/ ");

    expect(getInitialGomtmServerState("https://default.example.com")).toEqual({
      serverUrl: "https://saved.example.com",
      serverUrlInput: "https://saved.example.com",
    });
  });

  it("falls back to the normalized default when no valid override exists", () => {
    localStorage.setItem("gomtm:dash:server-url", "ftp://invalid.example.com/");

    expect(getInitialGomtmServerState(" https://default.example.com/ ")).toEqual({
      serverUrl: "https://default.example.com",
      serverUrlInput: "https://default.example.com",
    });
  });
});
