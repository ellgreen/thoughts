package util

import (
	"math/rand"
	"slices"
	"strings"
)

var (
	numCharSet        = []rune("0123456789")
	alphaLowerCharSet = []rune("abcdefghijklmnopqrstuvwxyz")
	alphaUpperCharSet = []rune("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
)

// Obfuscate scrambles a string while preserving its length and the character
// class of each rune, so other people's notes read as noise of the right shape
// during the brainstorm stage.
func Obfuscate(v string) string {
	var obfuscated strings.Builder

	for _, c := range v {
		obfuscated.WriteRune(obfuscateChar(c))
	}

	return obfuscated.String()
}

func obfuscateChar(c rune) rune {
	if slices.Contains(alphaLowerCharSet, c) {
		return alphaLowerCharSet[rand.Intn(len(alphaLowerCharSet))]
	}

	if slices.Contains(alphaUpperCharSet, c) {
		return alphaUpperCharSet[rand.Intn(len(alphaUpperCharSet))]
	}

	if slices.Contains(numCharSet, c) {
		return numCharSet[rand.Intn(len(numCharSet))]
	}

	return c
}
