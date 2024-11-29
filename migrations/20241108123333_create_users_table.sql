-- +goose Up
-- +goose StatementBegin
create table users (
  id text primary key,
  name text not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table users;
-- +goose StatementEnd
