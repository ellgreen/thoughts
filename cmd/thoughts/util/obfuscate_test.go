package util

import (
	"strings"
	"testing"
	"unicode"
)

func TestObfuscatePreservesShape(t *testing.T) {
	input := "Sprint 9 went well - mostly! (a few blockers)"
	got := Obfuscate(input)

	if len([]rune(got)) != len([]rune(input)) {
		t.Fatalf("length changed: %d -> %d", len([]rune(input)), len([]rune(got)))
	}

	for i, in := range []rune(input) {
		out := []rune(got)[i]

		switch {
		case unicode.IsLower(in) && in <= unicode.MaxASCII:
			if !unicode.IsLower(out) {
				t.Errorf("position %d: %q became %q, expected a lowercase letter", i, in, out)
			}
		case unicode.IsUpper(in) && in <= unicode.MaxASCII:
			if !unicode.IsUpper(out) {
				t.Errorf("position %d: %q became %q, expected an uppercase letter", i, in, out)
			}
		case unicode.IsDigit(in):
			if !unicode.IsDigit(out) {
				t.Errorf("position %d: %q became %q, expected a digit", i, in, out)
			}
		default:
			// Punctuation and spacing are left alone so the text keeps its rhythm.
			if out != in {
				t.Errorf("position %d: %q became %q, expected it to be left alone", i, in, out)
			}
		}
	}
}

func TestObfuscateCanEmitEveryCharacterInAClass(t *testing.T) {
	// A rand.Intn(len-1) off-by-one used to make the last rune of each class
	// unreachable, which is a subtle tell that text has been scrambled.
	cases := map[string]struct {
		input string
		want  rune
	}{
		"lowercase": {strings.Repeat("a", 400), 'z'},
		"uppercase": {strings.Repeat("A", 400), 'Z'},
		"digits":    {strings.Repeat("1", 400), '9'},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			if !strings.ContainsRune(Obfuscate(tc.input), tc.want) {
				t.Errorf("%q never appeared in 400 obfuscated runes", tc.want)
			}
		})
	}
}

func TestObfuscateHidesTheOriginal(t *testing.T) {
	input := "the quick brown fox jumps over the lazy dog and keeps on running"

	if Obfuscate(input) == input {
		t.Error("obfuscated text came back unchanged")
	}
}

func TestObfuscateHandlesEmptyInput(t *testing.T) {
	if got := Obfuscate(""); got != "" {
		t.Errorf("expected an empty string, got %q", got)
	}
}
