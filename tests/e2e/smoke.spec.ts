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

  test("validates selector to transcript flow with timestamps and refresh stability", async ({ page }) => {
    await page.goto("/chat");

    await expect(page.getByRole("heading", { level: 1, name: "Patient Chat" })).toBeVisible();
    await expect(page.getByText("Select a showcase profile before starting chat.")).toBeVisible();

    await page.getByRole("radio", { name: /Patient 400/i }).check();
    await page.getByRole("button", { name: "Confirm Selection" }).click();

    await expect(page.getByText("Chat is disabled while the selected profile is loading.")).toBeVisible();
    await expect(page.getByText("Profile ready. You can start chatting.")).toBeVisible();
    await expect(page.getByText("Current profile: Patient 400")).toBeVisible();
    await expect(page.getByText("Condition A")).toBeVisible();

    await page.getByLabel("Message").fill("Test conversation started");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Conversation Transcript" })).toBeVisible();
    const turns = page.locator(".chat-turn");
    await expect(turns).toHaveCount(2);
    await expect(turns.nth(0)).toContainText("You");
    await expect(turns.nth(0)).toContainText("Test conversation started");
    await expect(turns.nth(1)).toContainText("Assistant");
    await expect(turns.nth(1)).toContainText("Message captured");
    await expect(page.locator(".chat-turn time")).toHaveCount(2);
    await expect(page.getByText("Current profile: Patient 400")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Current profile: Patient 400")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Conversation Transcript" })).toBeVisible();
    const turnsAfterReload = page.locator(".chat-turn");
    await expect(turnsAfterReload).toHaveCount(2);
    await expect(turnsAfterReload.nth(0)).toContainText("You");
    await expect(turnsAfterReload.nth(1)).toContainText("Assistant");

    await page.getByRole("radio", { name: /Patient 403/i }).check();
    await page.getByRole("button", { name: "Confirm Selection" }).click();

    await expect(page.getByText("Chat is disabled while the selected profile is loading.")).toBeVisible();
    await expect(page.getByText("Profile ready. You can start chatting.")).toBeVisible();
    await expect(page.getByText("Current profile: Patient 403")).toBeVisible();
    await expect(page.getByText("Review blood pressure trend (planned)")).toBeVisible();
    await expect(page.getByText("No transcript turns yet. Send a message to begin.")).toBeVisible();
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
