import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

// Regenerates the README screenshots in docs/screenshots from a made-up
// team's retro: THOUGHTS_SCREENSHOTS=1 pnpm exec playwright test screenshots --project=desktop
test.skip(!process.env.THOUGHTS_SCREENSHOTS, "set THOUGHTS_SCREENSHOTS=1 to regenerate the README screenshots");
test.skip(({ isMobile }) => isMobile);

const out = (name: string) => `../docs/screenshots/${name}.png`;

type Board = { retro: { columns: { id: string }[] }; groups: { id: string; notes: { id: string; content?: string }[] }[] };

type Look = { colorScheme?: "light" | "dark"; viewport?: { width: number; height: number } };

async function person(browser: Browser, name: string, look: Look = {}) {
  const context = await browser.newContext({ viewport: look.viewport ?? { width: 1360, height: 1020 }, deviceScaleFactor: 2, colorScheme: look.colorScheme ?? "light" });
  const page = await context.newPage();
  expect((await page.request.post("/api/auth/name", { data: { name } })).ok()).toBe(true);
  await page.goto("/");
  return page;
}

// send runs board commands as this person over the retro's socket and
// returns the board after the last one.
async function send(page: Page, retroId: string, commands: [string, unknown][]): Promise<Board> {
  return page.evaluate(
    async ({ id, list }) => {
      const ws = new WebSocket(`ws://${location.host}/api/retros/${id}/socket`);
      let board: unknown;
      const waiting = new Map<string, (f: { type: string; message?: string }) => void>();
      ws.onmessage = (e) => {
        const f = JSON.parse(e.data);
        if (f.type === "board") board = f.board;
        if (f.ref) waiting.get(f.ref)?.(f);
      };
      await new Promise((r) => (ws.onopen = r));
      await new Promise((r) => setTimeout(r, 100));
      let ref = 0;
      for (const [name, args] of list) {
        const f = await new Promise<{ type: string; message?: string }>((r) => {
          const key = String(++ref);
          waiting.set(key, r);
          ws.send(JSON.stringify({ ref: key, name, args }));
        });
        if (f.type === "error") throw new Error(`${name}: ${f.message}`);
      }
      await new Promise((r) => setTimeout(r, 100));
      ws.close();
      return board;
    },
    { id: retroId, list: commands },
  ) as Promise<Board>;
}

async function createRetro(request: APIRequestContext, teamId: string, title: string) {
  const res = await request.post("/api/retros", {
    data: {
      title,
      teamId,
      tags: ["payments"],
      unlisted: false,
      columns: [
        { title: "Went well", description: "What should we keep doing?" },
        { title: "Puzzled us", description: "What didn't make sense?" },
        { title: "Try next", description: "One thing to change next sprint" },
      ],
    },
  });
  return (await res.json()) as { id: string };
}

const notes: Record<string, [number, string][]> = {
  Priya: [
    [0, "Pairing on the billing migration meant nobody was stuck on their own"],
    [1, "Who owns the alerts channel now?"],
  ],
  Sam: [
    [1, "The checkout test failed nine times and passed on retry"],
    [1, "Two days lost to re-running CI"],
    [0, "Shipped on a Friday and nothing broke"],
  ],
  Jo: [
    [2, "Quarantine tests that fail and pass on retry"],
    [1, "I muted the alerts channel because it never stops"],
  ],
  Kofi: [
    [2, "Pair on every risky change, not just migrations"],
    [0, "The new on-call handover doc is great"],
  ],
};

function groupOf(board: Board, text: string) {
  const group = board.groups.find((g) => g.notes.some((n) => n.content?.startsWith(text)));
  if (!group) throw new Error(`no group for ${text}`);
  return group.id;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
}

test("README screenshots", async ({ browser }) => {
  test.setTimeout(120_000);

  const signedOut = await (await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await signedOut.goto("/login");
  await settle(signedOut);
  await signedOut.screenshot({ path: out("sign-in") });

  const priya = await person(browser, "Priya");
  const team = await (await priya.request.post("/api/teams", { data: { name: "Payments" } })).json();
  const previous = await createRetro(priya.request, team.id, "Sprint 40");
  await send(priya, previous.id, [
    ["action.add", { what: "Write the payments rollback runbook", who: "Tom", dueOn: "2026-10-24" }],
    ["action.add", { what: "Try a no-meeting Wednesday", who: "Jo" }],
  ]);
  const retro = await createRetro(priya.request, team.id, "Sprint 41");
  const url = `/retros/${retro.id}`;
  const columns = (await send(priya, retro.id, [])).retro.columns;

  const people: Record<string, Page> = { Priya: priya };
  for (const name of ["Sam", "Jo", "Kofi"]) people[name] = await person(browser, name);
  for (const [name, list] of Object.entries(notes)) {
    await send(people[name], retro.id, list.map(([col, content]) => ["note.add", { columnId: columns[col].id, content }]));
  }
  await send(people.Sam, retro.id, [["ready.set", { ready: true }]]);
  await send(people.Jo, retro.id, [["ready.set", { ready: true }]]);
  await send(priya, retro.id, [["timer.start", { seconds: 312 }]]);
  for (const name of ["Sam", "Jo", "Kofi"]) await people[name].goto(url);

  await priya.goto(url);
  await settle(priya);
  await priya.screenshot({ path: out("reflect") });

  const lastTime = (await send(priya, retro.id, [])) as Board & { lastTime: { id: string; what: string }[] };
  await send(
    priya,
    retro.id,
    lastTime.lastTime.map((a) => ["lastTime.close", { id: a.id, outcome: a.what.includes("runbook") ? "carried" : "dropped" }]),
  );
  let board = await send(priya, retro.id, [["stage.set", { stage: "group" }], ["timer.clear", {}]]);
  const move = (text: string, onto: string) => ({ text, onto });
  const moves = [
    move("Two days lost", "The checkout test"),
    move("Quarantine tests", "The checkout test"),
    move("Pair on every risky", "Pairing on the billing"),
    move("I muted the alerts", "Who owns the alerts"),
  ];
  for (const m of moves) {
    const noteId = board.groups.flatMap((g) => g.notes).find((n) => n.content?.startsWith(m.text))?.id;
    board = await send(people.Sam, retro.id, [["note.move", { id: noteId, groupId: groupOf(board, m.onto) }]]);
  }
  board = await send(people.Jo, retro.id, [
    ["group.name", { id: groupOf(board, "The checkout test"), title: "Flaky CI" }],
    ["group.name", { id: groupOf(board, "Pairing on the billing"), title: "Pairing" }],
    ["group.name", { id: groupOf(board, "Who owns the alerts"), title: "Who owns alerts" }],
  ]);
  await priya.reload();
  await settle(priya);
  await priya.screenshot({ path: out("group") });

  const phone = await person(browser, "Kofi", { viewport: { width: 390, height: 844 } });
  await phone.goto(url);
  await settle(phone);
  await phone.screenshot({ path: out("phone") });

  await send(priya, retro.id, [["stage.set", { stage: "vote" }]]);
  const votes: Record<string, string[]> = {
    Priya: ["The checkout test", "The checkout test", "Who owns the alerts"],
    Sam: ["The checkout test", "The checkout test", "Pairing on the billing"],
    Jo: ["Who owns the alerts", "Who owns the alerts", "The checkout test"],
    Kofi: ["Pairing on the billing", "The checkout test"],
  };
  for (const [name, list] of Object.entries(votes)) {
    await send(people[name], retro.id, list.map((t) => ["vote.cast", { groupId: groupOf(board, t), delta: 1 }]));
  }
  await send(priya, retro.id, [
    ["stage.set", { stage: "discuss" }],
    ["spotlight.set", { groupId: groupOf(board, "The checkout test") }],
    ["action.add", { what: "Quarantine tests that fail and pass on retry", who: "Sam", dueOn: "2026-10-31" }],
    ["action.add", { what: "Name an owner for the alerts channel", who: "Jo", dueOn: "2026-10-27" }],
  ]);
  await priya.reload();
  await settle(priya);
  await priya.evaluate(() => window.scrollTo(0, 0));
  await priya.screenshot({ path: out("discuss") });

  const dark = await person(browser, "Priya", { colorScheme: "dark" });
  await dark.goto(url);
  await settle(dark);
  await dark.evaluate(() => window.scrollTo(0, 0));
  await dark.screenshot({ path: out("discuss-dark") });
});
