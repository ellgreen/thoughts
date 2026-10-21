package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"

	"github.com/ellgreen/thoughts/internal/config"
)

// fakeIssuer is a minimal OpenID provider: discovery, keys, and a token
// endpoint that checks the PKCE verifier and signs an ID token.
type fakeIssuer struct {
	*httptest.Server
	key    *rsa.PrivateKey
	mu     sync.Mutex
	codes  map[string]grant
	claims map[string]any
}

type grant struct{ challenge, nonce string }

func newFakeIssuer(t *testing.T) *fakeIssuer {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeIssuer{key: key, codes: map[string]grant{}, claims: map[string]any{"name": "Priya Shah", "groups": []string{"retro-people"}}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issuer": f.URL, "authorization_endpoint": f.URL + "/authorize", "token_endpoint": f.URL + "/token",
			"jwks_uri": f.URL + "/keys", "id_token_signing_alg_values_supported": []string{"RS256"},
		})
	})
	mux.HandleFunc("GET /keys", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "k", Algorithm: "RS256", Use: "sig"}}})
	})
	mux.HandleFunc("POST /token", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		f.mu.Lock()
		g, ok := f.codes[r.Form.Get("code")]
		delete(f.codes, r.Form.Get("code"))
		claims := map[string]any{}
		for k, v := range f.claims {
			claims[k] = v
		}
		f.mu.Unlock()
		sum := sha256.Sum256([]byte(r.Form.Get("code_verifier")))
		if !ok || base64.RawURLEncoding.EncodeToString(sum[:]) != g.challenge {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
			return
		}
		now := time.Now()
		claims["iss"], claims["aud"], claims["sub"] = f.URL, "thoughts", "user-123"
		claims["iat"], claims["exp"], claims["nonce"] = now.Unix(), now.Add(time.Hour).Unix(), g.nonce
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "a", "token_type": "Bearer", "id_token": f.sign(t, claims)})
	})
	f.Server = httptest.NewServer(mux)
	t.Cleanup(f.Close)
	return f
}

func (f *fakeIssuer) sign(t *testing.T, claims map[string]any) string {
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: f.key}, (&jose.SignerOptions{}).WithHeader("kid", "k"))
	if err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(claims)
	jws, err := signer.Sign(body)
	if err != nil {
		t.Fatal(err)
	}
	out, _ := jws.CompactSerialize()
	return out
}

// authorize stands in for the person signing in at the provider: it reads
// the request thoughts made and answers with a code for it.
func (f *fakeIssuer) authorize(t *testing.T, authURL string) url.Values {
	t.Helper()
	u, err := url.Parse(authURL)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	if q.Get("code_challenge_method") != "S256" || q.Get("redirect_uri") != "https://thoughts.example.com/api/auth/oidc/callback" {
		t.Fatalf("authorize request = %v", q)
	}
	code := rand.Text()
	f.mu.Lock()
	f.codes[code] = grant{challenge: q.Get("code_challenge"), nonce: q.Get("nonce")}
	f.mu.Unlock()
	return url.Values{"code": {code}, "state": {q.Get("state")}}
}

func newTestOIDC(f *fakeIssuer, group string) *OIDC {
	return NewOIDC(config.OIDC{Issuer: f.URL, ClientID: "thoughts", Scopes: []string{"openid"}, GroupsClaim: "groups", Group: group}, "https://thoughts.example.com")
}

func failure(err error) string {
	var f *Failure
	if errors.As(err, &f) {
		return f.Code
	}
	return ""
}

func TestOIDCSignsIn(t *testing.T) {
	f := newFakeIssuer(t)
	o := newTestOIDC(f, "retro-people")
	ctx := context.Background()
	authURL, state, err := o.Start(ctx, "/retros/abc")
	if err != nil {
		t.Fatal(err)
	}
	id, returnTo, err := o.Finish(ctx, state, f.authorize(t, authURL))
	if err != nil {
		t.Fatal(err)
	}
	if id.Provider != "oidc" || id.Subject != "user-123" || id.Name != "Priya Shah" || returnTo != "/retros/abc" {
		t.Fatalf("%+v %q", id, returnTo)
	}
}

func TestOIDCRefusals(t *testing.T) {
	ctx := context.Background()
	f := newFakeIssuer(t)

	t.Run("another browser's state", func(t *testing.T) {
		o := newTestOIDC(f, "")
		authURL, _, _ := o.Start(ctx, "/")
		_, _, err := o.Finish(ctx, "someone-elses", f.authorize(t, authURL))
		if failure(err) != FailExpired {
			t.Fatalf("err = %v", err)
		}
	})
	t.Run("a state used twice", func(t *testing.T) {
		o := newTestOIDC(f, "")
		authURL, state, _ := o.Start(ctx, "/")
		q := f.authorize(t, authURL)
		if _, _, err := o.Finish(ctx, state, q); err != nil {
			t.Fatal(err)
		}
		if _, _, err := o.Finish(ctx, state, q); failure(err) != FailExpired {
			t.Fatalf("replay: %v", err)
		}
	})
	t.Run("an old sign-in", func(t *testing.T) {
		o := newTestOIDC(f, "")
		authURL, state, _ := o.Start(ctx, "/")
		o.now = func() time.Time { return time.Now().Add(flowLifetime + time.Minute) }
		if _, _, err := o.Finish(ctx, state, f.authorize(t, authURL)); failure(err) != FailExpired {
			t.Fatalf("err = %v", err)
		}
	})
	t.Run("the person said no", func(t *testing.T) {
		o := newTestOIDC(f, "")
		_, state, _ := o.Start(ctx, "/retros/abc")
		_, returnTo, err := o.Finish(ctx, state, url.Values{"state": {state}, "error": {"access_denied"}})
		if failure(err) != FailCancelled || returnTo != "/retros/abc" {
			t.Fatalf("err = %v, returnTo = %q", err, returnTo)
		}
	})
	t.Run("not in the group", func(t *testing.T) {
		o := newTestOIDC(f, "admins")
		authURL, state, _ := o.Start(ctx, "/")
		if _, _, err := o.Finish(ctx, state, f.authorize(t, authURL)); failure(err) != FailGroup {
			t.Fatalf("err = %v", err)
		}
	})
	t.Run("a code without its verifier", func(t *testing.T) {
		o := newTestOIDC(f, "")
		authURL, state, _ := o.Start(ctx, "/")
		q := f.authorize(t, authURL)
		f.mu.Lock()
		g := f.codes[q.Get("code")]
		g.challenge = "something-else"
		f.codes[q.Get("code")] = g
		f.mu.Unlock()
		if _, _, err := o.Finish(ctx, state, q); failure(err) != FailBroken {
			t.Fatalf("err = %v", err)
		}
	})
}

func TestOIDCStartsWhileTheProviderIsDown(t *testing.T) {
	o := NewOIDC(config.OIDC{Issuer: "http://127.0.0.1:1", ClientID: "thoughts"}, "https://thoughts.example.com")
	if _, _, err := o.Start(context.Background(), "/"); failure(err) != FailBroken {
		t.Fatalf("err = %v", err)
	}
}
