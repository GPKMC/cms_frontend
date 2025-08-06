'use client';

import React, { useState } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Clock,
  FileText,
  Hash,
  BookOpen,
  Sparkles,
  Save
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
      q.options.length >= 2 &&
      q.options.some(o => o.isCorrect)
    );

  async function handleSubmit() {
    if (!canSubmit) {
      toast.error("Fix validation errors before submitting.");
      return;
    }

    // dueDate must be in the future
    if (dueDate) {
      const ts = new Date(dueDate).getTime();
      if (isNaN(ts) || ts <= Date.now()) {
        toast.error("Due date must be in the future.");
        return;
      }
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

      // 2) For each question, do a 2-step create & patch
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
              type: "mcq",
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

        // 2b) Find that new question by text
        const newlyAdded = updatedQuiz.questions.find((qq: any) => qq.text === q.text);
        if (!newlyAdded) {
          throw new Error("Cannot find newly created question");
        }

        // 2c) Get the correct option’s real _id
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

      toast.success("Quiz created successfully! 🎉");
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

  // Calculate progress
  const totalFields = 3 + questions.length * 3;
  const completedFields =
    (title.trim() ? 1 : 0) +
    (description.trim() ? 1 : 0) +
    (dueDate ? 1 : 0) +
    questions.reduce((acc, q) =>
      acc +
      (q.text.trim() ? 1 : 0) +
      (q.points > 0 ? 1 : 0) +
      (q.options.length >= 2 && q.options.some(o => o.isCorrect) ? 1 : 0)
    , 0);
  const completionPercent = totalFields > 0
    ? Math.round((completedFields / totalFields) * 100)
    : 0;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[95vh] overflow-auto">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles size={24} />
                <div>
                  <h2 className="text-2xl font-bold">Create New Quiz</h2>
                  <p className="text-blue-200 text-sm">for {courseName}</p>
                </div>
              </div>
              <button onClick={onClose} className="hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="font-medium">{completionPercent}%</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-10">
            {/* Quiz Details */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <BookOpen size={20} className="text-blue-600" />
                <h3 className="text-xl font-semibold">Quiz Details</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium mb-2">Title *</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-4 py-3 focus:border-blue-500"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <div className="border rounded-xl">
                    <TiptapEditor
                      content={description}
                      onChange={setDescription}
                      placeholder="Optional description…"
                      className="min-h-[120px] p-4"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Due Date</label>
                  <input
                    type="datetime-local"
                    className="w-full border rounded-xl px-4 py-3 focus:border-blue-500"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Questions */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Hash size={20} className="text-purple-600" />
                  <h3 className="text-xl font-semibold">Questions</h3>
                  <span className="text-sm text-gray-500">{questions.length}</span>
                </div>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"
                >
                  <Plus size={16} /> Add Question
                </button>
              </div>

              {questions.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-xl text-gray-500">
                  <Hash size={32} className="mx-auto mb-2" />
                  No questions yet. Click “Add Question” to start.
                </div>
              )}

              {questions.map((q, idx) => (
                <div key={q.id} className="border rounded-2xl p-6 mb-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                        {idx + 1}
                      </div>
                      <span className="font-semibold">Question {idx + 1}</span>
                    </div>
                    <button onClick={() => removeQuestion(q.id)} className="text-red-600 hover:text-red-800">
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Question Text */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Text *</label>
                    <input
                      type="text"
                      className="w-full border rounded-xl px-4 py-3 focus:border-blue-500"
                      value={q.text}
                      onChange={e => updateQuestion(q.id, "text", e.target.value)}
                    />
                  </div>

                  {/* Points */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Points *</label>
                    <input
                      type="number"
                      min={1}
                      className="w-32 border rounded-xl px-4 py-3 focus:border-blue-500"
                      value={q.points}
                      onChange={e => updateQuestion(q.id, "points", +e.target.value)}
                    />
                  </div>

                  {/* MCQ Options */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Options *</span>
                      <button
                        onClick={() => addOption(q.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                    {q.options.map((o, optIdx) => (
                      <div key={o.id} className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={o.isCorrect}
                          onChange={() => toggleCorrect(q.id, o.id)}
                          className="w-4 h-4 text-green-600"
                        />
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                          {String.fromCharCode(65 + optIdx)}
                        </div>
                        <input
                          type="text"
                          className="flex-1 border rounded-xl px-3 py-2"
                          value={o.text}
                          onChange={e => updateOption(q.id, o.id, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                        />
                        <button onClick={() => removeOption(q.id, o.id)} className="text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {q.options.length < 2 && (
                      <p className="text-sm text-red-600 flex items-center gap-2">
                        <AlertCircle size={14} />
                        At least two options required
                      </p>
                    )}
                    {!q.options.some(o => o.isCorrect) && q.options.length >= 2 && (
                      <p className="text-sm text-amber-600 flex items-center gap-2">
                        <AlertCircle size={14} />
                        Mark one correct answer
                      </p>
                    )}
                  </div>

                  {/* Feedback */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Feedback (Correct)</label>
                      <input
                        type="text"
                        className="w-full border rounded-xl px-4 py-3 focus:border-green-500"
                        value={q.feedbackCorrect}
                        onChange={e => updateQuestion(q.id, "feedbackCorrect", e.target.value)}
                        placeholder="Well done!"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Feedback (Incorrect)</label>
                      <input
                        type="text"
                        className="w-full border rounded-xl px-4 py-3 focus:border-red-500"
                        value={q.feedbackIncorrect}
                        onChange={e => updateQuestion(q.id, "feedbackIncorrect", e.target.value)}
                        placeholder="Try again."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Footer */}
            <div className="sticky bottom-0 bg-white/90 p-6 border-t flex items-center justify-between">
              <div>
                {!canSubmit && (
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <AlertCircle size={16} />
                    <span>Please complete all required fields</span>
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  {questions.length} question{questions.length !== 1 && 's'} • {completionPercent}% complete
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition ${
                  canSubmit
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Save size={20} />
                )}
                {isSubmitting ? "Creating…" : "Create Quiz"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
