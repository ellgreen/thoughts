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

async function key(page: Page, k: string) {
  await page.keyboard.press(k);
}

async function nextStage(page: Page, stage: string) {
  await key(page, "]");
  await page.getByRole("button", { name: `Move to ${stage.toLowerCase()}` }).click();
  await expect(page.locator("[aria-current=step]")).toHaveText(stage);
}

test.skip(({ isMobile }) => isMobile, "a two-person keyboard run is a desktop flow; the phone project covers layout elsewhere");

test("a whole retro, two people", async ({ browser }) => {
  const priya = await signedIn(browser, "Priya");
  await key(priya, "c");
  await priya.getByLabel("What's this retro for?").fill("Sprint 41");
  await priya.getByRole("button", { name: "Start the retro" }).click();
  await expect(priya.getByRole("heading", { level: 1, name: "Sprint 41" })).toBeVisible();
  const url = new URL(priya.url()).pathname;

  await priya.getByRole("button", { name: "Add a thought" }).first().click();
  await priya.getByLabel("Note", { exact: true }).fill("The checkout test is flaky");
  await key(priya, "Enter");
  await expect(priya.getByTestId("note-content")).toHaveText("The checkout test is flaky");

  const sam = await signedIn(browser, "Sam", `/login?redirect=${encodeURIComponent(url)}`);
  await expect(sam.getByRole("heading", { level: 1, name: "Sprint 41" })).toBeVisible();
  await expect(sam.getByRole("img", { name: "Someone's thought, hidden until grouping" })).toHaveCount(1);
  await expect(sam.getByText("checkout")).toHaveCount(0);
  await expect(sam.getByText("Priya")).toHaveCount(0);
  await expect(priya.getByText("2 here")).toBeVisible();

  await sam.getByRole("button", { name: "Add a thought" }).first().click();
  await sam.getByLabel("Note", { exact: true }).fill("Reruns cost us two days");
  await key(sam, "Enter");
  await expect(priya.getByRole("img", { name: "Someone's thought, hidden until grouping" })).toHaveCount(1);

  await nextStage(priya, "Group");
  await expect(sam.getByTestId("note-content").filter({ hasText: "The checkout test is flaky" })).toBeVisible();
  await expect(sam.getByRole("article", { name: /checkout test is flaky, by Priya/ })).toBeVisible();

  await sam.getByRole("article", { name: /Reruns cost us two days/ }).getByRole("button", { name: "Note options" }).click();
  await sam.getByRole("menuitem", { name: "Move to…" }).click();
  await sam.getByRole("searchbox").fill("checkout");
  await sam.getByRole("option", { name: /checkout test is flaky/ }).click();
  await expect(priya.getByRole("button", { name: "Name this group" })).toBeVisible();

  await nextStage(sam, "Vote");
  const vote = sam.locator("[data-group-id]").filter({ hasText: "checkout test is flaky" }).getByRole("button", { name: "Vote", exact: true });
  for (let i = 0; i < 5; i++) await vote.click();
  await expect(sam.getByText("0 of 5 votes left.")).toBeVisible();
  await expect(vote).toBeDisabled();
  await expect(priya.getByText("5 of 5 votes left.")).toBeVisible();

  await nextStage(priya, "Discuss");
  await expect(priya.getByRole("img", { name: "5 votes" })).toBeVisible();
  await key(priya, "a");
  await priya.getByLabel("What's going to happen?").fill("Quarantine flaky tests");
  await priya.getByLabel("Who").fill("Sam");
  await priya.getByRole("button", { name: "Add it" }).click();
  await expect(sam.getByText("Quarantine flaky tests")).toBeVisible();

  const md = await (await priya.request.get(`/api/retros/${url.split("/").pop()}/export.md`)).text();
  expect(md).toContain("- [ ] Quarantine flaky tests (Sam)");
  expect(md).toContain("(5 votes)");
});

test("the shortcut list opens with ?", async ({ browser }) => {
  const page = await signedIn(browser, "Jo");
  await key(page, "Shift+Slash");
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  await expect(page.getByText("Start a new retro")).toBeVisible();
});

test("the palette opens with Ctrl+K and keeps what's typed", async ({ browser }) => {
  const page = await signedIn(browser, "Jo");
  await key(page, "Control+k");
  await expect(page.getByRole("heading", { name: "Do something" })).toBeVisible();
  await page.keyboard.type("cnew");
  await expect(page.getByRole("searchbox")).toHaveValue("cnew");
  await expect(page.getByRole("heading", { name: "New retro" })).toHaveCount(0);
  await key(page, "Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await key(page, "Shift+Slash");
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  await key(page, "c");
  await expect(page.getByRole("heading", { name: "New retro" })).toHaveCount(0);
});
