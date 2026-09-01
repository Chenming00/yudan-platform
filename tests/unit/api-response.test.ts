import { describe, expect, it } from "vitest";

import { apiFailure, apiSuccess } from "@/lib/api/response";

describe("API response contract", () => {
  it("creates a success envelope with request id", () => {
    expect(apiSuccess({ id: "transaction-1" }, "request-1")).toEqual({
      success: true,
      data: { id: "transaction-1" },
      requestId: "request-1",
    });
  });

  it("omits failure details when they are not supplied", () => {
    expect(apiFailure("PERMISSION_DENIED", "没有权限", "request-2")).toEqual({
      success: false,
      error: { code: "PERMISSION_DENIED", message: "没有权限" },
      requestId: "request-2",
    });
  });
});

