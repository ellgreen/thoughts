-- +goose Up
-- +goose StatementBegin
create table reactions (
  id text primary key,
  retro_id text not null,
  note_id text not null,
  user_id text not null,
  emoji text not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  foreign key (retro_id) references retros(id),
  foreign key (note_id) references notes(id),
  foreign key (user_id) references users(id)
);

create unique index unique_reaction on reactions (note_id, user_id, emoji);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table reactions;
-- +goose StatementEnd
