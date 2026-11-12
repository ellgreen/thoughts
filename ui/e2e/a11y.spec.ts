import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function noViolations(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
    `accessibility problems on ${where}`,
  ).toEqual([]);
}

const looks = [
  { name: "light", colorScheme: "light", chosen: null },
  { name: "dark", colorScheme: "dark", chosen: null },
  { name: "dark by the switch", colorScheme: "light", chosen: "dark" },
] as const;

for (const { name, colorScheme, chosen } of looks) {
  test(`every screen passes axe in ${name} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    if (chosen) await page.addInitScript((t) => localStorage.setItem("thoughts.theme", t), chosen);
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
    await page.getByRole("textbox", { name: /^Add a thought to/ }).first().fill("Pairing worked");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
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
