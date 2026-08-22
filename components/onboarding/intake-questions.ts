import { z } from "zod";

import { briefSchema } from "@/lib/domain/brief";
import type { BriefInput } from "@/lib/domain/brief";

export type IntakeQuestion = {
  id: string;
  field: keyof BriefInput;
  prompt: string;
  kind:
    | "text"
    | "single-choice"
    | "multi-choice"
    | "currency"
    | "postal-code"
    | "number"
    | "confirmation";
  choices?: readonly { label: string; value: string }[];
};

export type IntakeAnswers = Record<string, unknown>;

const NO_PREFERENCE = "__none__";

export const INTAKE_QUESTIONS: readonly IntakeQuestion[] = [
  {
    id: "condition",
    field: "condition",
    prompt: "Are you looking for a new car, a used car, or either?",
    kind: "single-choice",
    choices: [
      { label: "New", value: "new" },
      { label: "Used", value: "used" },
      { label: "Either", value: "either" },
    ],
  },
  {
    id: "make",
    field: "make",
    prompt: "Which make are you after?",
    kind: "text",
  },
  {
    id: "model",
    field: "model",
    prompt: "Which model are you considering?",
    kind: "text",
  },
  {
    id: "yearMin",
    field: "yearMin",
    prompt: "What is the oldest model year you would consider?",
    kind: "number",
    choices: [{ label: "No minimum", value: NO_PREFERENCE }],
  },
  {
    id: "yearMax",
    field: "yearMax",
    prompt: "What is the newest model year you would consider?",
    kind: "number",
    choices: [{ label: "No maximum", value: NO_PREFERENCE }],
  },
  {
    id: "trim",
    field: "trim",
    prompt: "Do you have a trim in mind?",
    kind: "text",
    choices: [{ label: "No preference", value: NO_PREFERENCE }],
  },
  {
    id: "colors",
    field: "colors",
    prompt: "Which exterior colors would work for you?",
    kind: "multi-choice",
    choices: [{ label: "No preference", value: NO_PREFERENCE }],
  },
  {
    id: "options",
    field: "options",
    prompt: "Which features or options are must-haves?",
    kind: "multi-choice",
    choices: [{ label: "No must-haves", value: NO_PREFERENCE }],
  },
  {
    id: "dealBreakers",
    field: "dealBreakers",
    prompt: "Are there any deal-breakers we should avoid?",
    kind: "multi-choice",
    choices: [{ label: "None", value: NO_PREFERENCE }],
  },
  {
    id: "budgetCents",
    field: "budgetCents",
    prompt: "What is the most you would like to spend on the vehicle?",
    kind: "currency",
  },
  {
    id: "city",
    field: "city",
    prompt: "Which city should we search around?",
    kind: "text",
  },
  {
    id: "state",
    field: "state",
    prompt: "Which state are you in?",
    kind: "text",
  },
  {
    id: "postalCode",
    field: "postalCode",
    prompt: "What is your ZIP code?",
    kind: "postal-code",
  },
  {
    id: "searchRadiusMiles",
    field: "searchRadiusMiles",
    prompt: "How far should we search from your ZIP code?",
    kind: "number",
    choices: [
      { label: "25 miles", value: "25" },
      { label: "50 miles", value: "50" },
      { label: "100 miles", value: "100" },
      { label: "250 miles", value: "250" },
      { label: "500 miles", value: "500" },
    ],
  },
  {
    id: "timeline",
    field: "timeline",
    prompt: "When would you like to buy?",
    kind: "single-choice",
    choices: [
      { label: "Immediately", value: "immediately" },
      { label: "Within 30 days", value: "within_30_days" },
      { label: "Within 60 days", value: "within_60_days" },
      { label: "Within 90 days", value: "within_90_days" },
      { label: "I am flexible", value: "flexible" },
    ],
  },
  {
    id: "hasTradeIn",
    field: "hasTradeIn",
    prompt: "Will you have a vehicle to trade in?",
    kind: "single-choice",
    choices: [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ],
  },
  {
    id: "tradeInDetails",
    field: "tradeInDetails",
    prompt: "Tell us the year, make, model, mileage, and payoff on your trade-in.",
    kind: "text",
  },
  {
    id: "financingPreference",
    field: "financingPreference",
    prompt: "How are you planning to pay?",
    kind: "single-choice",
    choices: [
      { label: "Cash", value: "cash" },
      { label: "Finance with a loan", value: "loan" },
      { label: "Lease", value: "lease" },
      { label: "Not sure yet", value: "undecided" },
    ],
  },
  {
    id: "notes",
    field: "notes",
    prompt: "Anything else your buying agent should know?",
    kind: "text",
    choices: [{ label: "Nothing else", value: NO_PREFERENCE }],
  },
  {
    id: "consent",
    field: "consent",
    prompt:
      "Ready to submit? You authorize us to contact dealers about this vehicle on your behalf.",
    kind: "confirmation",
    choices: [{ label: "Submit my brief", value: "true" }],
  },
] as const;

const questionById = new Map(
  INTAKE_QUESTIONS.map((question) => [question.id, question]),
);

function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Check this answer and try again.";
  }
  if (issue.path[0] === "postalCode") {
    return "Enter a valid U.S. ZIP code.";
  }
  return `${issue.message.replace(/\.$/, "")}.`;
}

function parseNumber(value: unknown): number {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw new Error("Enter a whole number.");
  }
  return Number(text);
}

function parseTextList(value: unknown): string[] {
  if (value === NO_PREFERENCE) {
    return [];
  }

  const values = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const normalized = [...new Set(values)];
  if (normalized.length > 20 || normalized.some((item) => item.length > 100)) {
    throw new Error("Use at most 20 items, each under 100 characters.");
  }
  return normalized;
}

function normalizeRawAnswer(
  question: IntakeQuestion,
  value: unknown,
): unknown {
  if (value === NO_PREFERENCE) {
    if (question.kind === "multi-choice") {
      return [];
    }
    return null;
  }

  switch (question.kind) {
    case "single-choice": {
      const selected = String(value);
      if (!question.choices?.some((choice) => choice.value === selected)) {
        throw new Error("Choose one of the available answers.");
      }
      if (question.field === "hasTradeIn") {
        return selected === "true";
      }
      return selected;
    }
    case "confirmation":
      if (value !== true && value !== "true") {
        throw new Error("Confirm before submitting your brief.");
      }
      return true;
    case "multi-choice":
      return parseTextList(value);
    case "currency": {
      const dollars = String(value).replace(/[$,\s]/g, "");
      if (!/^\d+(?:\.\d{1,2})?$/.test(dollars)) {
        throw new Error("Enter a dollar amount, such as 45000.");
      }
      return Math.round(Number(dollars) * 100);
    }
    case "number":
      return parseNumber(value);
    case "postal-code":
      return String(value).trim();
    case "text": {
      const text = String(value).trim();
      if (question.field === "state") {
        return text.toUpperCase();
      }
      return text;
    }
  }
}

export function getIntakeQuestion(questionId: string): IntakeQuestion | null {
  return questionById.get(questionId) ?? null;
}

export function parseIntakeAnswer(
  questionId: string,
  value: unknown,
): unknown {
  const question = getIntakeQuestion(questionId);
  if (!question) {
    throw new Error("That intake question is not recognized.");
  }

  const normalized = normalizeRawAnswer(question, value);
  if (
    normalized === null &&
    ["yearMin", "yearMax", "trim", "notes"].includes(question.field)
  ) {
    return normalized;
  }

  const result = briefSchema.shape[question.field].safeParse(normalized);
  if (!result.success) {
    throw new Error(validationMessage(result.error));
  }
  return result.data;
}

export function getVisibleQuestions(
  answers: IntakeAnswers,
): readonly IntakeQuestion[] {
  return INTAKE_QUESTIONS.filter(
    (question) =>
      question.id !== "tradeInDetails" || answers.hasTradeIn !== false,
  );
}

export function getNextQuestionId(
  answers: IntakeAnswers,
  currentQuestionId: string,
): string | null {
  const questions = getVisibleQuestions(answers);
  const currentIndex = questions.findIndex(
    (question) => question.id === currentQuestionId,
  );
  return questions[currentIndex + 1]?.id ?? null;
}

export function getFirstUnansweredQuestionId(
  answers: IntakeAnswers,
): string | null {
  return (
    getVisibleQuestions(answers).find(
      (question) =>
        !Object.prototype.hasOwnProperty.call(answers, question.id),
    )?.id ?? null
  );
}

export function isIntakeComplete(answers: IntakeAnswers): boolean {
  return getVisibleQuestions(answers).every((question) =>
    Object.prototype.hasOwnProperty.call(answers, question.id),
  );
}

export function buildBriefFromAnswers(answers: IntakeAnswers): BriefInput {
  const candidate: Record<string, unknown> = {};

  for (const question of INTAKE_QUESTIONS) {
    if (question.id === "tradeInDetails" && answers.hasTradeIn === false) {
      continue;
    }
    const value = answers[question.id];
    if (value !== null && value !== undefined) {
      candidate[question.field] = value;
    }
  }

  return briefSchema.parse(candidate);
}

export function formatIntakeAnswer(
  question: IntakeQuestion,
  value: unknown,
): string {
  if (value === null || (Array.isArray(value) && value.length === 0)) {
    return "No preference";
  }
  const choice = question.choices?.find(
    (item) =>
      item.value === String(value) ||
      (value === true && item.value === "true") ||
      (value === false && item.value === "false"),
  );
  if (choice) {
    return choice.label;
  }
  if (question.kind === "currency" && typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value / 100);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

export function answerForComposer(
  question: IntakeQuestion,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (question.kind === "currency" && typeof value === "number") {
    return String(value / 100);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}
