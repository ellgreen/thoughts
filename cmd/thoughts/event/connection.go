package event

func NewConnectionInfoEvent(users []string) *Event {
	return &Event{
		Name: "connection_info",
		Payload: Payload{
			"users": users,
		},
	}
}
