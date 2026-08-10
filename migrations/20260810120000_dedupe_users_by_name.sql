-- Logging in used to insert a fresh user row every time, so the same person
-- accumulated one identity per session and stopped owning their own notes.
-- Collapse the duplicates onto the earliest row for each name, then make the
-- name unique so it cannot happen again.

-- +goose Up
-- +goose StatementBegin
delete from votes
where rowid in (
    select rowid from (
        select
            v.rowid as rowid,
            row_number() over (
                partition by
                    v.retro_id,
                    v.group_id,
                    (
                        select m.id from users m
                        where m.name = (select o.name from users o where o.id = v.user_id)
                        order by m.created_at asc, m.id asc
                        limit 1
                    )
                order by v.rowid asc
            ) as rn
        from votes v
    )
    where rn > 1
);
-- +goose StatementEnd

-- +goose StatementBegin
update votes set user_id = (
    select m.id from users m
    where m.name = (select o.name from users o where o.id = votes.user_id)
    order by m.created_at asc, m.id asc
    limit 1
)
where exists (select 1 from users o where o.id = votes.user_id);
-- +goose StatementEnd

-- +goose StatementBegin
update notes set user_id = (
    select m.id from users m
    where m.name = (select o.name from users o where o.id = notes.user_id)
    order by m.created_at asc, m.id asc
    limit 1
)
where exists (select 1 from users o where o.id = notes.user_id);
-- +goose StatementEnd

-- +goose StatementBegin
delete from users
where id <> (
    select m.id from users m
    where m.name = users.name
    order by m.created_at asc, m.id asc
    limit 1
);
-- +goose StatementEnd

-- +goose StatementBegin
create unique index unique_user_name on users(name);
-- +goose StatementEnd

-- +goose Down
-- The collapsed duplicate identities cannot be restored; only the constraint
-- that prevents them coming back is reversible.
-- +goose StatementBegin
drop index if exists unique_user_name;
-- +goose StatementEnd
