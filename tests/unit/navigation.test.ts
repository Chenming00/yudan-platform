import { describe, expect, it } from "vitest";

import { platformModules } from "@/lib/navigation/modules";

describe("platform module navigation", () => {
  it("exposes unique module keys and paths", () => {
    const keys = platformModules.map((module) => module.key);
    const paths = platformModules.map((module) => module.href);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps the ledger as a primary module", () => {
    expect(platformModules.find((module) => module.key === "ledger")).toMatchObject({
      href: "/ledger",
      label: "账本",
    });
  });
});

