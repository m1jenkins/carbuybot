import { getStripePriceIds } from "../env";

export type PriceLabel = "intro" | "standard";
type StripePriceIds = ReturnType<typeof getStripePriceIds>;

const priceAmounts: Record<PriceLabel, number> = {
  intro: 34_900,
  standard: 39_900,
};

export function choosePrice(
  reservationCount: number,
  priceIds: StripePriceIds = getStripePriceIds(),
): {
  priceId: string;
  label: PriceLabel;
} {
  if (!Number.isSafeInteger(reservationCount) || reservationCount < 0) {
    throw new Error("Checkout reservation count must be a non-negative integer");
  }

  const label: PriceLabel = reservationCount < 100 ? "intro" : "standard";

  return {
    label,
    priceId: priceIds[label],
  };
}

export function getPriceAmountCents(label: PriceLabel): number {
  return priceAmounts[label];
}
