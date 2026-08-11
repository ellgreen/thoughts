-- Reverses a migration on this branch that made users.name unique. Names are
-- labels, not accounts: two people called Alex need two rows.

-- +goose Up
-- +goose StatementBegin
drop index if exists unique_user_name;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
select 1;
-- +goose StatementEnd
