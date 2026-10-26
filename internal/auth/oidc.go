package auth

import (
	"cmp"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"

	"github.com/ellgreen/thoughts/internal/config"
	"github.com/ellgreen/thoughts/internal/store"
)

const (
	flowLifetime = 10 * time.Minute
	maxFlows     = 1000
)

// Failure codes go in the /login URL after a redirect sign-in fails. The
// sign-in page maps them to words, so a crafted link can't put text there.
const (
	FailCancelled = "cancelled"
	FailGroup     = "group"
	FailExpired   = "expired"
	FailBroken    = "failed"
)

type Failure struct {
	Code string
	Err  error
}

func (f *Failure) Error() string { return fmt.Sprintf("%s: %v", f.Code, f.Err) }

func fail(code string, err error) error { return &Failure{Code: code, Err: err} }

// OIDC signs people in with an OpenID Connect provider using the
// authorization code flow with PKCE.
type OIDC struct {
	cfg      config.OIDC
	redirect string
	now      func() time.Time

	mu       sync.Mutex
	provider *oidc.Provider
	flows    map[string]flow
}

type flow struct {
	verifier string
	nonce    string
	returnTo string
	expires  time.Time
}

func NewOIDC(cfg config.OIDC, publicURL string) *OIDC {
	return &OIDC{cfg: cfg, redirect: publicURL + "/api/auth/oidc/callback", now: time.Now, flows: map[string]flow{}}
}

func (o *OIDC) ID() string    { return "oidc" }
func (o *OIDC) Label() string { return o.cfg.Label }

// discover fetches the provider's configuration on first use rather than at
// startup, so thoughts still starts while the provider is down.
func (o *OIDC) discover(ctx context.Context) (*oidc.Provider, error) {
	o.mu.Lock()
	p := o.provider
	o.mu.Unlock()
	if p != nil {
		return p, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	p, err := oidc.NewProvider(ctx, o.cfg.Issuer)
	if err != nil {
		return nil, err
	}
	o.mu.Lock()
	o.provider = p
	o.mu.Unlock()
	return p, nil
}

func (o *OIDC) oauth(p *oidc.Provider) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     o.cfg.ClientID,
		ClientSecret: o.cfg.ClientSecret,
		Endpoint:     p.Endpoint(),
		RedirectURL:  o.redirect,
		Scopes:       o.cfg.Scopes,
	}
}

// Start returns where to send the browser, and the state to keep in a
// cookie so the callback can tell it's the same browser.
func (o *OIDC) Start(ctx context.Context, returnTo string) (authURL, state string, err error) {
	p, err := o.discover(ctx)
	if err != nil {
		return "", "", fail(FailBroken, fmt.Errorf("discovery: %w", err))
	}
	state, nonce, verifier := rand.Text(), rand.Text(), oauth2.GenerateVerifier()
	now := o.now()

	o.mu.Lock()
	for k, f := range o.flows {
		if now.After(f.expires) {
			delete(o.flows, k)
		}
	}
	if len(o.flows) >= maxFlows {
		o.mu.Unlock()
		return "", "", fail(FailBroken, errors.New("too many sign-ins in progress"))
	}
	o.flows[state] = flow{verifier: verifier, nonce: nonce, returnTo: returnTo, expires: now.Add(flowLifetime)}
	o.mu.Unlock()

	return o.oauth(p).AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier)), state, nil
}

// Finish checks the provider's answer and returns who signed in and where
// they were going.
func (o *OIDC) Finish(ctx context.Context, cookieState string, q url.Values) (store.Identity, string, error) {
	state := q.Get("state")
	o.mu.Lock()
	f, ok := o.flows[state]
	delete(o.flows, state)
	o.mu.Unlock()

	if q.Get("error") != "" {
		return store.Identity{}, f.returnTo, fail(FailCancelled, fmt.Errorf("provider said %s: %s", q.Get("error"), q.Get("error_description")))
	}
	if !ok || state == "" || state != cookieState || o.now().After(f.expires) {
		return store.Identity{}, "", fail(FailExpired, errors.New("unknown, mismatched or expired state"))
	}

	p, err := o.discover(ctx)
	if err != nil {
		return store.Identity{}, f.returnTo, fail(FailBroken, err)
	}
	tok, err := o.oauth(p).Exchange(ctx, q.Get("code"), oauth2.VerifierOption(f.verifier))
	if err != nil {
		return store.Identity{}, f.returnTo, fail(FailBroken, fmt.Errorf("exchanging the code: %w", err))
	}
	raw, _ := tok.Extra("id_token").(string)
	if raw == "" {
		return store.Identity{}, f.returnTo, fail(FailBroken, errors.New("no id_token in the token response"))
	}
	idToken, err := p.Verifier(&oidc.Config{ClientID: o.cfg.ClientID, Now: o.now}).Verify(ctx, raw)
	if err != nil {
		return store.Identity{}, f.returnTo, fail(FailBroken, fmt.Errorf("verifying the id token: %w", err))
	}
	if idToken.Nonce != f.nonce {
		return store.Identity{}, f.returnTo, fail(FailBroken, errors.New("nonce mismatch"))
	}

	var claims map[string]any
	if err := idToken.Claims(&claims); err != nil {
		return store.Identity{}, f.returnTo, fail(FailBroken, err)
	}
	if o.cfg.Group != "" && !slices.Contains(stringsIn(claims[o.cfg.GroupsClaim]), o.cfg.Group) {
		return store.Identity{}, f.returnTo, fail(FailGroup, fmt.Errorf("%q not in %q claim", o.cfg.Group, o.cfg.GroupsClaim))
	}
	name := cmp.Or(str(claims["name"]), str(claims["preferred_username"]), str(claims["email"]), "Someone")
	return store.Identity{Provider: "oidc", Subject: idToken.Subject, Name: name}, f.returnTo, nil
}

func str(v any) string {
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

// stringsIn reads a claim that providers send as a list, or as one string.
func stringsIn(v any) []string {
	switch v := v.(type) {
	case string:
		return []string{v}
	case []any:
		out := make([]string, 0, len(v))
		for _, x := range v {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}
