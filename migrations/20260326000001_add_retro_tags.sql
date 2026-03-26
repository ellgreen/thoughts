-- +goose Up
-- +goose StatementBegin
create table retro_tags (
    retro_id text not null references retros(id) on delete cascade,
    tag      text not null,
    primary key (retro_id, tag)
);
-- +goose StatementEnd
-- +goose StatementBegin
create index idx_retro_tags_tag on retro_tags(tag);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop index if exists idx_retro_tags_tag;
-- +goose StatementEnd
-- +goose StatementBegin
drop table if exists retro_tags;
-- +goose StatementEnd
