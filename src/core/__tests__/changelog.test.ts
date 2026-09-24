import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_VERSION } from "@/core/changelog";

describe("changelog", () => {
  it("APP_VERSION bate com package.json#version", () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../../package.json"), "utf-8"),
    ) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });
});
