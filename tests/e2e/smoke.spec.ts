import { expect, test } from "@playwright/test";

test("shows the platform dashboard and module navigation", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "家庭总览" })).toBeVisible();
  await expect(page.locator("nav:visible")).toBeVisible();
  await expect(page.getByText("一笔付款，多种用途，只统计一次")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
});
