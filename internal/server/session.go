package server

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode"

	"github.com/ellgreen/thoughts/internal/auth"
	"github.com/ellgreen/thoughts/internal/store"
	"github.com/ellgreen/thoughts/internal/v1import"
)

// sessionCookie differs from v1's "session" so the two can sit side by side
// while a v1 cookie is swapped for a v2 one.
const sessionCookie = "thoughts_session"

type userResource struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type meResource struct {
	User     userResource     `json:"user"`
	Features featuresResource `json:"features"`
}

type featuresResource struct {
	GIFSearch bool `json:"gifSearch"`
	AI        bool `json:"ai"`
}

type providerResource struct {
	ID       string       `json:"id"`
	Label    string       `json:"label"`
	Kind     string       `json:"kind"`
	Fields   []auth.Field `json:"fields,omitempty"`
	StartURL string       `json:"startUrl,omitempty"`
}

const flowCookie = "thoughts_signin_state"

func (a *app) listProviders(w http.ResponseWriter, _ *http.Request) {
	out := make([]providerResource, 0, len(a.providers))
	for _, p := range a.providers {
		res := providerResource{ID: p.ID(), Label: p.Label()}
		switch p := p.(type) {
		case auth.Form:
			res.Kind, res.Fields = "form", p.Fields()
		case auth.Redirect:
			res.Kind, res.StartURL = "redirect", "/api/auth/"+p.ID()+"/start"
		}
		out = append(out, res)
	}
	writeJSON(w, http.StatusOK, map[string]any{"providers": out})
}

func provider[T auth.Provider](a *app, id string) (T, bool) {
	for _, p := range a.providers {
		if t, ok := p.(T); ok && p.ID() == id {
			return t, true
		}
	}
	var zero T
	return zero, false
}

// localPath keeps a return address on this site, so a crafted link can't
// bounce someone elsewhere after they sign in. Browsers drop tabs and
// newlines from a Location and read a backslash as a slash, so "/\t/x.com"
// would go to x.com.
func localPath(p string) string {
	if !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") ||
		strings.ContainsFunc(p, func(r rune) bool { return r == '\\' || unicode.IsControl(r) }) {
		return "/"
	}
	return p
}

func (a *app) startRedirect(w http.ResponseWriter, r *http.Request) {
	p, ok := provider[auth.Redirect](a, r.PathValue("provider"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	returnTo := localPath(r.URL.Query().Get("redirect"))
	authURL, state, err := p.Start(r.Context(), returnTo)
	if err != nil {
		slog.WarnContext(r.Context(), "starting sign-in", "provider", p.ID(), "err", err)
		http.Redirect(w, r, failedSignIn(err, returnTo), http.StatusSeeOther)
		return
	}
	http.SetCookie(w, a.cookie(r, flowCookie, state, 10*time.Minute))
	http.Redirect(w, r, authURL, http.StatusSeeOther)
}

func (a *app) finishRedirect(w http.ResponseWriter, r *http.Request) {
	p, ok := provider[auth.Redirect](a, r.PathValue("provider"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	var state string
	if c, err := r.Cookie(flowCookie); err == nil {
		state = c.Value
	}
	http.SetCookie(w, a.cookie(r, flowCookie, "", -1))
	id, returnTo, err := p.Finish(r.Context(), state, r.URL.Query())
	returnTo = localPath(returnTo)
	if err != nil {
		slog.WarnContext(r.Context(), "finishing sign-in", "provider", p.ID(), "err", err)
		http.Redirect(w, r, failedSignIn(err, returnTo), http.StatusSeeOther)
		return
	}
	u, err := a.store.SignIn(r.Context(), id)
	if err != nil {
		fail(w, r, err)
		return
	}
	token, err := a.store.CreateSession(r.Context(), u.ID)
	if err != nil {
		fail(w, r, err)
		return
	}
	http.SetCookie(w, a.cookie(r, sessionCookie, token, store.SessionLifetime))
	http.Redirect(w, r, returnTo, http.StatusSeeOther)
}

func failedSignIn(err error, returnTo string) string {
	code := auth.FailBroken
	var f *auth.Failure
	if errors.As(err, &f) {
		code = f.Code
	}
	q := url.Values{"failed": {code}}
	if returnTo != "/" {
		q.Set("redirect", returnTo)
	}
	return "/login?" + q.Encode()
}

func (a *app) signIn(w http.ResponseWriter, r *http.Request) {
	p, ok := provider[auth.Form](a, r.PathValue("provider"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	var values map[string]string
	if !readJSON(w, r, &values) {
		return
	}
	id, err := p.Authenticate(r.Context(), values)
	var problem auth.Problem
	if errors.As(err, &problem) {
		writeError(w, http.StatusBadRequest, problem.Error())
		return
	}
	if err != nil {
		fail(w, r, err)
		return
	}
	u, err := a.store.SignIn(r.Context(), id)
	if err != nil {
		fail(w, r, err)
		return
	}
	token, err := a.store.CreateSession(r.Context(), u.ID)
	if err != nil {
		fail(w, r, err)
		return
	}
	http.SetCookie(w, a.cookie(r, sessionCookie, token, store.SessionLifetime))
	writeJSON(w, http.StatusOK, a.meFor(u))
}

func (a *app) meFor(u store.User) meResource {
	return meResource{User: userResource{ID: u.ID, Name: u.Name}, Features: featuresResource{GIFSearch: a.gifs != nil, AI: a.ai != nil}}
}

func (a *app) signOut(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		if err := a.store.DeleteSession(r.Context(), c.Value); err != nil {
			fail(w, r, err)
			return
		}
	}
	http.SetCookie(w, a.cookie(r, sessionCookie, "", -1))
	w.WriteHeader(http.StatusNoContent)
}

func (a *app) me(w http.ResponseWriter, _ *http.Request, u store.User) {
	writeJSON(w, http.StatusOK, a.meFor(u))
}

// cookie is Secure only over HTTPS, like v1, so an install on a plain-HTTP
// network address still signs people in.
func (a *app) cookie(r *http.Request, name, value string, lifetime time.Duration) *http.Cookie {
	maxAge := int(lifetime / time.Second)
	if lifetime < 0 {
		maxAge = -1
	}
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   a.tls || r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"),
		SameSite: http.SameSiteLaxMode,
	}
}

func (a *app) requireUser(next func(http.ResponseWriter, *http.Request, store.User)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, err := a.currentUser(w, r)
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "Sign in to see this.")
			return
		}
		if err != nil {
			fail(w, r, err)
			return
		}
		next(w, r, u)
	})
}

func (a *app) currentUser(w http.ResponseWriter, r *http.Request) (store.User, error) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		u, err := a.store.UserBySession(r.Context(), c.Value)
		if !errors.Is(err, store.ErrNotFound) {
			return u, err
		}
		http.SetCookie(w, a.cookie(r, sessionCookie, "", -1))
	}
	return a.adoptV1Session(w, r)
}

// adoptV1Session swaps a cookie v1 issued for a v2 session as the same
// person, so an upgrade doesn't sign everyone out and lose "my notes".
func (a *app) adoptV1Session(w http.ResponseWriter, r *http.Request) (store.User, error) {
	c, err := r.Cookie(v1import.V1Cookie)
	if err != nil {
		return store.User{}, store.ErrNotFound
	}
	id, ok := a.v1.UserID(c.Value)
	if !ok {
		return store.User{}, store.ErrNotFound
	}
	u, err := a.store.UserByID(r.Context(), id)
	if err != nil {
		return u, err
	}
	token, err := a.store.CreateSession(r.Context(), u.ID)
	if err != nil {
		return u, err
	}
	http.SetCookie(w, a.cookie(r, sessionCookie, token, store.SessionLifetime))
	http.SetCookie(w, a.cookie(r, v1import.V1Cookie, "", -1))
	return u, nil
}
