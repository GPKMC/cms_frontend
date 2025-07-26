"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  X
} from "lucide-react";
import type { TiptapEditorProps } from "./rtecomponent";

// Dynamically import the rich‐text editor component
const TiptapEditor = dynamic<TiptapEditorProps>(
  () => import("../quiz/rtecomponent"),
  { ssr: false }
);

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text: string;
  type: "mcq" | "short_answer";
  points: number;
  options: Option[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

export default function QuizForm({
  courseInstanceId,
  courseName,
  onClose,
  onSuccess
}: {
  courseInstanceId: string;
  courseName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Quiz metadata state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helpers to manage questions
  const addQuestion = () => {
    setQuestions(qs => [
      ...qs,
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "",
        type: "mcq",
        points: 1,
        options: [],
        feedbackCorrect: "",
        feedbackIncorrect: ""
      }
    ]);
  };
  const removeQuestion = (qid: string) =>
    setQuestions(qs => qs.filter(q => q.id !== qid));
  const updateQuestion = (qid: string, field: keyof Question, val: any) =>
    setQuestions(qs =>
      qs.map(q => (q.id === qid ? { ...q, [field]: val } : q))
    );
  // Helpers to manage options
  const addOption = (qid: string) =>
    setQuestions(qs =>
      qs.map(q =>
        q.id !== qid
          ? q
          : {
              ...q,
              options: [
                ...q.options,
                { id: Math.random().toString(36).substr(2, 9), text: "", isCorrect: false }
              ]
            }
      )
    );
  const updateOption = (qid: string, oid: string, text: string) =>
    setQuestions(qs =>
      qs.map(q =>
        q.id !== qid
          ? q
          : { ...q, options: q.options.map(o => (o.id === oid ? { ...o, text } : o)) }
      )
    );
  const toggleCorrect = (qid: string, oid: string) =>
    setQuestions(qs =>
      qs.map(q =>
        q.id !== qid
          ? q
          : {
              ...q,
              options: q.options.map(o => ({
                ...o,
                isCorrect: o.id === oid
              }))
            }
      )
    );
  const removeOption = (qid: string, oid: string) =>
    setQuestions(qs =>
      qs.map(q =>
        q.id !== qid
          ? q
          : { ...q, options: q.options.filter(o => o.id !== oid) }
      )
    );

  // Validation guard
  const canSubmit =
    title.trim() !== "" &&
    questions.length > 0 &&
    questions.every(q =>
      q.text.trim() !== "" &&
      q.points > 0 &&
      (q.type === "short_answer" ||
        (q.options.length >= 2 && q.options.some(o => o.isCorrect)))
    );

  async function handleSubmit() {
  if (!canSubmit) {
    toast.error("Fix validation errors before submitting.");
    return;
  }
  setIsSubmitting(true);

  const token =
    localStorage.getItem("token_teacher") ||
    sessionStorage.getItem("token_teacher") ||
    "";

  try {
    // 1) Create the quiz itself
    const quizRes = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/quizrouter`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          dueDate,
          courseInstance: courseInstanceId,
        }),
      }
    );
    if (!quizRes.ok) {
      const err = await quizRes.json();
      throw new Error(err.errors?.[0]?.msg || "Failed to create quiz");
    }
    const { _id: quizId } = await quizRes.json();

    // 2) For each question, do a 2‑step create & patch
    for (const q of questions) {
      // 2a) POST without correctOption
      const createQRes = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/quizrouter/${quizId}/questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: q.text,
            type: q.type,
            points: q.points,
            options: q.options.map(o => ({ text: o.text })),
            feedbackCorrect: q.feedbackCorrect,
            feedbackIncorrect: q.feedbackIncorrect,
          }),
        }
      );
      if (!createQRes.ok) {
        const err = await createQRes.json();
        throw new Error(err.errors?.[0]?.msg || "Failed to create question");
      }
      const updatedQuiz = await createQRes.json();

      // 2b) Locate the newly‐added question by matching its text
      const newlyAdded = updatedQuiz.questions.find((qq: any) => qq.text === q.text);
      if (!newlyAdded) {
        throw new Error("Cannot find newly created question");
      }

      // 2c) Find the real ObjectId of the user‐marked correct option
      const correctIdx = q.options.findIndex(o => o.isCorrect);
      if (correctIdx >= 0) {
        const correctOptionId = newlyAdded.options[correctIdx]._id;

        // 2d) PATCH to set correctOption
        const patchRes = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/quizrouter/${quizId}/questions/${newlyAdded._id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ correctOption: correctOptionId }),
          }
        );
        if (!patchRes.ok) {
          const err = await patchRes.json();
          throw new Error(err.errors?.[0]?.msg || "Failed to set correct option");
        }
      }
    }

    toast.success("Quiz created!");
    // reset form state
    setTitle("");
    setDescription("");
    setDueDate("");
    setQuestions([]);
    onSuccess();
  } catch (err: any) {
    console.error(err);
    toast.error(err.message || "Something went wrong");
  } finally {
    setIsSubmitting(false);
  }
}

  // Render modal + form
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">Create Quiz</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 max-w-3xl mx-auto space-y-8">
            <h2 className="text-2xl font-semibold">Create New Quiz</h2>

            {/* Metadata */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Quiz Title</label>
                <input
                  type="text"
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter quiz title…"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <TiptapEditor
                  content={description}
                  onChange={setDescription}
                  placeholder="Optional description…"
                  className="min-h-[120px] border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Due Date</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Questions</h3>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded"
                >
                  <Plus size={16} /> Add Question
                </button>
              </div>

              {questions.length === 0 && (
                <p className="text-gray-500">
                  No questions yet. Click “Add Question” to start.
                </p>
              )}

              {questions.map((q, idx) => (
                <div key={q.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Question {idx + 1}</span>
                    <button onClick={() => removeQuestion(q.id)}>
                      <Trash2 size={18} className="text-red-600 hover:text-red-800" />
                    </button>
                  </div>

                  {/* Text */}
                  <div>
                    <label className="block text-sm">Text</label>
                    <input
                      type="text"
                      className="mt-1 w-full border rounded px-3 py-2"
                      value={q.text}
                      onChange={e => updateQuestion(q.id, "text", e.target.value)}
                    />
                  </div>

                  {/* Type & Points */}
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-sm">Type</label>
                      <select
                        className="mt-1 border rounded px-2 py-1"
                        value={q.type}
                        onChange={e => updateQuestion(q.id, "type", e.target.value as any)}
                      >
                        <option value="mcq">MCQ</option>
                        <option value="short_answer">Short Answer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm">Points</label>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-24 border rounded px-2 py-1"
                        value={q.points}
                        onChange={e => updateQuestion(q.id, "points", +e.target.value)}
                      />
                    </div>
                  </div>

                  {/* MCQ Options */}
                  {q.type === "mcq" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Options</span>
                        <button
                          type="button"
                          onClick={() => addOption(q.id)}
                          className="text-green-600 hover:underline text-sm"
                        >
                          + Add Option
                        </button>
                      </div>
                      {q.options.map(o => (
                        <div key={o.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={o.isCorrect}
                            onChange={() => toggleCorrect(q.id, o.id)}
                          />
                          <input
                            type="text"
                            className="flex-1 border rounded px-2 py-1"
                            value={o.text}
                            onChange={e => updateOption(q.id, o.id, e.target.value)}
                            placeholder="Option text…"
                          />
                          <button onClick={() => removeOption(q.id, o.id)}>
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        </div>
                      ))}
                      {!q.options.some(o => o.isCorrect) && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle size={14} /> Mark one option as correct
                        </p>
                      )}
                    </div>
                  )}

                  {/* Feedback */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm">Feedback (Correct)</label>
                      <input
                        type="text"
                        className="mt-1 w-full border rounded px-2 py-1"
                        value={q.feedbackCorrect}
                        onChange={e => updateQuestion(q.id, "feedbackCorrect", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm">Feedback (Incorrect)</label>
                      <input
                        type="text"
                        className="mt-1 w-full border rounded px-2 py-1"
                        value={q.feedbackIncorrect}
                        onChange={e => updateQuestion(q.id, "feedbackIncorrect", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className={`flex items-center gap-2 px-6 py-2 rounded text-white ${
                  canSubmit
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                ) : (
                  <CheckCircle size={18} />
                )}
                {isSubmitting ? "Creating…" : "Create Quiz"}
              </button>
              {!canSubmit && (
                <p className="text-sm text-red-600">
                  Please fix errors above before submitting.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
