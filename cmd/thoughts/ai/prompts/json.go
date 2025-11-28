package prompts

import (
	"encoding/json"
	"fmt"
	"strings"
)

func parseJSON[T any](data string) (T, error) {
	var result T
	if err := json.NewDecoder(strings.NewReader(data)).Decode(&result); err != nil {
		return result, fmt.Errorf("ai: failed to parse json response: %w", err)
	}

	return result, nil
}
