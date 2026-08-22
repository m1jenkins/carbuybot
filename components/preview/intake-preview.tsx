"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  answerForComposer,
  formatIntakeAnswer,
  getNextQuestionId,
  getVisibleQuestions,
  parseIntakeAnswer,
} from "@/components/onboarding/intake-questions";
import type {
  IntakeAnswers,
  IntakeQuestion,
} from "@/components/onboarding/intake-questions";

function usesComposer(question: IntakeQuestion): boolean {
  return !["single-choice", "confirmation"].includes(question.kind);
}

function inputModeFor(
  question: IntakeQuestion,
): "decimal" | "numeric" | "text" {
  if (question.kind === "currency") return "decimal";
  if (question.kind === "number" || question.kind === "postal-code") {
    return "numeric";
  }
  return "text";
}

export function IntakePreview() {
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [activeQuestionId, setActiveQuestionId] = useState("condition");
  const [composerValue, setComposerValue] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const questions = useMemo(() => getVisibleQuestions(answers), [answers]);
  const activeIndex = Math.max(
    0,
    questions.findIndex((question) => question.id === activeQuestionId),
  );
  const activeQuestion = questions[activeIndex] ?? questions[0]!;
  const answeredQuestions = questions.slice(0, activeIndex);

  function commitAnswer(rawValue: unknown) {
    setError("");
    try {
      const value = parseIntakeAnswer(activeQuestion.id, rawValue);
      const nextAnswers = {
        ...answers,
        [activeQuestion.id]: value,
      };
      setAnswers(nextAnswers);

      const nextQuestionId = getNextQuestionId(
        nextAnswers,
        activeQuestion.id,
      );
      if (!nextQuestionId) {
        setComplete(true);
        return;
      }

      const nextQuestion = getVisibleQuestions(nextAnswers).find(
        (question) => question.id === nextQuestionId,
      );
      setActiveQuestionId(nextQuestionId);
      setComposerValue(
        nextQuestion
          ? answerForComposer(nextQuestion, nextAnswers[nextQuestionId])
          : "",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Check this answer and try again.",
      );
    }
  }

  function submitComposer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitAnswer(composerValue);
  }

  function goBack() {
    const previous = questions[activeIndex - 1];
    if (!previous) return;
    setComplete(false);
    setError("");
    setActiveQuestionId(previous.id);
    setComposerValue(answerForComposer(previous, answers[previous.id]));
  }

  return (
    <section
      className="intake"
      aria-labelledby="preview-intake-title"
    >
      <header className="intake__header">
        <span className="intake__brand">CarBuyerBots</span>
        <div className="intake__orientation">
          <p className="label" id="preview-intake-title">
            Vehicle brief preview
          </p>
          <p className="cap num">
            Question {activeIndex + 1} of {questions.length}
          </p>
        </div>
        <div
          className="intake__progress"
          role="progressbar"
          aria-label="Vehicle brief preview progress"
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-valuenow={activeIndex + 1}
        >
          <span
            style={{
              inlineSize: `${((activeIndex + 1) / questions.length) * 100}%`,
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
            id={`preview-question-${activeQuestion.id}`}
          >
            {activeQuestion.prompt}
          </p>

          {complete ? (
            <>
              <p className="intake__answer" data-message="answer">
                {formatIntakeAnswer(
                  activeQuestion,
                  answers[activeQuestion.id],
                )}
              </p>
              <p className="preview-intake-complete" role="status">
                Fixture complete. No brief was submitted or saved.
              </p>
            </>
          ) : (
            activeQuestion.choices && (
              <fieldset
                className="intake__replies"
                aria-labelledby={`preview-question-${activeQuestion.id}`}
                aria-describedby={error ? "preview-intake-error" : undefined}
              >
                <legend className="sr-only">Answer choices</legend>
                {activeQuestion.choices.map((choice) => (
                  <button
                    className="intake__reply"
                    key={choice.value}
                    type="button"
                    onClick={() =>
                      commitAnswer(
                        activeQuestion.kind === "confirmation"
                          ? true
                          : choice.value,
                      )
                    }
                  >
                    {choice.label}
                  </button>
                ))}
              </fieldset>
            )
          )}
        </div>
      </div>

      <div className="intake__dock">
        <div className="intake__dock-inner">
          <button
            className="intake__back"
            type="button"
            onClick={goBack}
            disabled={activeIndex === 0}
          >
            <span aria-hidden="true">←</span> Back
          </button>

          {usesComposer(activeQuestion) && !complete ? (
            <form
              className={`intake__composer${
                activeQuestion.kind === "currency"
                  ? " intake__composer--money"
                  : ""
              }`}
              onSubmit={submitComposer}
            >
              <label
                className="sr-only"
                htmlFor={`preview-answer-${activeQuestion.id}`}
              >
                {activeQuestion.prompt}
              </label>
              {activeQuestion.kind === "currency" ? (
                <span aria-hidden="true">$</span>
              ) : null}
              <input
                id={`preview-answer-${activeQuestion.id}`}
                type="text"
                inputMode={inputModeFor(activeQuestion)}
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                placeholder={
                  activeQuestion.kind === "multi-choice"
                    ? "Separate answers with commas"
                    : "Type your answer"
                }
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "preview-intake-error" : undefined}
                required={!activeQuestion.choices}
              />
              <button type="submit">Save locally</button>
            </form>
          ) : null}
        </div>
        <p
          className="intake__error"
          id="preview-intake-error"
          role={error ? "alert" : undefined}
        >
          {error}
        </p>
      </div>
    </section>
  );
}
