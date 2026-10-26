import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button, Form, Input, Label, Text, TextField } from "react-aria-components";
import { Wordmark } from "@/components/brand";
import { button, input } from "@/components/ui";
import { messageOf } from "@/lib/api";
import { meQuery, providersQuery, safeRedirect, signIn, type Provider } from "@/lib/session";

// Codes the server puts in ?failed= after a redirect sign-in. Only these
// words are ever shown, so a crafted link can't put its own text here.
const failures: Record<string, string> = {
  cancelled: "Sign-in was cancelled at the other end. Try again when you're ready.",
  group: "Your account isn't in the group that can use thoughts here. Ask whoever runs it to add you.",
  expired: "That sign-in took too long or was started in another browser. Try again.",
  failed: "Signing in didn't work this time. Try again, or ask whoever runs thoughts.",
};

// /login?redirect= is v1's URL, kept so old bookmarks and shared links land.
export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; failed?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    failed: typeof s.failed === "string" && s.failed in failures ? s.failed : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    if (await context.queryClient.ensureQueryData(meQuery)) throw redirect({ href: safeRedirect(search.redirect) });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(providersQuery),
  component: Login,
});

function Login() {
  const { data: providers } = useSuspenseQuery(providersQuery);
  const { redirect: to, failed } = Route.useSearch();
  const joining = safeRedirect(to).startsWith("/retros/");
  const several = providers.length > 1;
  const submitLabel = joining ? "Join the retro" : "Sign in";

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-wrap content-center items-center gap-x-16 gap-y-10 px-4 py-12 sm:px-6">
      <section className="min-w-0 flex-[1_1_440px]">
        <h1 className="m-0">
          <Wordmark size="lg" />
        </h1>
        <p className="mt-6 max-w-[30ch] text-[22px] leading-snug font-medium">Retros where everyone writes first and reads later.</p>
        <p className="mt-3 max-w-[44ch] text-ink-soft">
          {joining ? "Someone sent you a retro. Sign in and you'll go straight to it." : "Join a retro from the link someone sent you, or start your own."}
        </p>
      </section>
      <div className="flex min-w-[min(100%,280px)] flex-[0_1_400px] flex-col gap-4">
        {failed && (
          <p role="alert" className="bg-alert px-4 py-3 font-semibold">
            {failures[failed]}
          </p>
        )}
        {providers.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-4">
            {i > 0 && (
              <p className="flex items-center gap-3 font-semibold text-ink-soft" aria-hidden="true">
                <span className="h-[2.5px] flex-1 bg-ink-soft/40" />
                or
                <span className="h-[2.5px] flex-1 bg-ink-soft/40" />
              </p>
            )}
            {p.kind === "redirect" ? (
              <a href={`${p.startUrl}?${new URLSearchParams({ redirect: safeRedirect(to) })}`} className={`${button.solid} ${i === 0 ? "min-h-14 text-lg" : ""}`}>
                Sign in with {p.label}
              </a>
            ) : (
              <ProviderForm provider={p} heading={several ? p.label : null} tint={i === 0 ? "bg-pink-tint" : "bg-blue-tint"} submitLabel={submitLabel} />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function ProviderForm({ provider, heading, tint, submitLabel }: { provider: Provider; heading: string | null; tint: string; submitLabel: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { redirect: to } = Route.useSearch();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = provider.fields ?? [];
  const single = fields.length === 1;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setProblem(null);
    try {
      const me = await signIn(provider.id, values);
      queryClient.setQueryData(meQuery.queryKey, me);
      await navigate({ href: safeRedirect(to), replace: true });
    } catch (err) {
      setProblem(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form onSubmit={submit} className={`flex flex-col gap-4 p-6 sm:p-7 ${tint}`} aria-label={heading ? `Sign in with ${heading}` : undefined}>
      {heading && <h2 className="font-display text-2xl leading-tight">{heading}</h2>}
      {fields.map((f) => (
        <TextField
          key={f.name}
          name={f.name}
          type={f.type}
          autoComplete={f.autocomplete}
          isRequired
          isInvalid={!!problem}
          onChange={() => setProblem(null)}
          className="flex flex-col gap-2"
        >
          <Label className={single ? "font-display text-[28px] leading-tight" : "font-bold"}>{f.label}</Label>
          <Input className={input} />
          {f.help && (
            <Text slot="description" className="text-sm">
              {f.help}
            </Text>
          )}
        </TextField>
      ))}
      {problem && (
        <p role="alert" className="bg-alert px-3 py-2 text-sm font-semibold">
          {problem}
        </p>
      )}
      <Button type="submit" isDisabled={busy} className={button.solid}>
        {busy ? "Signing in…" : submitLabel}
      </Button>
    </Form>
  );
}
