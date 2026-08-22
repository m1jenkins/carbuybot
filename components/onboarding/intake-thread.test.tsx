import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  saveAnswer: vi.fn(),
  submitBrief: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/app/(customer)/onboarding/actions", () => ({
  saveAnswer: mocks.saveAnswer,
  submitBrief: mocks.submitBrief,
}));

import { IntakeThread } from "./intake-thread";

describe("IntakeThread", () => {
  beforeEach(() => {
    mocks.saveAnswer.mockImplementation(async ({ value }) => ({
      ok: true,
      value,
    }));
    mocks.submitBrief.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("persists a quick reply before adding it to the thread and advancing", async () => {
    let finishSave:
      | ((result: { ok: true; value: string }) => void)
      | undefined;
    mocks.saveAnswer.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );

    render(<IntakeThread engagementId="eng_1" initialDraft={{}} />);
    expect(
      screen.getByText(
        /are you looking for a new car, a used car, or either/i,
      ),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(mocks.saveAnswer).toHaveBeenCalledWith({
      engagementId: "eng_1",
      questionId: "condition",
      value: "new",
    });
    expect(
      screen.queryByText("New", { selector: "[data-message=answer]" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/which make are you after/i),
    ).not.toBeInTheDocument();

    finishSave?.({ ok: true, value: "new" });

    expect(
      await screen.findByText("New", { selector: "[data-message=answer]" }),
    ).toBeVisible();
    expect(await screen.findByText(/which make are you after/i)).toBeVisible();
  });

  it("keeps the active question in place when persistence fails", async () => {
    mocks.saveAnswer.mockResolvedValueOnce({
      ok: false,
      error: "We could not save that answer. Try again.",
    });

    render(<IntakeThread engagementId="eng_1" initialDraft={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Used" }));

    expect(
      await screen.findByRole("alert", { name: /answer error/i }),
    ).toHaveTextContent(/could not save/i);
    expect(
      screen.getByText(
        /are you looking for a new car, a used car, or either/i,
      ),
    ).toHaveAttribute("data-active", "true");
    expect(
      screen.queryByText("Used", { selector: "[data-message=answer]" }),
    ).not.toBeInTheDocument();
  });

  it("provides a labelled composer and advances with the keyboard", async () => {
    render(
      <IntakeThread
        engagementId="eng_1"
        initialDraft={{ condition: "new" }}
        initialQuestionId="make"
      />,
    );

    const input = screen.getByRole("textbox", {
      name: /which make are you after/i,
    });
    fireEvent.change(input, { target: { value: "  Toyota  " } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(mocks.saveAnswer).toHaveBeenCalledWith({
        engagementId: "eng_1",
        questionId: "make",
        value: "  Toyota  ",
      });
    });
    expect(
      await screen.findByText("Toyota", { selector: "[data-message=answer]" }),
    ).toBeVisible();
    expect(await screen.findByText(/which model/i)).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(/question 3 of/i);
  });

  it("lets the customer go back and edit without discarding later answers", async () => {
    render(
      <IntakeThread
        engagementId="eng_1"
        initialDraft={{
          condition: "new",
          make: "Toyota",
          model: "RAV4",
        }}
        initialQuestionId="yearMin"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    const model = screen.getByRole("textbox", { name: /which model/i });
    expect(model).toHaveValue("RAV4");
    fireEvent.change(model, { target: { value: "Highlander" } });
    fireEvent.submit(model.closest("form")!);

    expect(
      await screen.findByText("Highlander", {
        selector: "[data-message=answer]",
      }),
    ).toBeVisible();
    expect(screen.getByText(/oldest model year/i)).toBeVisible();
  });

  it("keeps the year question active when the merged range is invalid", async () => {
    mocks.saveAnswer.mockResolvedValueOnce({
      ok: false,
      error: "Minimum year cannot be later than maximum year.",
    });
    render(
      <IntakeThread
        engagementId="eng_1"
        initialDraft={{
          condition: "new",
          make: "Toyota",
          model: "RAV4",
          yearMax: 2024,
        }}
        initialQuestionId="yearMin"
      />,
    );

    const year = screen.getByRole("textbox", {
      name: /oldest model year/i,
    });
    fireEvent.change(year, { target: { value: "2025" } });
    fireEvent.submit(year.closest("form")!);

    expect(
      await screen.findByRole("alert", { name: /answer error/i }),
    ).toHaveTextContent(/minimum year cannot be later/i);
    expect(screen.getByText(/oldest model year/i)).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.queryByText(/newest model year/i)).not.toBeInTheDocument();
  });

  it("uses neutral semantic progress and announces the active prompt", () => {
    render(<IntakeThread engagementId="eng_1" initialDraft={{}} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemin",
      "1",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "20",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /question 1 of 20/i,
    );
  });

  it("saves consent before finalizing and routes only after success", async () => {
    render(
      <IntakeThread
        engagementId="eng_1"
        initialDraft={{
          condition: "either",
          make: "Genesis",
          model: "GV80",
          yearMin: null,
          yearMax: null,
          trim: null,
          colors: [],
          options: [],
          dealBreakers: [],
          budgetCents: 6000000,
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          searchRadiusMiles: 100,
          timeline: "within_30_days",
          hasTradeIn: false,
          financingPreference: "undecided",
          notes: null,
        }}
        initialQuestionId="consent"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /submit my brief/i }),
    );

    await waitFor(() => {
      expect(mocks.saveAnswer).toHaveBeenCalledWith({
        engagementId: "eng_1",
        questionId: "consent",
        value: true,
      });
      expect(mocks.submitBrief).toHaveBeenCalledWith({
        engagementId: "eng_1",
      });
    });
    expect(
      mocks.saveAnswer.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.submitBrief.mock.invocationCallOrder[0]);
    expect(mocks.replace).toHaveBeenCalledWith(
      "/portal?engagement=eng_1",
    );
  });

  it("retains committed consent and offers a retry when finalization fails", async () => {
    mocks.submitBrief.mockResolvedValueOnce({
      ok: false,
      error: "We could not submit your brief. Your answers are still saved.",
    });
    render(
      <IntakeThread
        engagementId="eng_1"
        initialDraft={{
          condition: "either",
          make: "Genesis",
          model: "GV80",
          yearMin: null,
          yearMax: null,
          trim: null,
          colors: [],
          options: [],
          dealBreakers: [],
          budgetCents: 6000000,
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          searchRadiusMiles: 100,
          timeline: "within_30_days",
          hasTradeIn: false,
          financingPreference: "undecided",
          notes: null,
        }}
        initialQuestionId="consent"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /submit my brief/i }),
    );

    expect(
      await screen.findByText("Submit my brief", {
        selector: "[data-message=answer]",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("alert", { name: /answer error/i }),
    ).toHaveTextContent(/answers are still saved/i);
    expect(mocks.replace).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByRole("button", { name: /retry submission/i }),
    );
    await waitFor(() => {
      expect(mocks.submitBrief).toHaveBeenCalledTimes(2);
      expect(mocks.replace).toHaveBeenCalledWith(
        "/portal?engagement=eng_1",
      );
    });
    expect(mocks.saveAnswer).toHaveBeenCalledTimes(1);
  });

  it("preserves empty-choice labels and exact budget cents in history", () => {
    render(
      <IntakeThread
        engagementId="eng_1"
        initialDraft={{
          condition: "either",
          make: "Genesis",
          model: "GV80",
          yearMin: null,
          yearMax: null,
          trim: null,
          colors: [],
          options: [],
          dealBreakers: [],
          budgetCents: 1234567,
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          searchRadiusMiles: 100,
          timeline: "within_30_days",
          hasTradeIn: false,
          financingPreference: "undecided",
          notes: null,
        }}
        initialQuestionId="consent"
      />,
    );

    expect(
      screen.getByText("No minimum", { selector: "[data-message=answer]" }),
    ).toBeVisible();
    expect(
      screen.getByText("No maximum", { selector: "[data-message=answer]" }),
    ).toBeVisible();
    expect(
      screen.getByText("No must-haves", {
        selector: "[data-message=answer]",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("None", { selector: "[data-message=answer]" }),
    ).toBeVisible();
    expect(
      screen.getByText("Nothing else", {
        selector: "[data-message=answer]",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("$12,345.67", {
        selector: "[data-message=answer]",
      }),
    ).toBeVisible();
  });

  it("shows mapped answers and revision-specific submission language", () => {
    const revisionDraft = {
      condition: "either",
      make: "Genesis",
      model: "GV80",
      yearMin: 2024,
      yearMax: 2026,
      trim: null,
      colors: ["Black"],
      options: ["Advanced package"],
      dealBreakers: [],
      budgetCents: 6000000,
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      searchRadiusMiles: 100,
      timeline: "within_30_days",
      hasTradeIn: false,
      financingPreference: "undecided",
      notes: null,
      consent: true,
    };
    const { rerender } = render(
      <IntakeThread
        engagementId="eng_1"
        initialDraft={revisionDraft}
        initialQuestionId="condition"
        revisionMode
      />,
    );

    expect(screen.getByText("Revise vehicle brief")).toBeVisible();
    expect(screen.getByRole("button", { name: "Either" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    rerender(
      <IntakeThread
        key="revision-consent"
        engagementId="eng_1"
        initialDraft={revisionDraft}
        initialQuestionId="consent"
        revisionMode
      />,
    );
    expect(
      screen.getByRole("button", { name: /submit revisions/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /retry submission/i }),
    ).not.toBeInTheDocument();
  });
});
