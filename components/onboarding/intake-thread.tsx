"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  answerForComposer,
  formatIntakeAnswer,
  getFirstUnansweredQuestionId,
  getNextQuestionId,
  getVisibleQuestions,
  parseIntakeAnswer,
} from "./intake-questions";
import type {
  IntakeAnswers,
  IntakeQuestion,
} from "./intake-questions";
import { saveAnswer, submitBrief } from "@/app/(customer)/onboarding/actions";

type IntakeThreadProps = {
  engagementId: string;
  initialDraft: IntakeAnswers;
  initialQuestionId?: string | null;
  revisionMode?: boolean;
};

function initialActiveQuestion(
  answers: IntakeAnswers,
  requestedQuestionId?: string | null,
): string {
  const visible = getVisibleQuestions(answers);
  if (
    requestedQuestionId &&
    visible.some((question) => question.id === requestedQuestionId)
  ) {
    return requestedQuestionId;
  }
  return getFirstUnansweredQuestionId(answers) ?? visible.at(-1)!.id;
}

function usesComposer(question: IntakeQuestion): boolean {
  return !["single-choice", "confirmation"].includes(question.kind);
}

function isSelectedChoice(
  question: IntakeQuestion,
  choiceValue: string,
  answer: unknown,
): boolean {
  if (question.kind === "confirmation") {
    return false;
  }
  if (choiceValue === "__none__") {
    return answer === null || (Array.isArray(answer) && answer.length === 0);
  }
  return String(answer) === choiceValue;
}

function inputModeFor(
  question: IntakeQuestion,
): "decimal" | "numeric" | "text" {
  if (question.kind === "currency") {
    return "decimal";
  }
  if (question.kind === "number" || question.kind === "postal-code") {
    return "numeric";
  }
  return "text";
}

export function IntakeThread({
  engagementId,
  initialDraft,
  initialQuestionId,
  revisionMode = false,
}: IntakeThreadProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<IntakeAnswers>(initialDraft);
  const [activeQuestionId, setActiveQuestionId] = useState(() =>
    initialActiveQuestion(initialDraft, initialQuestionId),
  );
  const [composerValue, setComposerValue] = useState(() => {
    const questionId = initialActiveQuestion(initialDraft, initialQuestionId);
    const question = getVisibleQuestions(initialDraft).find(
      (item) => item.id === questionId,
    )!;
    return answerForComposer(question, initialDraft[question.id]);
  });
  const [error, setError] = useState("");
  const [isConsentCommitted, setIsConsentCommitted] = useState(
    initialDraft.consent === true && !revisionMode,
  );
  const [isPending, startTransition] = useTransition();
  const promptRef = useRef<HTMLParagraphElement>(null);

  const questions = useMemo(() => getVisibleQuestions(answers), [answers]);
  const activeIndex = Math.max(
    0,
    questions.findIndex((question) => question.id === activeQuestionId),
  );
  const activeQuestion = questions[activeIndex] ?? questions[0];
  const answeredQuestions = questions.slice(0, activeIndex);
  const position = activeIndex + 1;
  const showCommittedConsent =
    activeQuestion.id === "consent" && isConsentCommitted;

  useEffect(() => {
    const prompt = promptRef.current;
    prompt?.focus({ preventScroll: true });
    prompt?.scrollIntoView?.({ block: "nearest" });
  }, [activeQuestion]);

  async function commitAnswer(rawValue: unknown) {
    setError("");

    try {
      parseIntakeAnswer(activeQuestion.id, rawValue);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Check this answer and try again.",
      );
      return;
    }

    const question = activeQuestion;
    startTransition(async () => {
      const saved = await saveAnswer({
        engagementId,
        questionId: question.id,
        value: rawValue,
      });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      let savedValue: unknown;
      try {
        savedValue = parseIntakeAnswer(question.id, saved.value);
      } catch {
        setError("The saved answer could not be verified. Try again.");
        return;
      }

      setAnswers((currentAnswers) => ({
        ...currentAnswers,
        [question.id]: savedValue,
      }));

      if (question.id === "consent") {
        setIsConsentCommitted(true);
        const submitted = await submitBrief({ engagementId });
        if (!submitted.ok) {
          setError(submitted.error);
          return;
        }
        router.replace(
          `/portal?engagement=${encodeURIComponent(engagementId)}`,
        );
        return;
      }

      const nextQuestionId = getNextQuestionId(
        { [question.id]: savedValue },
        question.id,
      );
      if (nextQuestionId) {
        const nextQuestion = getVisibleQuestions({
          [question.id]: savedValue,
        }).find(
          (candidate) => candidate.id === nextQuestionId,
        )!;
        setComposerValue(
          answerForComposer(nextQuestion, answers[nextQuestionId]),
        );
        setActiveQuestionId(nextQuestionId);
      }
    });
  }

  function retrySubmission() {
    setError("");
    startTransition(async () => {
      const submitted = await submitBrief({ engagementId });
      if (!submitted.ok) {
        setError(submitted.error);
        return;
      }
      router.replace(
        `/portal?engagement=${encodeURIComponent(engagementId)}`,
      );
    });
  }

  function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void commitAnswer(composerValue);
  }

  function handleBack() {
    const previousQuestion = questions[activeIndex - 1];
    if (!previousQuestion || isPending) {
      return;
    }
    setError("");
    if (showCommittedConsent) {
      setIsConsentCommitted(false);
    }
    setComposerValue(
      answerForComposer(previousQuestion, answers[previousQuestion.id]),
    );
    setActiveQuestionId(previousQuestion.id);
  }

  return (
    <section
      className="intake"
      aria-labelledby="intake-title"
      aria-busy={isPending}
    >
      <header className="intake__header">
        <Link className="intake__brand" href="/" aria-label="CarBuyerBots home">
          CarBuyerBots
        </Link>
        <div className="intake__orientation">
          <p className="label" id="intake-title">
            {revisionMode ? "Revise vehicle brief" : "Vehicle brief"}
          </p>
          <p className="cap num" aria-hidden="true">
            Question {position} of {questions.length}
          </p>
        </div>
        <div
          className="intake__progress"
          role="progressbar"
          aria-label="Vehicle brief progress"
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-valuenow={position}
        >
          <span
            style={{
              inlineSize: `${(position / questions.length) * 100}%`,
            }}
          />
        </div>
      </header>

      <div className="intake__thread">
        {answeredQuestions.map((question) => (
          <div className="intake__turn" key={question.id}>
            <p className="intake__prompt" data-message="prompt">
              {question.prompt}
            </p>
            <p
              className={`intake__answer${
                question.kind === "currency" ? " intake__answer--money" : ""
              }`}
              data-message="answer"
            >
              {formatIntakeAnswer(question, answers[question.id])}
            </p>
          </div>
        ))}

        <div className="intake__turn intake__turn--active">
          <p
            className={`intake__prompt${
              activeQuestion.kind === "currency"
                ? " intake__prompt--money"
                : ""
            }`}
            data-message="prompt"
            data-active="true"
            id={`question-${activeQuestion.id}`}
            ref={promptRef}
            tabIndex={-1}
          >
            {activeQuestion.prompt}
          </p>

          {showCommittedConsent && (
            <p className="intake__answer" data-message="answer">
              {formatIntakeAnswer(activeQuestion, true)}
            </p>
          )}

          {activeQuestion.choices && !showCommittedConsent && (
            <fieldset
              className="intake__replies"
              disabled={isPending}
              aria-labelledby={`question-${activeQuestion.id}`}
              aria-describedby={error ? "intake-error" : undefined}
            >
              <legend className="sr-only">Answer choices</legend>
              {activeQuestion.choices.map((choice) => (
                <button
                  className="intake__reply"
                  key={choice.value}
                  type="button"
                  aria-pressed={isSelectedChoice(
                    activeQuestion,
                    choice.value,
                    answers[activeQuestion.id],
                  )}
                  onClick={() =>
                    void commitAnswer(
                      activeQuestion.kind === "confirmation"
                        ? true
                        : choice.value,
                    )
                  }
                >
                  {revisionMode && activeQuestion.kind === "confirmation"
                    ? "Submit revisions"
                    : choice.label}
                </button>
              ))}
            </fieldset>
          )}
        </div>
      </div>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Question ${position} of ${questions.length}. ${activeQuestion.prompt}`}
      >
        Question {position} of {questions.length}.
      </div>

      <div className="intake__dock">
        <div className="intake__dock-inner">
          <button
            className="intake__back"
            type="button"
            onClick={handleBack}
            disabled={activeIndex === 0 || isPending}
          >
            <span aria-hidden="true">←</span> Back
          </button>

          {showCommittedConsent && (
            <button
              className="intake__reply"
              type="button"
              onClick={retrySubmission}
              disabled={isPending}
            >
              {isPending ? "Submitting…" : "Retry submission"}
            </button>
          )}

          {usesComposer(activeQuestion) && !showCommittedConsent && (
            <form
              className={`intake__composer${
                activeQuestion.kind === "currency"
                  ? " intake__composer--money"
                  : ""
              }`}
              onSubmit={handleComposerSubmit}
            >
              <label
                className="sr-only"
                htmlFor={`answer-${activeQuestion.id}`}
              >
                Your answer
              </label>
              {activeQuestion.kind === "currency" && (
                <span aria-hidden="true">$</span>
              )}
              <input
                id={`answer-${activeQuestion.id}`}
                name="answer"
                type="text"
                inputMode={inputModeFor(activeQuestion)}
                autoComplete={
                  activeQuestion.kind === "postal-code"
                    ? "postal-code"
                    : "off"
                }
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                placeholder={
                  activeQuestion.kind === "multi-choice"
                    ? "Separate answers with commas"
                    : "Type your answer"
                }
                disabled={isPending}
                required={!activeQuestion.choices}
                aria-labelledby={`question-${activeQuestion.id}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "intake-error" : undefined}
              />
              <button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </button>
            </form>
          )}
        </div>
        <p
          className="intake__error"
          id="intake-error"
          role={error ? "alert" : undefined}
          aria-label={error ? "Answer error" : undefined}
        >
          {error}
        </p>
      </div>
    </section>
  );
}
