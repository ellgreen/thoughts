package server

import (
	"encoding/json"
	"time"
	"unicode/utf8"

	"github.com/ellgreen/thoughts/internal/store"
)

type boardResource struct {
	Version     int64                `json:"version"`
	Retro       retroResource        `json:"retro"`
	Groups      []groupResource      `json:"groups"`
	Votes       votesResource        `json:"votes"`
	Actions     []actionResource     `json:"actions"`
	Suggestions []suggestionResource `json:"suggestions"`
	// ServerNow lets clients count the timer down against the server's
	// clock rather than their own, which may be minutes out.
	ServerNow string               `json:"serverNow"`
	Timer     timerResource        `json:"timer"`
	Ready     []string             `json:"ready"`
	Spotlight string               `json:"spotlight"`
	Team      *teamResource        `json:"team"`
	LastTime  []openActionResource `json:"lastTime"`
}

type timerResource struct {
	EndsAt string `json:"endsAt,omitempty"`
	Left   int    `json:"left,omitempty"`
}

type teamResource struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
}

type suggestionResource struct {
	ID    string          `json:"id"`
	Kind  string          `json:"kind"`
	Items json.RawMessage `json:"items"`
}

type retroResource struct {
	ID        string           `json:"id"`
	Title     string           `json:"title"`
	Stage     store.Stage      `json:"stage"`
	MaxVotes  int              `json:"maxVotes"`
	Unlisted  bool             `json:"unlisted"`
	Tags      []string         `json:"tags"`
	Columns   []columnResource `json:"columns"`
	Recap     string           `json:"recap"`
	TeamID    string           `json:"teamId"`
	CreatedAt string           `json:"createdAt"`
}

type columnResource struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type groupResource struct {
	ID       string         `json:"id"`
	ColumnID string         `json:"columnId"`
	Title    string         `json:"title"`
	Notes    []noteResource `json:"notes"`
	MyVotes  int            `json:"myVotes"`
	// Votes is everyone's total, and only shown once discussion starts.
	Votes *int `json:"votes,omitempty"`
}

// A hidden note carries only a rough size, so its column can show that
// something is there without giving away its length, author or image.
type noteResource struct {
	ID        string             `json:"id"`
	Mine      bool               `json:"mine"`
	Hidden    bool               `json:"hidden"`
	Size      int                `json:"size,omitempty"`
	Content   string             `json:"content,omitempty"`
	ImgURL    string             `json:"imgUrl,omitempty"`
	Author    *userResource      `json:"author,omitempty"`
	Reactions []reactionResource `json:"reactions"`
}

type reactionResource struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
	Mine  bool   `json:"mine"`
}

type votesResource struct {
	Used int `json:"used"`
	Max  int `json:"max"`
}

type actionResource struct {
	ID          string `json:"id"`
	What        string `json:"what"`
	Who         string `json:"who"`
	DueOn       string `json:"dueOn"`
	Done        bool   `json:"done"`
	CarriedFrom string `json:"carriedFrom,omitempty"`
}

func newRetroResource(r store.Retro) retroResource {
	res := retroResource{ID: r.ID, Title: r.Title, Stage: r.Stage, MaxVotes: r.MaxVotes, Unlisted: r.Unlisted, Tags: r.Tags,
		Columns: []columnResource{}, Recap: r.Recap, TeamID: r.TeamID, CreatedAt: r.CreatedAt.Format(time.RFC3339)}
	if res.Tags == nil {
		res.Tags = []string{}
	}
	for _, c := range r.Columns {
		res.Columns = append(res.Columns, columnResource{ID: c.ID, Title: c.Title, Description: c.Description})
	}
	return res
}

// project is the board as viewer may see it at now. While reflecting,
// other people's notes are hidden entirely; votes stay private until
// discussion.
func project(b store.Board, viewer string, version int64, now time.Time) boardResource {
	stage := b.Retro.Stage
	out := boardResource{Version: version, Retro: newRetroResource(b.Retro), Groups: []groupResource{}, Actions: []actionResource{},
		Votes: votesResource{Max: b.Retro.MaxVotes}, Suggestions: []suggestionResource{},
		ServerNow: now.UTC().Format(time.RFC3339Nano), Ready: b.Ready, Spotlight: b.Retro.Spotlight, LastTime: []openActionResource{}}
	if out.Ready == nil {
		out.Ready = []string{}
	}
	if t := b.Retro.Timer; t.EndsAt != nil {
		out.Timer.EndsAt = t.EndsAt.Format(time.RFC3339)
	} else {
		out.Timer.Left = t.Left
	}
	if b.Team != nil {
		out.Team = &teamResource{ID: b.Team.ID, Slug: b.Team.Slug, Name: b.Team.Name}
	}
	for _, a := range b.LastTime {
		out.LastTime = append(out.LastTime, newOpenActionResource(a))
	}
	// Suggestions quote note text, so none are shown while notes are hidden.
	if stage != store.Reflect {
		for _, sg := range b.Suggestions {
			out.Suggestions = append(out.Suggestions, suggestionResource{ID: sg.ID, Kind: sg.Kind, Items: sg.Payload})
		}
	}

	reactions := map[string][]reactionResource{}
	if stage == store.Discuss {
		for _, x := range b.Reactions {
			list := reactions[x.NoteID]
			i := indexOf(list, x.Emoji)
			if i < 0 {
				list = append(list, reactionResource{Emoji: x.Emoji})
				i = len(list) - 1
			}
			list[i].Count++
			list[i].Mine = list[i].Mine || x.UserID == viewer
			reactions[x.NoteID] = list
		}
	}

	notes := map[string][]noteResource{}
	for _, n := range b.Notes {
		mine := n.AuthorID == viewer
		nr := noteResource{ID: n.ID, Mine: mine, Reactions: reactions[n.ID]}
		if nr.Reactions == nil {
			nr.Reactions = []reactionResource{}
		}
		if stage == store.Reflect && !mine {
			nr.Hidden = true
			nr.Size = sizeOf(n.Content)
		} else {
			nr.Content, nr.ImgURL = n.Content, n.ImgURL
			if stage != store.Reflect {
				nr.Author = &userResource{ID: n.AuthorID, Name: n.AuthorName}
			}
		}
		notes[n.GroupID] = append(notes[n.GroupID], nr)
	}

	mine, totals := map[string]int{}, map[string]int{}
	for _, v := range b.Votes {
		totals[v.GroupID] += v.Count
		if v.UserID == viewer {
			mine[v.GroupID] += v.Count
			out.Votes.Used += v.Count
		}
	}

	for _, g := range b.Groups {
		gr := groupResource{ID: g.ID, ColumnID: g.ColumnID, Title: g.Title, Notes: notes[g.ID], MyVotes: mine[g.ID]}
		if gr.Notes == nil {
			continue
		}
		if stage == store.Discuss {
			t := totals[g.ID]
			gr.Votes = &t
		}
		out.Groups = append(out.Groups, gr)
	}

	for _, a := range b.Actions {
		out.Actions = append(out.Actions, actionResource{ID: a.ID, What: a.What, Who: a.Who, DueOn: a.DueOn, Done: a.DoneAt != nil, CarriedFrom: a.CarriedFrom})
	}
	return out
}

func indexOf(list []reactionResource, emoji string) int {
	for i, r := range list {
		if r.Emoji == emoji {
			return i
		}
	}
	return -1
}

func sizeOf(content string) int {
	switch n := utf8.RuneCountInString(content); {
	case n <= 40:
		return 1
	case n <= 120:
		return 2
	default:
		return 3
	}
}
