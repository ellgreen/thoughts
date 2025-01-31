-- +goose Up
-- +goose StatementBegin
alter table notes
add column img_url string;

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
alter table notes
drop column img_url;

-- +goose StatementEnd
