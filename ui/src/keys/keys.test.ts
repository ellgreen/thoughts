import { describe, expect, it } from "vitest";
import { keyLabel, matches } from "./keys";

const key = (k: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("matches", () => {
  it.each([
    ["n", key("n"), true, true],
    ["n", key("N", { shiftKey: true }), true, false],
    ["shift+v", key("V", { shiftKey: true }), true, true],
    ["v", key("v", { metaKey: true }), true, false],
    ["mod+k", key("k", { metaKey: true }), true, true],
    ["mod+k", key("k", { ctrlKey: true }), true, false],
    ["mod+k", key("k", { ctrlKey: true }), false, true],
    ["ctrl+k", key("k", { ctrlKey: true }), true, true],
    ["ctrl+k", key("k", { metaKey: true }), true, false],
    ["ctrl+k", key("k", { ctrlKey: true }), false, true],
    ["left", key("ArrowLeft"), true, true],
    ["?", key("?", { shiftKey: true }), true, true],
    ["]", key("]"), true, true],
    ["backspace", key("Delete"), true, true],
    ["up", key("ArrowUp"), true, true],
  ])("%s against %o (mac %s)", (combo, e, mac, want) => {
    expect(matches(e, combo, mac)).toBe(want);
  });
});

describe("keyLabel", () => {
  it("names keys the way they're printed", () => {
    expect(keyLabel("n")).toBe("N");
    expect(keyLabel("backspace")).toBe("⌫");
  });
});
