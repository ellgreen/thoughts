-- +goose Up
-- +goose StatementBegin
alter table retros add column unlisted boolean default false;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
alter table retros drop column unlisted;
-- +goose StatementEnd
