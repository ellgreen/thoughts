-- +goose Up
-- +goose StatementBegin
create table notes (
  id text primary key,
  retro_id text not null,
  user_id text not null,
  column_id text not null,
  group_id text not null,
  content text not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  foreign key (retro_id) references retros(id),
  foreign key (user_id) references users(id)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table notes;
-- +goose StatementEnd
