"use client";

import { useState } from "react";
import { GoogleLogo, GithubLogo, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";

type Provider = "google" | "github";

type SignInButtonsProps = {
  redirectTo?: string;
};

export function SignInButtons({ redirectTo }: SignInButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callbackURL = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/post-auth";

  async function handleSignIn(provider: Provider) {
    setPending(provider);
    setError(null);
    try {
      await signIn.social({
        provider,
        callbackURL,
        errorCallbackURL: "/sign-in/error",
      });
    } catch {
      setError("No pudimos iniciar sesión. Inténtalo de nuevo.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending !== null}
        onClick={() => handleSignIn("google")}
      >
        {pending === "google" ? (
          <SpinnerGap className="animate-spin" weight="bold" />
        ) : (
          <GoogleLogo weight="bold" />
        )}
        Continuar con Google
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending !== null}
        onClick={() => handleSignIn("github")}
      >
        {pending === "github" ? (
          <SpinnerGap className="animate-spin" weight="bold" />
        ) : (
          <GithubLogo weight="bold" />
        )}
        Continuar con GitHub
      </Button>

      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
