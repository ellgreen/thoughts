# Upgrading from v1 to v2

Change the image tag and restart. v2 converts v1's data on its first start,
and keeps a copy of the v1 database next to it first.

```bash
docker pull ghcr.io/ellgreen/thoughts:2
docker run -p 3000:3000 -v "$PWD/data:/data" ghcr.io/ellgreen/thoughts:2
```

## Before you start

- **Check the volume.** `/data` should hold `thoughts.sqlite` and
  `session.key`. Images before 1.0.0 could write the database somewhere
  other than the volume; if `thoughts.sqlite` isn't in your volume, copy it
  out of the old container first (`docker cp <container>:/data/thoughts.sqlite .`
  or wherever it is) and put it there.
- **Stop v1 before starting v2.** Two versions writing one file is how
  databases get damaged.
- Any v1 release can be upgraded, from 0.1.0 to 1.2.1. You don't need to go
  through 1.2.1 first.

## What happens on first start

The log says what it's doing:

```
found a thoughts v1 database; copying it, then converting it to v2
converted the v1 database imported="20 users, 22 retros, 78 notes, 45 votes, 2 reactions, 21 actions, 2 tags; left out 5 votes on deleted groups or from deleted users" backup=/data/thoughts.v1-backup-20261021-105507.sqlite
```

1. v2 copies the database to `thoughts.v1-backup-<date>-<time>.sqlite` in
   the same folder.
2. It converts everything in one transaction: users, retros and their
   columns, notes and groups, votes, actions (v1's tasks), tags and
   reactions. Retro ids don't change.
3. If anything goes wrong, nothing is changed and v2 stops with an error
   that names the backup. Your v1 data is still there; v1 can still open it.

v1 never enforced the links between its tables, so an old database can hold
rows that point at something deleted. Those are left out and counted in the
log line:

- votes on a group whose notes were all deleted, or from a deleted user
- reactions on a deleted note
- notes whose author is gone keep their text and show as "Someone"

## What stays the same

- **Links.** `/retros/<id>`, `/tags/<tag>` and `/login?redirect=` go where
  they did.
- **Who wrote what.** People signed in to v1 stay signed in as themselves,
  for as long as their v1 cookie would have lasted (up to 30 days), so
  "your notes" are still theirs. This needs `session.key` to stay in `/data`.
  After that, signing in with a name works as it always did: each sign-in is
  a new person.
- **Settings.** Every `THOUGHTS_*` variable v1 read means the same in v2.
  `THOUGHTS_UI_ADDRESS` and `THOUGHTS_TENOR_API_KEY` are no longer used and
  are ignored.
- **Port and volume.** 3000 and `/data`. The image still runs as root, so the
  files v1 wrote stay readable.

## What changes

- Stages are Reflect, Group, Vote and Discuss. v1's "brainstorm" is Reflect.
- While reflecting, nobody sees anyone else's notes at all: v1 scrambled the
  text but showed who wrote each note and any image on it.
- Votes can stack on one group, up to each person's limit. Imported votes
  count one each, as they did in v1.
- v1's tasks are called actions. A task's date becomes the action's "by"
  date, and a completed task is a done action.

## Going back

Stop v2, then put the backup back as `thoughts.sqlite` and start v1:

```bash
mv data/thoughts.sqlite data/thoughts.v2.sqlite
cp data/thoughts.v1-backup-*.sqlite data/thoughts.sqlite
```

Anything done in v2 since the upgrade isn't in the backup.
