package util

import (
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func UUIDFromRequest(r *http.Request, name string) (uuid.UUID, error) {
	return UUIDFromMap(mux.Vars(r), name)
}

func UUIDFromMap[T any](data map[string]T, name string) (uuid.UUID, error) {
	value, ok := data[name]
	if !ok {
		return uuid.Nil, fmt.Errorf("uuid with name %s does not exist", name)
	}

	strValue, ok := any(value).(string)
	if !ok {
		return uuid.Nil, fmt.Errorf("uuid with name %s is not a string", name)
	}

	id, err := uuid.Parse(strValue)
	if err != nil {
		return uuid.Nil, err
	}

	return id, nil
}
