import {
  APIRequestContext,
  BrowserContext,
  expect,
  test,
} from "@playwright/test";

async function loginAs(context: BrowserContext, name: string) {
  const res = await context.request.post("/api/auth/login", {
    data: { name },
  });

  expect(res.ok()).toBeTruthy();
}

async function createRetro(request: APIRequestContext, title: string) {
  const res = await request.post("/api/retros", {
    data: {
      title,
      columns: [
        { title: "Went well", description: "" },
        { title: "Went badly", description: "" },
      ],
      unlisted: true,
      tags: [],
    },
  });

  expect(res.ok()).toBeTruthy();

  const retro = await res.json();
  return retro.id as string;
}

test("a note stops reading as scrambled noise once the retro leaves reflect, without a reload", async ({
  browser,
}) => {
  const author = await browser.newContext();
  const viewer = await browser.newContext();

  await loginAs(author, `Author ${Date.now()}`);
  await loginAs(viewer, `Viewer ${Date.now()}`);

  const retroId = await createRetro(
    author.request,
    `Obfuscation regression ${Date.now()}`,
  );

  const authorPage = await author.newPage();
  const viewerPage = await viewer.newPage();

  await authorPage.goto(`/retros/${retroId}`);
  await viewerPage.goto(`/retros/${retroId}`);

  const content = "a distinctive thought only the author typed";

  await authorPage.getByRole("button", { name: "Add a thought" }).first().click();
  await authorPage.getByRole("textbox", { name: "Note" }).fill(content);
  await authorPage.getByRole("button", { name: "Save" }).click();

  // The optimistic placeholder and the server-confirmed note briefly coexist
  // mid-animation (the confirmed note swaps in under a new id/key), so wait
  // for that to settle before asserting on a single element.
  const authorNote = authorPage.getByTestId("note-content");
  await expect(authorNote).toHaveCount(1);

  // The author's own note always renders in the clear on their own screen.
  await expect(authorNote).toHaveText(content);

  const viewerNote = viewerPage.getByTestId("note-content");
  await expect(viewerNote).toHaveCount(1);

  // Someone else's note is obfuscated server-side during reflect, so the
  // viewer's copy of it should not match what was actually typed.
  await expect(viewerNote).toBeVisible();
  await expect(viewerNote).not.toHaveText(content);

  await authorPage.getByRole("button", { name: "Start grouping" }).click();
  await authorPage.getByRole("button", { name: "Move on" }).click();

  // The viewer's board is already open and never reloads. Without the fix,
  // it keeps showing the reflect-stage obfuscated text forever.
  await expect(viewerNote).toHaveText(content, { timeout: 10_000 });
});
