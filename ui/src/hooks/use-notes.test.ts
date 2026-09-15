import { describe, expect, it } from "vitest";
import { SocketEvent } from "@/events";
import { Note } from "@/types";
import { groupNotes, initialState, notesReducer, NotesState } from "./use-notes";

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    created_by_me: true,
    column_id: "column-1",
    group_id: "group-1",
    content: "a thought",
    img_url: "",
    reactions: [],
    ...overrides,
  };
}

function replay(...events: SocketEvent[]): NotesState {
  return events.reduce(notesReducer, initialState);
}

describe("notesReducer", () => {
  it("replaces everything on note_index", () => {
    const state = replay(
      { name: "note_create", payload: { column_id: "c", content: "x", ref: "r" } },
      { name: "note_index", payload: [note({ id: "server-1" })] },
    );

    expect(state.notes.map((n) => n.id)).toEqual(["server-1"]);
    expect(state.rollbacks).toEqual({});
  });

  it("is not loaded until the first fetch lands", () => {
    expect(initialState.loaded).toBe(false);

    const state = replay({ name: "note_index", payload: [] });

    expect(state.loaded).toBe(true);
  });

  it("stays loaded once notes start arriving over the socket", () => {
    const state = replay(
      { name: "note_index", payload: [] },
      { name: "note_created", payload: note({ id: "n1" }) },
    );

    expect(state.loaded).toBe(true);
  });

  it("shows a created note immediately, keyed by its ref", () => {
    const state = replay({
      name: "note_create",
      payload: { column_id: "column-1", content: "optimistic", ref: "ref-1" },
    });

    expect(state.notes).toHaveLength(1);
    expect(state.notes[0].id).toBe("ref-1");
    expect(state.notes[0].content).toBe("optimistic");
    expect(state.rollbacks).toEqual({ "ref-1": null });
  });

  it("carries the author onto the placeholder", () => {
    const state = replay({
      name: "note_create",
      payload: {
        column_id: "column-1",
        content: "optimistic",
        ref: "ref-1",
        created_by_name: "Alex",
      },
    });

    expect(state.notes[0].created_by_name).toBe("Alex");
  });

  it("swaps the placeholder for the confirmed note", () => {
    const state = replay(
      { name: "note_create", payload: { column_id: "column-1", content: "optimistic", ref: "ref-1" } },
      { name: "note_created", payload: { ...note({ id: "server-1" }), ref: "ref-1" } },
    );

    expect(state.notes.map((n) => n.id)).toEqual(["server-1"]);
    expect(state.rollbacks).toEqual({});
  });

  it("keeps a confirmed note in its own slot even when another note is confirmed first", () => {
    const state = replay(
      { name: "note_create", payload: { column_id: "column-1", content: "mine", ref: "ref-1" } },
      { name: "note_created", payload: note({ id: "theirs", created_by_me: false }) },
      { name: "note_created", payload: { ...note({ id: "server-1" }), ref: "ref-1" } },
    );

    expect(state.notes.map((n) => n.id)).toEqual(["server-1", "theirs"]);
  });

  it("still appends a confirmed note with no matching placeholder", () => {
    const state = replay({
      name: "note_created",
      payload: { ...note({ id: "server-1" }), ref: "ref-1" },
    });

    expect(state.notes.map((n) => n.id)).toEqual(["server-1"]);
  });

  it("does not leak the ref onto the stored note", () => {
    const state = replay({
      name: "note_created",
      payload: { ...note({ id: "server-1" }), ref: "ref-1" },
    });

    expect(state.notes[0]).not.toHaveProperty("ref");
  });

  it("rolls back only the create that failed", () => {
    const state = replay(
      { name: "note_create", payload: { column_id: "column-1", content: "first", ref: "ref-1" } },
      { name: "note_create", payload: { column_id: "column-1", content: "second", ref: "ref-2" } },
      { name: "error", payload: { message: "nope", ref: "ref-1" } },
    );

    // The unrelated in-flight create survives - the old single-sentinel
    // placeholder wiped out every pending note at once.
    expect(state.notes.map((n) => n.content)).toEqual(["second"]);
    expect(state.rollbacks).toEqual({ "ref-2": null });
  });

  it("restores the previous content when an edit fails", () => {
    const state = replay(
      { name: "note_index", payload: [note({ id: "n1", content: "original" })] },
      { name: "note_update", payload: { id: "n1", content: "edited", ref: "ref-1" } },
      { name: "error", payload: { message: "nope", ref: "ref-1" } },
    );

    expect(state.notes[0].content).toBe("original");
    expect(state.rollbacks).toEqual({});
  });

  it("puts a note back when a delete fails", () => {
    const state = replay(
      { name: "note_index", payload: [note({ id: "n1" })] },
      { name: "note_delete", payload: { id: "n1", ref: "ref-1" } },
      { name: "error", payload: { message: "nope", ref: "ref-1" } },
    );

    expect(state.notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("ignores errors that carry no ref", () => {
    const state = replay(
      { name: "note_create", payload: { column_id: "column-1", content: "pending", ref: "ref-1" } },
      { name: "error", payload: { message: "something unrelated" } },
    );

    expect(state.notes).toHaveLength(1);
  });

  it("applies a move optimistically", () => {
    const state = replay(
      { name: "note_index", payload: [note({ id: "n1" })] },
      {
        name: "note_update",
        payload: { id: "n1", column_id: "column-2", group_id: "group-2", ref: "ref-1" },
      },
    );

    expect(state.notes[0].column_id).toBe("column-2");
    expect(state.notes[0].group_id).toBe("group-2");
  });

  it("ungroups a note when an update omits the group, matching the server", () => {
    const state = replay(
      { name: "note_index", payload: [note({ id: "n1", group_id: "shared" })] },
      { name: "note_update", payload: { id: "n1", content: "edited", ref: "ref-1" } },
    );

    expect(state.notes[0].group_id).toBe("ungrouped-n1");
  });

  it("clears the image when remove_img_url is sent", () => {
    const state = replay(
      { name: "note_index", payload: [note({ id: "n1", img_url: "https://example.com/a.gif" })] },
      { name: "note_update", payload: { id: "n1", remove_img_url: true, ref: "ref-1" } },
    );

    expect(state.notes[0].img_url).toBe("");
  });

  it("ignores an update for a note it has never seen", () => {
    const state = replay({
      name: "note_update",
      payload: { id: "ghost", content: "x", ref: "ref-1" },
    });

    expect(state).toBe(initialState);
  });

  it("accepts confirmations for notes created by other people", () => {
    const state = replay(
      { name: "note_index", payload: [] },
      { name: "note_created", payload: note({ id: "theirs", created_by_me: false }) },
      { name: "note_updated", payload: note({ id: "theirs", created_by_me: false, content: "changed" }) },
    );

    expect(state.notes).toHaveLength(1);
    expect(state.notes[0].content).toBe("changed");
  });

  it("removes a note on note_deleted", () => {
    const state = replay(
      { name: "note_index", payload: [note({ id: "n1" }), note({ id: "n2" })] },
      { name: "note_deleted", payload: { id: "n1" } },
    );

    expect(state.notes.map((n) => n.id)).toEqual(["n2"]);
  });

  it("updates a note's reactions on note_reactions_updated", () => {
    const state = replay(
      { name: "note_index", payload: [note({ id: "n1" }), note({ id: "n2" })] },
      {
        name: "note_reactions_updated",
        payload: {
          id: "n1",
          reactions: [{ emoji: "👍", count: 1, reacted_by_me: true }],
        },
      },
    );

    expect(state.notes[0].reactions).toEqual([
      { emoji: "👍", count: 1, reacted_by_me: true },
    ]);
    expect(state.notes[1].reactions).toEqual([]);
  });

  it("ignores reactions for a note it has never seen", () => {
    const state = replay(
      { name: "note_index", payload: [note({ id: "n1" })] },
      {
        name: "note_reactions_updated",
        payload: { id: "ghost", reactions: [] },
      },
    );

    expect(state.notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("leaves state untouched for events it does not handle", () => {
    const state = replay({ name: "connection_info", payload: { users: [] } });

    expect(state).toBe(initialState);
  });
});

describe("groupNotes", () => {
  it("nests notes by column and then group", () => {
    const grouped = groupNotes([
      note({ id: "a", column_id: "c1", group_id: "g1" }),
      note({ id: "b", column_id: "c1", group_id: "g1" }),
      note({ id: "c", column_id: "c1", group_id: "g2" }),
      note({ id: "d", column_id: "c2", group_id: "g3" }),
    ]);

    expect(Object.keys(grouped)).toEqual(["c1", "c2"]);
    expect(grouped.c1.g1.map((n) => n.id)).toEqual(["a", "b"]);
    expect(grouped.c1.g2.map((n) => n.id)).toEqual(["c"]);
    expect(grouped.c2.g3.map((n) => n.id)).toEqual(["d"]);
  });

  it("returns nothing for no notes", () => {
    expect(groupNotes([])).toEqual({});
  });
});
