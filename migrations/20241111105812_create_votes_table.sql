-- +goose Up
-- +goose StatementBegin
create table votes (
  id text primary key,
  retro_id text not null,
  user_id text not null,
  group_id text not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  foreign key (retro_id) references retros(id),
  foreign key (user_id) references users(id)
);

create unique index unique_vote on votes (retro_id, user_id, group_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table votes;
-- +goose StatementEnd
