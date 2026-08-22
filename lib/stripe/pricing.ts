import { getStripePriceIds } from "../env";

export type PriceLabel = "intro" | "standard";

const priceAmounts: Record<PriceLabel, number> = {
  intro: 34_900,
  standard: 39_900,
};

export function choosePrice(paidCount: number): {
  priceId: string;
  label: PriceLabel;
} {
  if (!Number.isSafeInteger(paidCount) || paidCount < 0) {
    throw new Error("Paid engagement count must be a non-negative integer");
  }

  const label: PriceLabel = paidCount < 100 ? "intro" : "standard";

  return {
    label,
    priceId: getStripePriceIds()[label],
  };
}

export function getPriceAmountCents(label: PriceLabel): number {
  return priceAmounts[label];
}
