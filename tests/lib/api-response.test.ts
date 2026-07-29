import { apiError, apiNotImplemented, apiSuccess } from "@/lib/api-response";

describe("api-response utility", () => {
  it("returns success payload with provided status", async () => {
    const response = apiSuccess({ ok: true }, 201);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      data: {
        ok: true
      }
    });
  });

  it("returns not implemented error payload", async () => {
    const response = apiNotImplemented("POST /api/chat");
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toEqual({
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "POST /api/chat is scaffolded but not implemented yet."
      }
    });
  });

  it("returns explicit error payload with status", async () => {
    const response = apiError("CONFIG_MISSING", "Missing environment variable.", 500);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        code: "CONFIG_MISSING",
        message: "Missing environment variable."
      }
    });
  });
});
