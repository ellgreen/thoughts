package requests

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

var (
	ErrDecoding = errors.New("problem decoding request")

	validate = validator.New(validator.WithRequiredStructEnabled())
)

func validationMessage(validationErrors validator.ValidationErrors) string {
	fieldMessages := make([]string, 0, len(validationErrors))

	for _, err := range validationErrors {
		switch err.Tag() {
		case "required":
			fieldMessages = append(fieldMessages, fmt.Sprintf("%s is required", err.Field()))
		case "alpha":
			fieldMessages = append(fieldMessages, fmt.Sprintf("%s should only contain letters", err.Field()))
		case "min":
			typ := "values"
			if err.Kind() == reflect.String {
				typ = "characters"
			}

			fieldMessages = append(fieldMessages, fmt.Sprintf("%s should contain more than %s %s", err.Field(), err.Param(), typ))
		case "max":
			fieldMessages = append(fieldMessages, fmt.Sprintf("%s should be less than %s characters", err.Field(), err.Param()))
		case "uuid":
			fieldMessages = append(fieldMessages, fmt.Sprintf("%s is not a valid UUID", err.Field()))
		default:
			fieldMessages = append(fieldMessages, fmt.Sprintf("%s is invalid", err.Field()))
		}
	}

	return strings.Join(fieldMessages, ", ")
}

func decode(r io.Reader, v any) error {
	err := json.NewDecoder(r).Decode(v)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrDecoding, err)
	}

	return nil
}

func From[T any](w http.ResponseWriter, r *http.Request) (*T, bool) {
	var v *T
	if err := decode(r.Body, &v); err != nil {
		slog.Error("problem decoding request", "error", err)
		w.WriteHeader(http.StatusBadRequest)
		return nil, false
	}

	if err := validate.Struct(v); err != nil {
		http.Error(w, validationMessage(err.(validator.ValidationErrors)), http.StatusBadRequest)
		return nil, false
	}

	return v, true
}
