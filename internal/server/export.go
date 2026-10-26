package server

import (
	"cmp"
	"fmt"
	"slices"
	"strings"

	"github.com/ellgreen/thoughts/internal/store"
)

// markdown writes a finished (or in-progress) retro for pasting into a wiki
// or ticket. Groups are ordered by votes once discussion has started.
func markdown(b store.Board) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "# %s\n\n", b.Retro.Title)
	if b.Retro.Recap != "" {
		fmt.Fprintf(&sb, "%s\n\n", b.Retro.Recap)
	}

	if len(b.Actions) > 0 {
		sb.WriteString("## Actions\n\n")
		for _, a := range b.Actions {
			box := " "
			if a.DoneAt != nil {
				box = "x"
			}
			fmt.Fprintf(&sb, "- [%s] %s", box, oneLine(a.What))
			var meta []string
			if a.Who != "" {
				meta = append(meta, a.Who)
			}
			if a.DueOn != "" {
				meta = append(meta, "by "+a.DueOn)
			}
			if len(meta) > 0 {
				fmt.Fprintf(&sb, " (%s)", strings.Join(meta, ", "))
			}
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
	}

	votes := map[string]int{}
	if b.Retro.Stage == store.Discuss {
		for _, v := range b.Votes {
			votes[v.GroupID] += v.Count
		}
	}
	byGroup := map[string][]store.Note{}
	for _, n := range b.Notes {
		byGroup[n.GroupID] = append(byGroup[n.GroupID], n)
	}

	for _, c := range b.Retro.Columns {
		groups := slices.DeleteFunc(slices.Clone(b.Groups), func(g store.GroupRow) bool { return g.ColumnID != c.ID || len(byGroup[g.ID]) == 0 })
		slices.SortStableFunc(groups, func(x, y store.GroupRow) int { return cmp.Compare(votes[y.ID], votes[x.ID]) })
		fmt.Fprintf(&sb, "## %s\n\n", c.Title)
		if c.Description != "" {
			fmt.Fprintf(&sb, "_%s_\n\n", oneLine(c.Description))
		}
		if len(groups) == 0 {
			sb.WriteString("Nothing here.\n\n")
		}
		for _, g := range groups {
			heading := g.Title
			if heading == "" && len(byGroup[g.ID]) > 1 {
				heading = "Group"
			}
			if heading != "" || votes[g.ID] > 0 {
				fmt.Fprintf(&sb, "### %s", cmp.Or(heading, oneLine(byGroup[g.ID][0].Content)))
				if v := votes[g.ID]; v > 0 {
					fmt.Fprintf(&sb, " (%d %s)", v, plural(v, "vote", "votes"))
				}
				sb.WriteString("\n\n")
			}
			for _, n := range byGroup[g.ID] {
				fmt.Fprintf(&sb, "- %s (%s)", oneLine(n.Content), n.AuthorName)
				if n.ImgURL != "" {
					fmt.Fprintf(&sb, " ![](%s)", n.ImgURL)
				}
				sb.WriteString("\n")
			}
			sb.WriteString("\n")
		}
	}
	return strings.TrimRight(sb.String(), "\n") + "\n"
}

func oneLine(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

func fileName(title string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(title) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case b.Len() > 0 && !strings.HasSuffix(b.String(), "-"):
			b.WriteByte('-')
		}
	}
	return cmp.Or(strings.Trim(b.String(), "-"), "retro")
}
