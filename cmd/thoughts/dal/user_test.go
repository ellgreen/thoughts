package dal_test

import (
	"context"
	"testing"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/testutil"
)

// Two people can share a name, and one person entering theirs twice is two
// sessions. A previous attempt to treat the name as an account broke both.
func TestUserInsertGivesEachLoginItsOwnIdentity(t *testing.T) {
	ctx := context.Background()
	db := testutil.NewDB(t)

	first, err := dal.UserInsert(ctx, db, "Alex")
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}

	second, err := dal.UserInsert(ctx, db, "Alex")
	if err != nil {
		t.Fatalf("failed to insert a second user with the same name: %v", err)
	}

	if first.ID == second.ID {
		t.Fatalf("both logins share the identity %s", first.ID)
	}
}
