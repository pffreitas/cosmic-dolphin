package utils

import "context"

type User struct {
	ID    string
	Email string
}

type key int

const userContextKey key = iota

func SetUserInContext(ctx context.Context, user *User) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

func GetUserFromContext(ctx context.Context) *User {
	user, ok := ctx.Value(userContextKey).(*User)
	if !ok {
		return nil
	}
	return user
}
