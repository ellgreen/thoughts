package live

import (
	"errors"
	"fmt"
	"testing"
)

func render(version int64) Render {
	return func(viewer string) []byte { return fmt.Appendf(nil, "%s@%d", viewer, version) }
}

func snapshot(version int64) (Render, error) { return render(version), nil }

func TestUpdateSendsEachViewerTheirOwnFrame(t *testing.T) {
	var h Hub
	priya, sam := NewClient(Person{ID: "priya", Name: "Priya"}), NewClient(Person{ID: "sam", Name: "Sam"})
	_ = h.Join(priya, snapshot)
	_ = h.Join(sam, snapshot)
	if got := string(<-priya.Send); got != "priya@0" {
		t.Fatalf("snapshot = %s", got)
	}
	<-sam.Send

	if err := h.Update(func(v int64) (Render, error) { return render(v), nil }); err != nil {
		t.Fatal(err)
	}
	if a, b := string(<-priya.Send), string(<-sam.Send); a != "priya@1" || b != "sam@1" {
		t.Fatalf("frames = %s, %s", a, b)
	}
}

func TestFailedUpdateSendsNothingAndKeepsTheVersion(t *testing.T) {
	var h Hub
	c := NewClient(Person{ID: "priya"})
	_ = h.Join(c, snapshot)
	<-c.Send
	err := h.Update(func(int64) (Render, error) { return nil, errors.New("nope") })
	if err == nil || len(c.Send) != 0 {
		t.Fatalf("err = %v, queued = %d", err, len(c.Send))
	}
	_ = h.Update(func(v int64) (Render, error) { return render(v), nil })
	if got := string(<-c.Send); got != "priya@1" {
		t.Fatalf("got %s", got)
	}
}

func TestASlowClientIsDroppedNotWaitedFor(t *testing.T) {
	var h Hub
	c := NewClient(Person{ID: "priya"})
	_ = h.Join(c, snapshot)
	for range cap(c.Send) + 1 {
		_ = h.Update(func(v int64) (Render, error) { return render(v), nil })
	}
	select {
	case <-c.Gone:
	default:
		t.Fatal("client with a full buffer was not dropped")
	}
}

func TestPeopleCountsEachPersonOnce(t *testing.T) {
	var h Hub
	for _, p := range []Person{{ID: "s", Name: "sam"}, {ID: "p", Name: "Priya"}, {ID: "s", Name: "sam"}} {
		_ = h.Join(NewClient(p), snapshot)
	}
	got := h.People()
	if len(got) != 2 || got[0].Name != "Priya" {
		t.Fatalf("people = %+v", got)
	}
}

func TestHubsAreSharedAndForgotten(t *testing.T) {
	hs := NewHubs()
	a, releaseA := hs.Acquire("r")
	b, releaseB := hs.Acquire("r")
	if a != b {
		t.Fatal("two hubs for one retro")
	}
	releaseA()
	releaseA()
	releaseB()
	c, _ := hs.Acquire("r")
	if c == a {
		t.Fatal("hub outlived everyone leaving")
	}
}
