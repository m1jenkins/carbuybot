"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import {
  isStripeCheckoutUrl,
  navigateToCheckout,
} from "./checkout-navigation";

type CheckoutFormProps = {
  defaultEmail?: string;
};

type CheckoutResponse = {
  error?: string;
  url?: string;
};

export function CheckoutForm({ defaultEmail = "" }: CheckoutFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as CheckoutResponse;

      if (!response.ok) {
        throw new Error(result.error || "Unable to start checkout.");
      }
      if (!result.url || !isStripeCheckoutUrl(result.url)) {
        throw new Error("Checkout returned an invalid destination.");
      }

      navigateToCheckout(result.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          <span className="label">Your email</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <button className="btn btn--light" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Starting checkout…" : "Start my search"}
        </button>
      </form>
      <p
        className={`fstat${error ? " err" : ""}`}
        role="status"
        aria-live="polite"
      >
        {error}
      </p>
    </>
  );
}
