-- +goose Up
-- +goose StatementBegin
create table retros (
  id text primary key,
  status text not null,
  title text not null,
  columns text not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table retros;
-- +goose StatementEnd
