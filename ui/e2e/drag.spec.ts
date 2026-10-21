import { expect, test, type Locator, type Page } from "@playwright/test";

test.skip(({ isMobile }) => isMobile, "dragging is a pointer interaction");

// drag holds the mouse down on from, moves until the board shows its drop
// zones, then lets go over whatever to finds.
async function drag(page: Page, from: Locator, to: () => Locator) {
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 40, { steps: 5 });
  const target = to();
  await expect(target).toBeVisible();
  const t = (await target.boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 });
  await page.mouse.up();
}

test("notes drag into a group and back out", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Your name").fill("Priya");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const res = await page.request.post("/api/retros", {
    data: { title: "Dragging", columns: [{ title: "Went well", description: "" }, { title: "Puzzled us", description: "" }] },
  });
  const { id } = await res.json();
  await page.goto(`/retros/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Dragging" })).toBeVisible();
  for (const text of ["Flaky checkout test", "CI reruns"]) {
    await page.getByRole("button", { name: "Add a thought" }).first().click();
    await page.getByLabel("Note", { exact: true }).fill(text);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.keyboard.press("]");
  await page.getByRole("button", { name: "Move to group" }).click();
  await expect(page.locator("[aria-current=step]")).toHaveText("Group");

  const reruns = () => page.getByRole("article", { name: /CI reruns/ });
  const flaky = () => page.getByRole("article", { name: /Flaky checkout test/ });
  await drag(page, reruns(), flaky);
  await expect(page.getByRole("button", { name: "Name this group" })).toBeVisible();

  const puzzled = page.locator("[data-column-index='1']");
  await drag(page, reruns(), () => puzzled.getByText("Drop here for a pile of its own"));
  await expect(page.getByRole("button", { name: "Name this group" })).toHaveCount(0);
  await expect(puzzled.getByRole("article", { name: /CI reruns/ })).toBeVisible();
  await expect(page.getByText("Drop here for a pile of its own")).toHaveCount(0);

  await drag(page, reruns(), flaky);
  await expect(page.getByRole("button", { name: "Name this group" })).toBeVisible();
  await drag(page, reruns(), () => page.locator("[data-column-index='0']").getByRole("button", { name: "Name this group" }));
  await expect(page.getByRole("button", { name: "Name this group" })).toHaveCount(0);

  await drag(page, reruns(), flaky);
  await expect(page.getByRole("button", { name: "Name this group" })).toBeVisible();
  await reruns().getByRole("button", { name: "Note options" }).click();
  await page.getByRole("menuitem", { name: "Take out of this group" }).click();
  await expect(page.getByRole("button", { name: "Name this group" })).toHaveCount(0);
});
