package resources

import (
	"fmt"
	"reflect"
)

func StructToMap(s any) map[string]any {
	value := reflect.ValueOf(s)

	if value.Kind() == reflect.Pointer {
		value = value.Elem()
	}

	if value.Kind() != reflect.Struct {
		panic(fmt.Errorf("expected a struct, got %v", value.Kind()))
	}

	typ := value.Type()
	result := map[string]any{}

	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		fieldValue := value.Field(i)

		jsonKey := field.Tag.Get("json")
		if jsonKey != "" {
			result[jsonKey] = fieldValue.Interface()
		}
	}

	return result
}
