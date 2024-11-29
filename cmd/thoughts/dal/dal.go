package dal

import "errors"

var (
	ErrExecution    = errors.New("dal: execution error")
	ErrLastInsertID = errors.New("dal: unable to get last insert id")
)
