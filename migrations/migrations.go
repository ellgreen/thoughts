package migrations

import "embed"

//go:embed *.sql
var Embedded embed.FS
