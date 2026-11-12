import { expect, test } from "@playwright/test";

test("the theme switch flips, survives a reload and is in the palette", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const html = page.locator("html");
  await page.goto("/login");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveCSS("color-scheme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

  await page.getByLabel("Your name").fill("Priya");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Retros", exact: true })).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByRole("option", { name: "Match the system theme" }).click();
  await expect(html).not.toHaveAttribute("data-theme", /.*/);
  await expect(html).toHaveCSS("color-scheme", "light");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});
