import { describe, it, expect } from "vitest";
import { apiSuccess, apiError } from "@/lib/api";

describe("Smoke Test Suite", () => {
  it("confirms vitest runner is configured and operational", () => {
    expect(1 + 1).toBe(2);
  });

  it("verifies api helper responses", async () => {
    const successRes = apiSuccess({ message: "Syncora ready" });
    expect(successRes.status).toBe(200);

    const json = await successRes.json();
    expect(json).toEqual({
      success: true,
      data: { message: "Syncora ready" },
    });

    const errorRes = apiError("Invalid request", "TEST_ERROR", 400);
    expect(errorRes.status).toBe(400);
  });
});
