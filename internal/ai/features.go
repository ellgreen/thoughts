package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"
)

// The model only ever sees note text and column names: never who wrote a
// note, and never anything from a retro that's still reflecting.

type Column struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type Template struct {
	Theme   string   `json:"theme"`
	Columns []Column `json:"columns"`
}

const templateSystem = `You design columns for team retrospectives. Given a theme, write between 2 and 5 columns that fit it.
Each column needs a short title in the theme's language and a one-line question that prompts people to write a note.
Between them the columns must still cover what went well, what didn't, and what to change, so the retro stays useful.
Avoid stock names like "What went well" or "Start, stop, continue": make it feel like the theme.
No emoji. Titles under 30 characters, questions under 90.`

// MakeTemplate is v1's "conjure a board" feature: columns themed on a prompt.
func MakeTemplate(ctx context.Context, d Driver, theme string) (Template, error) {
	var t Template
	raw, err := d.Complete(ctx, Request{
		Name:   "retro_template",
		System: templateSystem,
		Prompt: "Theme: " + theme,
		Schema: object(map[string]any{
			"theme":   text("The theme, tidied up as a short name"),
			"columns": array(object(map[string]any{"title": text("Column title"), "description": text("Prompt question")}), 5),
		}),
	})
	if err != nil {
		return t, err
	}
	if err := json.Unmarshal(raw, &t); err != nil {
		return t, fmt.Errorf("template: %w", err)
	}
	return cleanTemplate(t)
}

func cleanTemplate(t Template) (Template, error) {
	t.Theme = clip(t.Theme, 60)
	var cols []Column
	for _, c := range t.Columns {
		c.Title, c.Description = clip(c.Title, 60), clip(c.Description, 200)
		if c.Title != "" {
			cols = append(cols, c)
		}
	}
	if len(cols) < 2 {
		return t, fmt.Errorf("template: only %d usable columns", len(cols))
	}
	t.Columns = cols[:min(len(cols), 5)]
	return t, nil
}

type Note struct {
	ID     string `json:"id"`
	Column string `json:"column"`
	Text   string `json:"text"`
}

type Group struct {
	Title   string   `json:"title"`
	NoteIDs []string `json:"noteIds"`
}

const groupsSystem = `You help a team sort the notes from their retrospective into groups about the same thing.
Only group notes that are genuinely about the same topic; leave a note out when it stands alone.
Every group needs at least two notes, and a note can be in only one group.
Give each group a short, plain title that says what its notes have in common (under 40 characters, no emoji).
Use only note ids from the list you're given.`

// SuggestGroups proposes groups for notes. Groups with fewer than two real
// notes, made-up ids, or a note claimed twice are dropped.
func SuggestGroups(ctx context.Context, d Driver, notes []Note) ([]Group, error) {
	if len(notes) < 2 {
		return nil, nil
	}
	var b strings.Builder
	for _, n := range notes {
		fmt.Fprintf(&b, "- id %s, column %q: %s\n", n.ID, n.Column, oneLine(n.Text))
	}
	raw, err := d.Complete(ctx, Request{
		Name:   "note_groups",
		System: groupsSystem,
		Prompt: "Notes:\n" + b.String(),
		Schema: object(map[string]any{
			"groups": array(object(map[string]any{
				"title":   text("What the notes have in common"),
				"noteIds": array(text("A note id from the list"), 50),
			}), 30),
		}),
	})
	if err != nil {
		return nil, err
	}
	var out struct {
		Groups []Group `json:"groups"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("groups: %w", err)
	}
	return cleanGroups(out.Groups, notes), nil
}

func cleanGroups(groups []Group, notes []Note) []Group {
	known := map[string]bool{}
	for _, n := range notes {
		known[n.ID] = true
	}
	used := map[string]bool{}
	var out []Group
	for _, g := range groups {
		var ids []string
		for _, id := range g.NoteIDs {
			if known[id] && !used[id] && !slices.Contains(ids, id) {
				ids = append(ids, id)
			}
		}
		if len(ids) < 2 {
			continue
		}
		for _, id := range ids {
			used[id] = true
		}
		out = append(out, Group{Title: clip(g.Title, 60), NoteIDs: ids})
	}
	return out
}

type GroupNotes struct {
	ID    string   `json:"id"`
	Title string   `json:"title"`
	Notes []string `json:"notes"`
	Votes int      `json:"votes"`
}

type Name struct {
	GroupID string `json:"groupId"`
	Title   string `json:"title"`
}

const namesSystem = `You name groups of notes from a team retrospective.
For each group, write a short, plain title that says what its notes have in common (under 40 characters, no emoji).
Use only group ids from the list you're given.`

func NameGroups(ctx context.Context, d Driver, groups []GroupNotes) ([]Name, error) {
	if len(groups) == 0 {
		return nil, nil
	}
	raw, err := d.Complete(ctx, Request{
		Name:   "group_names",
		System: namesSystem,
		Prompt: "Groups:\n" + describeGroups(groups, false),
		Schema: object(map[string]any{
			"names": array(object(map[string]any{"groupId": text("A group id from the list"), "title": text("The group's title")}), 50),
		}),
	})
	if err != nil {
		return nil, err
	}
	var out struct {
		Names []Name `json:"names"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("names: %w", err)
	}
	known := map[string]bool{}
	for _, g := range groups {
		known[g.ID] = true
	}
	var names []Name
	for _, n := range out.Names {
		if known[n.GroupID] && strings.TrimSpace(n.Title) != "" {
			names = append(names, Name{GroupID: n.GroupID, Title: clip(n.Title, 60)})
			delete(known, n.GroupID)
		}
	}
	return names, nil
}

type Action struct {
	What    string `json:"what"`
	GroupID string `json:"groupId"`
}

const actionsSystem = `You help a team choose follow-up actions from the most-voted topics in their retrospective.
The team adds what you suggest to their list and checks it at the next retro, so suggest an action only when the notes name a specific problem or idea and a next step someone would really take. A vague or invented action is worse than none.
Most topics don't need an action. When the notes are too short or vague to tell what they mean, or nothing calls for a change, return an empty list: that is a good answer. Suggest three at most.
Write each as a short instruction that names the change in the team's own words, under 100 characters. For example "Quarantine the flaky checkout test until it's fixed" rather than "Schedule a sync to discuss the checkout test".
A meeting, a summary, an investigation or a hunt for examples is only an action when a note asks for one.
Leave out owners and dates; the team adds those. Tie each action to the group id it comes from.`

func DraftActions(ctx context.Context, d Driver, groups []GroupNotes, existing []string) ([]Action, error) {
	if len(groups) == 0 {
		return nil, nil
	}
	prompt := "Topics, most votes first:\n" + describeGroups(groups, true)
	if len(existing) > 0 {
		prompt += "\nActions the team already has (don't repeat these):\n- " + strings.Join(existing, "\n- ")
	}
	raw, err := d.Complete(ctx, Request{
		Name:   "draft_actions",
		System: actionsSystem,
		Prompt: prompt,
		Schema: object(map[string]any{
			"actions": array(object(map[string]any{"what": text("The action"), "groupId": text("The group id it comes from")}), 3),
		}),
	})
	if err != nil {
		return nil, err
	}
	var out struct {
		Actions []Action `json:"actions"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("actions: %w", err)
	}
	known := map[string]bool{}
	for _, g := range groups {
		known[g.ID] = true
	}
	var actions []Action
	for _, a := range out.Actions {
		a.What = clip(a.What, 300)
		if a.What == "" {
			continue
		}
		if !known[a.GroupID] {
			a.GroupID = ""
		}
		actions = append(actions, a)
	}
	return actions[:min(len(actions), 3)], nil
}

const recapSystem = `You write the recap of a team retrospective for someone who missed it.
Write two or three short sentences in plain, everyday English, the way a colleague would sum it up in a chat message: what the team talked about most, and what they agreed to do.
Name each topic by what it is about, in a few words of your own. Mention actions only from the list you're given; when there are none, say nothing about actions.
Stick to what the notes say. Leave out vote counts, headings, lists and praise.
For example: "Most of the talk was about flaky CI, which cost two days of reruns this sprint. Pairing went well and people want more of it. The team will quarantine the checkout test until it's fixed."`

func Recap(ctx context.Context, d Driver, title string, groups []GroupNotes, actions []string) (string, error) {
	prompt := fmt.Sprintf("Retro: %s\n\nTopics, most votes first:\n%s", title, describeTopics(groups))
	if len(actions) > 0 {
		prompt += "\nActions:\n- " + strings.Join(actions, "\n- ")
	}
	raw, err := d.Complete(ctx, Request{
		Name:   "recap",
		System: recapSystem,
		Prompt: prompt,
		Schema: object(map[string]any{"recap": text("The recap")}),
	})
	if err != nil {
		return "", err
	}
	var out struct {
		Recap string `json:"recap"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("recap: %w", err)
	}
	if out.Recap = clip(out.Recap, 1200); out.Recap == "" {
		return "", fmt.Errorf("recap: empty")
	}
	return out.Recap, nil
}

func describeGroups(groups []GroupNotes, votes bool) string {
	var b strings.Builder
	for _, g := range groups {
		fmt.Fprintf(&b, "- group %s", g.ID)
		if g.Title != "" {
			fmt.Fprintf(&b, " %q", oneLine(g.Title))
		}
		if votes {
			fmt.Fprintf(&b, " (%d votes)", g.Votes)
		}
		b.WriteString(":\n")
		for _, n := range g.Notes {
			fmt.Fprintf(&b, "  - %s\n", oneLine(n))
		}
	}
	return b.String()
}

// describeTopics leaves out ids, which the recap has no use for and would
// otherwise quote.
func describeTopics(groups []GroupNotes) string {
	var b strings.Builder
	for _, g := range groups {
		b.WriteString("- ")
		if g.Title != "" {
			fmt.Fprintf(&b, "%q, ", oneLine(g.Title))
		}
		fmt.Fprintf(&b, "%d votes:\n", g.Votes)
		for _, n := range g.Notes {
			fmt.Fprintf(&b, "  - %s\n", oneLine(n))
		}
	}
	return b.String()
}

func oneLine(s string) string { return strings.Join(strings.Fields(s), " ") }

func clip(s string, n int) string {
	s = oneLine(s)
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return strings.TrimSpace(string([]rune(s)[:n]))
}
