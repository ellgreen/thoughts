package server

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/ellgreen/thoughts/internal/auth"
	"github.com/ellgreen/thoughts/internal/config"
)

// Runs the whole OIDC round trip through Dex from testdata/compose.yml in
// internal/auth: task test:auth-live
func TestLiveOIDC(t *testing.T) {
	if os.Getenv("THOUGHTS_AUTH_LIVE_TEST") == "" {
		t.Skip("set THOUGHTS_AUTH_LIVE_TEST=1 and run internal/auth/testdata/compose.yml")
	}
	for _, tt := range []struct {
		name, group, wantPath, wantName string
	}{
		{"signs in", "", "/retros/abc", "Kilgore Trout"},
		{"needs the group", "admins", "/login", ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			a := testApp(t)
			a.providers = []auth.Provider{auth.NewOIDC(config.OIDC{
				Issuer: "http://127.0.0.1:5556/dex", ClientID: "thoughts", ClientSecret: "thoughts-secret",
				Scopes: []string{"openid", "profile", "email", "groups"}, GroupsClaim: "groups", Group: tt.group,
			}, "http://127.0.0.1:3399")}

			// The port matches the redirect URI registered in dex.yml.
			ln, err := net.Listen("tcp", "127.0.0.1:3399")
			if err != nil {
				t.Fatal(err)
			}
			srv := &httptest.Server{Listener: ln, Config: &http.Server{Handler: a.handler()}}
			srv.Start()
			defer srv.Close()

			jar, _ := cookiejar.New(nil)
			client := &http.Client{Jar: jar}
			res, err := client.Get(srv.URL + "/api/auth/oidc/start?redirect=/retros/abc")
			if err != nil {
				t.Fatal(err)
			}
			res.Body.Close()
			if res.Request.URL.Path != tt.wantPath {
				t.Fatalf("ended at %s", res.Request.URL)
			}
			if tt.wantName == "" {
				if got := res.Request.URL.Query().Get("failed"); got != auth.FailGroup {
					t.Fatalf("failed = %q", got)
				}
				return
			}
			me, err := client.Get(srv.URL + "/api/me")
			if err != nil {
				t.Fatal(err)
			}
			defer me.Body.Close()
			var body meResource
			_ = json.NewDecoder(me.Body).Decode(&body)
			if !strings.Contains(body.User.Name, tt.wantName) {
				t.Fatalf("me = %+v", body)
			}
		})
	}
}
