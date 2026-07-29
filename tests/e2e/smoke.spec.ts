import { expect, test } from "@playwright/test";

test.describe("workspace smoke flow", () => {
  test("loads the app shell", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Patient AI Health Navigator" })
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Chat Placeholder" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile Placeholder" })).toBeVisible();
  });

  test("returns a healthy service payload", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        service: "patient-ai-health-navigator",
        environment: "local",
        status: "ok"
      }
    });
  });
});
