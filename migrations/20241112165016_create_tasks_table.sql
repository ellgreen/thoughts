-- +goose Up
-- +goose StatementBegin
create table tasks (
  id text primary key,
  retro_id text not null,
  who text not null,
  what text not null,
  "when" timestamp not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  foreign key (retro_id) references retros(id)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table tasks;
-- +goose StatementEnd
