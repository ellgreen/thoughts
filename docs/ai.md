# AI suggestions

Optional. With a driver configured, thoughts can:

- **make columns for a theme** when you start a retro ("a heist film",
  "Formula 1"), which is v1's AI template feature;
- **suggest groups** for the notes, with a name for each, while grouping;
- **name the groups** people made by hand;
- **draft actions** from the most-voted groups while discussing, only where the notes call for one;
- **write a recap** of the retro, shown in Discuss and included in the
  Markdown export.

Everything except the recap is a suggestion: it appears to everyone in the
retro and changes nothing until someone applies it. Anyone can apply or
dismiss each item in it, or all of them at once.

## What the model sees

Note text, column names and vote counts. Never who wrote a note, and nothing
at all from a retro that is still reflecting, when notes are hidden even from
the people in the room.

## Drivers

`THOUGHTS_AI_DRIVER` picks one. Every driver asks for JSON that matches a
schema, and thoughts checks the answer again before using it: a suggestion
can't refer to a note or group that doesn't exist.

| Driver | Settings | Default model |
|---|---|---|
| `anthropic` | `THOUGHTS_AI_API_KEY` | `claude-opus-5-5` |
| `openai` | `THOUGHTS_AI_API_KEY` | `gpt-5-mini` |
| `openai-compatible` | `THOUGHTS_AI_BASE_URL`, `THOUGHTS_AI_MODEL`, and `THOUGHTS_AI_API_KEY` if the server wants one | none: set it |
| `copilot` | see below | Copilot's default |

`THOUGHTS_AI_MODEL` overrides the default for any driver.

v1's `THOUGHTS_OPENAI_API_KEY` still works on its own: it turns on the
`openai` driver with that key.

**Anthropic** requests use structured outputs and opt into server-side
fallbacks, so a request one model declines can be answered by another in the
same call instead of failing.

**OpenAI-compatible** covers Ollama, vLLM, LiteLLM and similar. The model
must support JSON-schema output (`response_format: json_schema`). For
Ollama: `THOUGHTS_AI_BASE_URL=http://localhost:11434/v1`.

### GitHub Copilot

The Copilot driver uses the GitHub Copilot SDK, which talks to a Copilot CLI
process. It refuses every tool the Copilot agent asks for, so all it can do
is answer with text.

- **On the same machine:** install the Copilot CLI and sign in, and thoughts
  finds `copilot` on its PATH (or `COPILOT_CLI_PATH`).
- **With Docker:** the CLI is about 170 MB, more than ten times the thoughts
  image, so it isn't bundled. Run it next to thoughts in server mode and
  point thoughts at it:

  ```bash
  copilot --headless --port 4321
  THOUGHTS_AI_DRIVER=copilot THOUGHTS_COPILOT_URL=copilot-host:4321
  ```

- `THOUGHTS_COPILOT_TOKEN` signs in with a GitHub token (`gho_`, `ghu_` or
  `github_pat_`; classic `ghp_` tokens don't work) instead of the CLI's own
  sign-in. Requests count against that account's Copilot plan.

## Checking a driver

```bash
THOUGHTS_AI_LIVE_TEST=1 THOUGHTS_AI_DRIVER=anthropic THOUGHTS_AI_API_KEY=... go test -run Live ./internal/ai/
```

It makes five small requests (a template, a grouping, two sets of actions and
a recap) and spends a little of the provider's quota.
