import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function noViolations(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
    `accessibility problems on ${where}`,
  ).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`every screen passes axe in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/login");
    await expect(page.getByLabel("Your name")).toBeVisible();
    await noViolations(page, "sign-in");

    await page.getByLabel("Your name").fill("Priya");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Retros", exact: true })).toBeVisible();
    await noViolations(page, "home");

    const res = await page.request.post("/api/retros", {
      data: { title: "Sprint 41", columns: [{ title: "Went well", description: "What should we keep?" }, { title: "Puzzled us", description: "" }] },
    });
    const { id } = await res.json();
    await page.goto(`/retros/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Sprint 41" })).toBeVisible();
    await page.getByRole("button", { name: "Add a thought" }).first().click();
    await page.getByLabel("Note", { exact: true }).fill("Pairing worked");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("note-content")).toBeVisible();
    await noViolations(page, "reflect");

    for (const stage of ["Group", "Vote", "Discuss"]) {
      await page.keyboard.press("]");
      await page.getByRole("button", { name: `Move to ${stage.toLowerCase()}` }).click();
      await expect(page.locator("[aria-current=step]")).toHaveText(stage);
      await noViolations(page, stage.toLowerCase());
    }

    await page.keyboard.press("Shift+Slash");
    await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
    // The sheet fades in; measuring mid-fade would report its contrast low.
    await expect(page.locator("[data-entering]")).toHaveCount(0);
    await page.waitForTimeout(200);
    await noViolations(page, "the shortcut sheet");
  });
}
