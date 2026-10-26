package ai

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sync"

	copilot "github.com/github/copilot-sdk/go"
	"github.com/github/copilot-sdk/go/rpc"

	"github.com/ellgreen/thoughts/internal/config"
)

// copilotDriver runs requests through the GitHub Copilot SDK, which talks
// to a Copilot CLI: one on PATH (or COPILOT_CLI_PATH), or one already
// running in server mode at THOUGHTS_COPILOT_URL.
type copilotDriver struct {
	cfg config.AI

	mu     sync.Mutex
	client *copilot.Client
}

func newCopilot(cfg config.AI) *copilotDriver { return &copilotDriver{cfg: cfg} }

func (d *copilotDriver) Name() string { return "copilot" }

func (d *copilotDriver) start(ctx context.Context) (*copilot.Client, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.client != nil {
		return d.client, nil
	}
	opts := &copilot.ClientOptions{LogLevel: "error"}
	if d.cfg.CopilotToken != "" {
		no := false
		opts.GitHubToken, opts.UseLoggedInUser = d.cfg.CopilotToken, &no
	}
	switch {
	case d.cfg.CopilotURL != "":
		opts.Connection = copilot.URIConnection{URL: d.cfg.CopilotURL}
	case os.Getenv("COPILOT_CLI_PATH") == "":
		// The SDK only looks at COPILOT_CLI_PATH and its own bundle; a CLI
		// installed the usual way is on PATH.
		if path, err := exec.LookPath("copilot"); err == nil {
			opts.Connection = copilot.StdioConnection{Path: path}
		}
	}
	c := copilot.NewClient(opts)
	if err := c.Start(ctx); err != nil {
		return nil, fmt.Errorf("starting the Copilot CLI: %w", err)
	}
	d.client = c
	return c, nil
}

// deny refuses every tool the Copilot agent asks to use: thoughts only
// wants text back, never file, shell or web access on the server.
func deny(copilot.PermissionRequest, copilot.PermissionInvocation) (rpc.PermissionDecision, error) {
	return &rpc.PermissionDecisionDeniedByRules{}, nil
}

func (d *copilotDriver) Complete(ctx context.Context, r Request) ([]byte, error) {
	c, err := d.start(ctx)
	if err != nil {
		return nil, err
	}
	session, err := c.CreateSession(ctx, &copilot.SessionConfig{
		Model:               d.cfg.Model,
		SystemMessage:       &copilot.SystemMessageConfig{Mode: "replace", Content: r.System},
		OnPermissionRequest: deny,
	})
	if err != nil {
		return nil, fmt.Errorf("copilot %s: %w", r.Name, err)
	}
	defer func() { _ = session.Disconnect() }()

	event, err := session.SendAndWait(ctx, copilot.MessageOptions{Prompt: r.Prompt, ResponseSchema: r.Schema})
	if err != nil {
		return nil, fmt.Errorf("copilot %s: %w", r.Name, err)
	}
	msg, ok := event.Data.(*copilot.AssistantMessageData)
	if !ok || msg.Content == "" {
		return nil, errors.New("copilot: no answer")
	}
	return []byte(msg.Content), nil
}
