import { z } from "zod";

const conditionSchema = z.enum(["new", "used", "either"]);
const timelineSchema = z.enum([
  "immediately",
  "within_30_days",
  "within_60_days",
  "within_90_days",
  "flexible",
]);
const financingPreferenceSchema = z.enum([
  "cash",
  "loan",
  "lease",
  "undecided",
]);

const stateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z.enum([
      "AL",
      "AK",
      "AZ",
      "AR",
      "CA",
      "CO",
      "CT",
      "DE",
      "FL",
      "GA",
      "HI",
      "ID",
      "IL",
      "IN",
      "IA",
      "KS",
      "KY",
      "LA",
      "ME",
      "MD",
      "MA",
      "MI",
      "MN",
      "MS",
      "MO",
      "MT",
      "NE",
      "NV",
      "NH",
      "NJ",
      "NM",
      "NY",
      "NC",
      "ND",
      "OH",
      "OK",
      "OR",
      "PA",
      "RI",
      "SC",
      "SD",
      "TN",
      "TX",
      "UT",
      "VT",
      "VA",
      "WA",
      "WV",
      "WI",
      "WY",
      "DC",
    ]),
  );

const shortTextSchema = z.string().trim().min(1).max(100);
const textListSchema = z
  .array(shortTextSchema)
  .max(20)
  .refine((values) => new Set(values).size === values.length, {
    message: "List items must be unique",
  });

export const briefSchema = z
  .object({
    condition: conditionSchema,
    make: shortTextSchema,
    model: shortTextSchema,
    yearMin: z.number().int().min(1900).max(2100).optional(),
    yearMax: z.number().int().min(1900).max(2100).optional(),
    trim: shortTextSchema.optional(),
    colors: textListSchema,
    options: textListSchema,
    dealBreakers: textListSchema,
    budgetCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    city: shortTextSchema,
    state: stateSchema,
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}(?:-\d{4})?$/, "Enter a valid U.S. ZIP code"),
    searchRadiusMiles: z.number().int().min(1).max(500),
    timeline: timelineSchema,
    hasTradeIn: z.boolean(),
    tradeInDetails: z.string().trim().min(1).max(1_000).optional(),
    financingPreference: financingPreferenceSchema,
    notes: z.string().trim().max(5_000).optional(),
    consent: z.literal(true),
  })
  .strict()
  .superRefine(({ yearMin, yearMax }, context) => {
    if (yearMin !== undefined && yearMax !== undefined && yearMin > yearMax) {
      context.addIssue({
        code: "custom",
        message: "Minimum year cannot be later than maximum year",
        path: ["yearMax"],
      });
    }
  });

export type BriefInput = z.infer<typeof briefSchema>;
