package requests

import (
	"errors"
	"fmt"
	"reflect"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

func FromMap[T any](data map[string]any) (*T, error) {
	var request T

	requestValue := reflect.ValueOf(&request).Elem()
	requestType := requestValue.Type()

	for i := range requestValue.NumField() {
		requestField := requestType.Field(i)
		jsonTag := requestField.Tag.Get("json")
		if jsonTag == "" {
			continue
		}

		mapValue, ok := data[jsonTag]
		if !ok {
			continue
		}

		mapValueType := reflect.TypeOf(mapValue)
		requestFieldType := requestField.Type

		if requestFieldType == mapValueType {
			requestValue.Field(i).Set(reflect.ValueOf(mapValue))
			continue
		}

		if requestFieldType == reflect.TypeOf(uuid.UUID{}) {
			mapStrValue, ok := mapValue.(string)
			if !ok {
				return nil, errors.New("invalid uuid - not a string")
			}

			uuidValue := uuid.Nil
			if mapStrValue != "" {
				var err error
				uuidValue, err = uuid.Parse(mapValue.(string))
				if err != nil {
					return nil, errors.New("invalid uuid - could not parse")
				}
			}

			requestValue.Field(i).Set(reflect.ValueOf(uuidValue))
			continue
		}

		return nil, fmt.Errorf("invalid type in request: %v", requestField.Type)
	}

	if err := validate.Struct(request); err != nil {
		return nil, errors.New(validationMessage(err.(validator.ValidationErrors)))
	}

	return &request, nil
}