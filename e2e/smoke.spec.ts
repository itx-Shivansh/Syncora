import { test, expect } from "@playwright/test";

test("health check returns 200", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("healthy");
});

test("login page loads successfully", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Syncora/i);
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
