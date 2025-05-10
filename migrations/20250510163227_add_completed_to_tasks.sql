-- +goose Up
-- +goose StatementBegin
alter table tasks
add column completed boolean default false;

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
alter table tasks
drop column completed;

-- +goose StatementEnd
