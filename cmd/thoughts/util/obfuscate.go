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

func Obfuscate(v string) string {
	var obfuscated strings.Builder

	for _, c := range v {
		obfuscated.WriteRune(obfuscateChar(c))
	}

	return obfuscated.String()
}

func obfuscateChar(c rune) rune {
	if slices.Contains(alphaLowerCharSet, c) {
		return alphaLowerCharSet[rand.Intn(len(alphaLowerCharSet)-1)]
	}

	if slices.Contains(alphaUpperCharSet, c) {
		return alphaUpperCharSet[rand.Intn(len(alphaUpperCharSet)-1)]
	}

	if slices.Contains(numCharSet, c) {
		return numCharSet[rand.Intn(len(numCharSet)-1)]
	}

	return c
}
