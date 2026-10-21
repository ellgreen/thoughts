import { expect, test } from "@playwright/test";

test("the api is healthy", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("unknown api paths are 404s, not the app", async ({ request }) => {
  expect((await request.get("/api/nope")).status()).toBe(404);
});

test("signed out, any page asks for a name and comes back after", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  await expect(page).toHaveTitle("thoughts");

  await page.getByLabel("Your name").fill("A");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Use at least 2 characters.")).toBeVisible();

  await page.getByLabel("Your name").fill("Priya");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Retros", exact: true })).toBeVisible();
  await expect(page.getByText("Priya")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("a v1 sign-in link with a retro redirect says where you're going", async ({ page }) => {
  await page.goto("/login?redirect=%2Fretros%2F3f2a3b8e-8a8e-4c4e-9a59-7d0c1e1f2a3b");
  await expect(page.getByRole("button", { name: "Join the retro" })).toBeVisible();
});

test("a redirect to another site is ignored", async ({ page }) => {
  await page.goto("/login?redirect=https%3A%2F%2Fexample.com%2F");
  await page.getByLabel("Your name").fill("Sam");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});
