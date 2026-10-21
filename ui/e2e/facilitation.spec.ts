import { expect, test, type Browser, type Page } from "@playwright/test";

async function signedIn(browser: Browser, name: string, path = "/") {
  const page = await (await browser.newContext()).newPage();
  await page.goto(path);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Sign in|Join the retro/ }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return page;
}

async function nextStage(page: Page, stage: string) {
  await page.keyboard.press("]");
  await page.getByRole("button", { name: `Move to ${stage.toLowerCase()}` }).click();
  await expect(page.locator("[aria-current=step]")).toHaveText(stage);
}

async function newRetro(page: Page, title: string) {
  await page.keyboard.press("c");
  await page.getByLabel("What's this retro for?").fill(title);
  await page.getByRole("button", { name: "Start the retro" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

test.skip(({ isMobile }) => isMobile, "a two-person run is a desktop flow");

test("a team's next retro opens with last time's actions", async ({ browser }) => {
  const priya = await signedIn(browser, "Priya");
  const team = `Platform ${Date.now()}`;
  await priya.getByRole("button", { name: "New team" }).click();
  await priya.getByLabel("Team name").fill(team);
  await priya.getByRole("button", { name: "Make the team" }).click();
  await expect(priya.getByRole("heading", { level: 1, name: team })).toBeVisible();

  await newRetro(priya, "Sprint 40");
  for (const stage of ["Group", "Vote", "Discuss"]) await nextStage(priya, stage);
  for (const what of ["Write the payments runbook", "Try a no-meeting Wednesday"]) {
    await priya.keyboard.press("a");
    await priya.getByLabel("What's going to happen?").fill(what);
    await priya.getByRole("button", { name: "Add it" }).click();
    await expect(priya.getByText(what)).toBeVisible();
  }

  await priya.getByRole("link", { name: team }).click();
  await expect(priya.getByText("Write the payments runbook")).toBeVisible();
  await newRetro(priya, "Sprint 41");
  const lastTime = priya.getByRole("region", { name: "From last time" });
  await expect(lastTime.getByText("Write the payments runbook")).toBeVisible();
  await lastTime.getByRole("listitem").filter({ hasText: "runbook" }).getByRole("button", { name: "Carry over" }).click();
  await lastTime.getByRole("listitem").filter({ hasText: "Wednesday" }).getByRole("button", { name: "Drop" }).click();
  await expect(lastTime).toHaveCount(0);

  for (const stage of ["Group", "Vote", "Discuss"]) await nextStage(priya, stage);
  await expect(priya.getByRole("complementary").getByText("Write the payments runbook")).toBeVisible();
});

test("timer, ready check and spotlight reach everyone", async ({ browser }) => {
  const priya = await signedIn(browser, "Priya");
  await newRetro(priya, "Facilitated");
  const url = new URL(priya.url()).pathname;
  const sam = await signedIn(browser, "Sam", `/login?redirect=${encodeURIComponent(url)}`);
  await expect(priya.getByText("0 of 2 done")).toBeVisible();

  await priya.keyboard.press("t");
  await priya.getByRole("menuitem", { name: "2 minutes" }).click();
  await expect(sam.getByRole("timer")).toHaveText(/^(2:00|1:5\d)$/);
  await priya.getByRole("button", { name: /^Pause/ }).click();
  await expect(sam.getByRole("button", { name: /^Resume/ })).toBeVisible();

  await sam.keyboard.press("d");
  await expect(priya.getByText("1 of 2 done")).toBeVisible();

  await priya.getByRole("button", { name: "Add a thought" }).first().click();
  await priya.getByLabel("Note", { exact: true }).fill("Deploys were calm");
  await priya.keyboard.press("Enter");
  await expect(priya.getByTestId("note-content")).toHaveText("Deploys were calm");
  await nextStage(priya, "Group");
  await expect(priya.getByText("0 of 2 done")).toBeVisible();
  for (const stage of ["Vote", "Discuss"]) await nextStage(priya, stage);
  await expect(priya.getByRole("button", { name: /I'm done/ })).toHaveCount(0);

  await priya.getByRole("button", { name: "Bring everyone here" }).click();
  await expect(sam.getByText("Everyone's here")).toBeVisible();
  await sam.getByRole("button", { name: "One at a time" }).click();
  await expect(sam.getByText("Last of 1")).toBeVisible();
  await expect(sam.getByRole("button", { name: /^Next/ })).toHaveCount(0);
  await sam.getByRole("button", { name: "Show all groups" }).click();
  await expect(sam.getByRole("button", { name: "One at a time" })).toHaveAttribute("aria-pressed", "false");
});

test("one at a time steps through groups with the arrow keys", async ({ browser }) => {
  const priya = await signedIn(browser, "Priya");
  await newRetro(priya, "Stepping");
  for (const text of ["Deploys were calm", "Flaky checkout test"]) {
    await priya.getByRole("button", { name: "Add a thought" }).first().click();
    await priya.getByLabel("Note", { exact: true }).fill(text);
    await priya.keyboard.press("Enter");
    await expect(priya.getByRole("dialog")).toHaveCount(0);
  }
  for (const stage of ["Group", "Vote", "Discuss"]) await nextStage(priya, stage);

  await priya.getByRole("button", { name: "One at a time" }).click();
  await expect(priya.getByText("1 of 2")).toBeVisible();
  await expect(priya.getByRole("button", { name: /Previous/ })).toBeDisabled();
  await priya.keyboard.press("ArrowRight");
  await expect(priya.getByText("Last of 2")).toBeVisible();
  await expect(priya.getByRole("button", { name: /^Next/ })).toHaveCount(0);
  await expect(priya.getByRole("button", { name: "Show all groups" })).toBeVisible();
  await priya.keyboard.press("ArrowLeft");
  await expect(priya.getByText("1 of 2")).toBeVisible();
});
