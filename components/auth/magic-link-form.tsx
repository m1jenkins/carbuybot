"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { normalizeEmail } from "@/lib/domain/engagement";
import { createBrowserClient } from "@/lib/supabase/browser";

type MagicLinkFormProps = {
  defaultEmail?: string;
};

export function MagicLinkForm({
  defaultEmail = "",
}: MagicLinkFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setIsSubmitting(true);

    try {
      const normalizedEmail = normalizeEmail(email);
      const redirectUrl =
        `${window.location.origin}/auth/callback?next=` +
        encodeURIComponent("/onboarding");
      const { error } = await createBrowserClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }

      setEmail(normalizedEmail);
      setMessage(`Check ${normalizedEmail} for your secure sign-in link.`);
    } catch {
      setIsError(true);
      setMessage(
        "We could not send the link. Check the email and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="form auth-form" onSubmit={handleSubmit}>
        <label>
          <span className="label">Email for your portal</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <button className="btn btn--light" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Email me a link"}
        </button>
      </form>
      <p
        className={`fstat${message && !isError ? " ok" : ""}${
          isError ? " err" : ""
        }`}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </>
  );
}
