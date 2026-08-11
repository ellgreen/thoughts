import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { FieldValues, useForm } from "react-hook-form";
import { z } from "zod";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(2).max(32),
});

function LoginForm() {
  const { isAuthenticated, login } = useAuth();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
    },
  });

  async function handleSubmit(data: FieldValues) {
    try {
      await login(data.name);
    } catch {
      // Anything the server rejected outright, so it lands on the field the
      // person can actually do something about rather than vanishing.
      form.setError("name", {
        message: "We couldn't sign you in. Please try again.",
      });
    }
  }

  // Driven by the verified session, not by a cached name: landing here with a
  // stale cache used to bounce straight back into the app and 401.
  useEffect(() => {
    if (!isAuthenticated) return;

    navigate({ to: search.redirect || "/" });
  }, [isAuthenticated, navigate, search.redirect]);

  return (
    <Card className="w-full mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          Please enter your name to continue using thoughts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>

                  <FormControl>
                    <Input {...field} />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="mt-4 w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Signing in…" : "Enter"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
