import { expect, test } from "@playwright/test";

test("exposes a non-cached liveness endpoint without authentication", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "yudan-platform" });
});

test("redirects a signed-out visitor to login without leaking the protected page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await expect(page.getByText("家庭总览")).toHaveCount(0);
});

test("renders accessible login and invitation registration on desktop and mobile", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/login");
  await expect(page.getByLabel("邮箱")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "使用邀请码注册" }).click();

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "创建账号" })).toBeVisible();
  await expect(page.getByLabel("邀请码")).toBeVisible();
  await expect(page.getByText("不强制绑定 GitHub")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(browserErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("registration.png"), fullPage: true });
});

test("rejects a cross-origin browser mutation before authentication", async ({ request }) => {
  const response = await request.post("/api/ledger/transactions", {
    headers: { origin: "https://evil.ykn.cm", "sec-fetch-site": "same-site" },
    data: {},
  });
  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    success: false,
    error: { code: "PERMISSION_DENIED" },
  });
});
