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

  test("validates selector to summary flow and active profile visibility", async ({ page }) => {
    await page.goto("/chat");

    await expect(page.getByRole("heading", { level: 1, name: "Patient Chat" })).toBeVisible();
    await expect(
      page.getByText("Select and confirm a patient profile to enable chat.")
    ).toBeVisible();

    await page.getByRole("radio", { name: /Patient 400/i }).check();
    await page.getByRole("button", { name: "Confirm Selection" }).click();

    await expect(page.getByText("Chat is disabled while the selected profile is loading.")).toBeVisible();
    await expect(page.getByText("Profile ready. You can start chatting.")).toBeVisible();
    await expect(page.getByText("Current profile: Patient 400")).toBeVisible();
    await expect(page.getByText("Condition A")).toBeVisible();

    await page.getByLabel("Message").fill("Test conversation started");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Queued Messages" })).toBeVisible();
    await expect(page.getByText("Patient 400: Test conversation started")).toBeVisible();
    await expect(page.getByText("Current profile: Patient 400")).toBeVisible();

    await page.getByRole("radio", { name: /Patient 403/i }).check();
    await page.getByRole("button", { name: "Confirm Selection" }).click();

    await expect(page.getByText("Chat is disabled while the selected profile is loading.")).toBeVisible();
    await expect(page.getByText("Profile ready. You can start chatting.")).toBeVisible();
    await expect(page.getByText("Current profile: Patient 403")).toBeVisible();
    await expect(page.getByText("Review blood pressure trend (planned)")).toBeVisible();
  });

  test("validates load failure and retry recovery", async ({ page }) => {
    await page.goto("/chat");

    await page.evaluate(() => {
      (window as Window & { __PHN_FAIL_PROFILE_LOAD_ONCE__?: boolean }).__PHN_FAIL_PROFILE_LOAD_ONCE__ = true;
    });

    await page.getByRole("radio", { name: /Patient 401/i }).check();
    await page.getByRole("button", { name: "Confirm Selection" }).click();

    await expect(page.getByText("Unable to load profile summary")).toBeVisible();
    await expect(page.getByText("Retry Profile Load")).toBeVisible();
    await expect(
      page.getByText("Chat is disabled until profile load issues are resolved. Use retry to continue.")
    ).toBeVisible();
    await expect(page.getByLabel("Message")).toBeDisabled();

    await page.getByRole("button", { name: "Retry Profile Load" }).click();

    await expect(page.getByText("Chat is disabled while the selected profile is loading.")).toBeVisible();
    await expect(page.getByText("Profile ready. You can start chatting.")).toBeVisible();
    await expect(page.getByText("Current profile: Patient 401")).toBeVisible();
    await expect(page.getByText("Medication A")).toBeVisible();
    await expect(page.getByLabel("Message")).toBeEnabled();
  });
});
