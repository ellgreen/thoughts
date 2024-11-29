//go:build bundled
// +build bundled

package ui

import "embed"

//go:embed dist/*
var embeddedDist embed.FS

func init() {
	dist = embeddedDist
}
