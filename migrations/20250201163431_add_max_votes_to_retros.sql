-- +goose Up
-- +goose StatementBegin
alter table retros
add column max_votes int default 5;

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
alter table retros
drop column max_votes;

-- +goose StatementEnd
