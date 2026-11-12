import { expect, test } from "@playwright/test";

test("a press picks a note up and a press on a group puts it down", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Your name").fill("Priya");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Retros", exact: true })).toBeVisible();
  const res = await page.request.post("/api/retros", {
    data: { title: "Picking", columns: [{ title: "Went well", description: "" }, { title: "Puzzled us", description: "" }] },
  });
  const { id } = await res.json();
  await page.goto(`/retros/${id}`);
  for (const text of ["Flaky checkout test", "CI reruns"]) {
    await page.getByRole("textbox", { name: /^Add a thought to/ }).first().fill(text);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("article", { name: text })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("]");
  await page.getByRole("button", { name: "Move to group" }).click();
  await expect(page.locator("[aria-current=step]")).toHaveText("Group");

  const reruns = () => page.getByRole("article", { name: /CI reruns/ });
  const named = page.getByRole("button", { name: "Name this group" });

  await reruns().click();
  await expect(page.getByText(/^Moving/)).toBeVisible();
  await page.getByRole("article", { name: /Flaky checkout test/ }).click();
  await expect(named).toBeVisible();
  await expect(page.getByText(/^Moving/)).toHaveCount(0);

  await reruns().click();
  await page.locator("[data-column-index='1']").getByText("Drop here for a pile of its own").click();
  await expect(named).toHaveCount(0);
  await expect(page.locator("[data-column-index='1']").getByRole("article", { name: /CI reruns/ })).toBeVisible();

  await reruns().click();
  await page.getByRole("button", { name: "Put it back" }).click();
  await expect(page.getByText("Drop here for a pile of its own")).toHaveCount(0);
});
