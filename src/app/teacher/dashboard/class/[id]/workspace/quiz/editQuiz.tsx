"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import toast, { Toaster } from "react-hot-toast";
import {
  X, Hash, Plus, Trash2, AlertCircle, BookOpen, CalendarClock,
  ToggleLeft, ToggleRight, Check, Save as SaveIcon
} from "lucide-react";

type TiptapEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

const TiptapEditor = dynamic<TiptapEditorProps>(
  () => import("../quiz/rtecomponent"),
  { ssr: false }
);

/* ================= Types from API ================= */
type OptionDoc = { _id: string; text: string };
type QuestionDoc = {
  _id: string;
  text: string;
  type: "mcq";
  points: number;
  options: OptionDoc[];
  correctOption?: string | null;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
};
type QuizDoc = {
  _id: string;
  title: string;
  description?: string;
  courseInstance: string;
  dueDate?: string | null;
  published?: boolean;
  questions: QuestionDoc[];
};

/* ============== Local types for new Qs ============= */
type NewOption = { id: string; text: string; isCorrect: boolean };
type NewQuestion = {
  id: string;
  text: string;
  points: number;
  options: NewOption[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
};
const uid = () => Math.random().toString(36).slice(2, 10);

/* ===== Helpers for editing existing questions ===== */
type DraftOption = { key: string; text: string; _id?: string };
type DraftQuestion = {
  text: string;
  points: number;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
  options: DraftOption[];
  correctKey: string | null;
};

function qToDraft(q: QuestionDoc): DraftQuestion {
  return {
    text: q.text,
    points: q.points,
    feedbackCorrect: q.feedbackCorrect || "",
    feedbackIncorrect: q.feedbackIncorrect || "",
    options: q.options.map(o => ({ key: o._id, _id: o._id, text: o.text })),
    correctKey: q.correctOption ?? null,
  };
}

/* =============== Robust error parser =============== */
async function getErrorMessage(res: Response) {
  try {
    const data = await res.clone().json() as any;
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
    if (Array.isArray(data?.errors) && data.errors.length) {
      const parts = data.errors
        .map((e: any) => e?.msg || e?.message || e?.param || "")
        .filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
    if (data?.errors && typeof data.errors === "object") {
      const parts = Object.values<any>(data.errors)
        .map((e) => e?.message || e)
        .filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
  } catch {}
  try {
    const text = await res.clone().text();
    if (text) return text;
  } catch {}
  return res.statusText || `HTTP ${res.status}`;
}

/* ================= Modal wrapper ================== */
const Modal = ({
  isOpen, onClose, children
}: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/45 h-full border backdrop-blur-md p-3">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full z-10"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
};

/* ================== Main Component ================= */
export default function QuizEditForm({
  quizId,
  courseInstanceId,
  courseName,
  onSuccess,
  onCancel,
}: {
  quizId: string;
  courseInstanceId: string;
  courseName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const QUIZ_BASE =
    `${process.env.NEXT_PUBLIC_BACKEND_URL}${process.env.NEXT_PUBLIC_QUIZ_BASE ?? "/quizrouter"}`;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // metadata
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [published, setPublished] = useState(false);

  // existing questions
  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [correctMap, setCorrectMap] = useState<Record<string, string | null>>({});

  // per-question edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftQuestion>>({});
  const structureLocked = published;

  // new questions (saved only by Save changes)
  const [newQs, setNewQs] = useState<NewQuestion[]>([]);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher") ||
        ""
      : "";

  useEffect(() => setMounted(true), []);

  const blockEnter = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
  };

  // Load quiz
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${QUIZ_BASE}/${quizId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data: QuizDoc = await res.json();
        if (!res.ok) {
          toast.error(await getErrorMessage(res));
          return;
        }
        setTitle(data.title || "");
        setDescription(data.description || "");
        setDueDate(
          data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 16) : ""
        );
        setPublished(Boolean(data.published));
        setQuestions(data.questions || []);

        const map: Record<string, string | null> = {};
        (data.questions || []).forEach(q => {
          map[q._id] = (q.correctOption as string) || null;
        });
        setCorrectMap(map);
        setEditingId(null);
        setDrafts({});
      } catch (e: any) {
        toast.error(e?.message || "Unable to load quiz");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, quizId]);

  /* =========== NEW question helpers =========== */
  const addNewQuestion = () =>
    setNewQs(prev => [
      ...prev,
      {
        id: uid(),
        text: "",
        points: 1,
        options: [
          { id: uid(), text: "", isCorrect: false },
          { id: uid(), text: "", isCorrect: false },
        ],
        feedbackCorrect: "",
        feedbackIncorrect: "",
      },
    ]);
  const removeNewQuestion = (qid: string) =>
    setNewQs(prev => prev.filter(q => q.id !== qid));
  const updateNewQ = (qid: string, patch: Partial<NewQuestion>) =>
    setNewQs(prev => prev.map(q => (q.id === qid ? { ...q, ...patch } : q)));
  const addNewOption = (qid: string) =>
    setNewQs(prev =>
      prev.map(q =>
        q.id !== qid
          ? q
          : { ...q, options: [...q.options, { id: uid(), text: "", isCorrect: false }] }
      )
    );
  const updateNewOption = (qid: string, oid: string, text: string) =>
    setNewQs(prev =>
      prev.map(q =>
        q.id !== qid
          ? q
          : {
              ...q,
              options: q.options.map(o => (o.id === oid ? { ...o, text } : o)),
            }
      )
    );
  const toggleNewCorrect = (qid: string, oid: string) =>
    setNewQs(prev =>
      prev.map(q =>
        q.id !== qid
          ? q
          : {
              ...q,
              options: q.options.map(o => ({ ...o, isCorrect: o.id === oid })),
            }
      )
    );
  const removeNewOption = (qid: string, oid: string) =>
    setNewQs(prev =>
      prev.map(q =>
        q.id !== qid ? q : { ...q, options: q.options.filter(o => o.id !== oid) }
      )
    );

  const canSaveNewQs = newQs.every(
    (q) =>
      q.text.trim() &&
      q.points > 0 &&
      q.options.length >= 2 &&
      q.options.some((o) => o.isCorrect) &&
      q.options.every((o) => o.text.trim())
  );

  /* ================== Publish toggle ================== */
  async function handleTogglePublish() {
    if (publishing) return;
    try {
      setPublishing(true);
      const next = !published;
      const res = await fetch(`${QUIZ_BASE}/${quizId}/publish`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) {
        toast.error(await getErrorMessage(res));
        return;
      }
      setPublished(next);
      toast.success(next ? "Quiz published" : "Quiz unpublished");
    } catch (e: any) {
      toast.error(e?.message || "Could not change publish state");
    } finally {
      setPublishing(false);
    }
  }

  /* =================== Save quiz (meta + new) =================== */
  async function handleSave() {
    try {
      if (!title.trim()) {
        toast.error("Title is required");
        return;
      }
      if (dueDate) {
        const ts = new Date(dueDate).getTime();
        if (isNaN(ts) || ts <= Date.now()) {
          toast.error("Due date must be in the future.");
          return;
        }
      }

      setSaving(true);

      // 1) Update metadata
      const metaPayload: any = { title, description };
      if (dueDate) metaPayload.dueDate = new Date(dueDate).toISOString();

      const metaRes = await fetch(`${QUIZ_BASE}/${quizId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(metaPayload),
      });
      if (!metaRes.ok) {
        // If your backend doesn’t have this route yet:
        if (metaRes.status === 404) {
          toast("⚠️ Metadata route missing; skipped metadata update.");
        } else {
          toast.error(await getErrorMessage(metaRes));
          return;
        }
      }

      // 2) ONLY update correctOption for non-editing questions
      for (const q of questions) {
        if (editingId === q._id) continue; // being edited separately
        const chosen = correctMap[q._id] || null;
        const original = (q.correctOption as string) || null;
        if (chosen && chosen !== original) {
          const res = await fetch(`${QUIZ_BASE}/${quizId}/questions/${q._id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ correctOption: chosen }),
          });
          if (!res.ok) {
            toast.error(await getErrorMessage(res));
            return;
          }
        }
      }

      // 3) Add new MCQs
      if (newQs.length > 0) {
        if (!canSaveNewQs) {
          toast.error("Fix new question validations first.");
          return;
        }
        for (const nq of newQs) {
          const createQRes = await fetch(`${QUIZ_BASE}/${quizId}/questions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: nq.text,
              type: "mcq",
              points: nq.points,
              options: nq.options.map((o) => ({ text: o.text })),
              feedbackCorrect: nq.feedbackCorrect,
              feedbackIncorrect: nq.feedbackIncorrect,
            }),
          });
          if (!createQRes.ok) {
            toast.error(await getErrorMessage(createQRes));
            return;
          }
          const updatedQuiz: QuizDoc = await createQRes.json();
          const justAdded = updatedQuiz.questions.find((qq) => qq.text === nq.text);
          if (!justAdded) {
            toast.error("Could not locate newly created question");
            return;
          }
          const correctIdx = nq.options.findIndex((o) => o.isCorrect);
          if (correctIdx >= 0) {
            const correctOptionId = justAdded.options[correctIdx]?._id;
            if (correctOptionId) {
              const patchRes = await fetch(
                `${QUIZ_BASE}/${quizId}/questions/${justAdded._id}`,
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
                toast.error(await getErrorMessage(patchRes));
                return;
              }
            }
          }
        }
      }

      toast.success("Quiz updated ✅");
      onSuccess?.();
      onCancel?.();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  /* ============== Per-question edit controls ============== */
  function startEditQuestion(q: QuestionDoc) {
    setEditingId(q._id);
    setDrafts(prev => ({ ...prev, [q._id]: qToDraft(q) }));
  }
  function cancelEditQuestion(qid: string) {
    setEditingId(null);
    setDrafts(prev => {
      const { [qid]: _, ...rest } = prev;
      return rest;
    });
  }
  function updateDraft(qid: string, patch: Partial<DraftQuestion>) {
    setDrafts(prev => ({ ...prev, [qid]: { ...prev[qid], ...patch } as DraftQuestion }));
  }
  function updateDraftOption(qid: string, key: string, text: string) {
    setDrafts(prev => {
      const d = prev[qid];
      return {
        ...prev,
        [qid]: {
          ...d,
          options: d.options.map(o => (o.key === key ? { ...o, text } : o)),
        },
      };
    });
  }
  function addDraftOption(qid: string) {
    setDrafts(prev => {
      const d = prev[qid];
      return {
        ...prev,
        [qid]: { ...d, options: [...d.options, { key: uid(), text: "" }] },
      };
    });
  }
  function removeDraftOption(qid: string, key: string) {
    setDrafts(prev => {
      const d = prev[qid];
      return {
        ...prev,
        [qid]: { ...d, options: d.options.filter(o => o.key !== key) },
      };
    });
  }
  function selectDraftCorrect(qid: string, key: string) {
    setDrafts(prev => ({ ...prev, [qid]: { ...prev[qid], correctKey: key } }));
  }

  async function saveSingleQuestion(qid: string, e?: React.MouseEvent) {
    // 🚫 absolutely prevent any ancestor form submit
    e?.preventDefault();
    e?.stopPropagation();

    const d = drafts[qid];
    if (!d) return;

    if (!d.text.trim()) { toast.error("Question text is required"); return; }
    if (d.points <= 0) { toast.error("Points must be greater than 0"); return; }
    if (d.options.length < 2) { toast.error("At least two options are required"); return; }
    if (!d.options.every(o => o.text.trim())) { toast.error("All options must have text"); return; }

    if (structureLocked) {
      const orig = questions.find(q => q._id === qid);
      if (!orig) return;
      if (d.options.length !== orig.options.length) {
        toast.error("Published quiz: cannot add or remove options");
        return;
      }
      const missingAnyId = d.options.some(o => !o._id);
      if (missingAnyId) {
        toast.error("Published quiz: cannot add new options");
        return;
      }
    }

    const correctIdx = d.options.findIndex(o => o.key === d.correctKey);
    const correctExistingId =
      correctIdx >= 0 ? d.options[correctIdx]._id || null : null;

    try {
      const firstBody: any = {
        text: d.text,
        points: d.points,
        feedbackCorrect: d.feedbackCorrect || "",
        feedbackIncorrect: d.feedbackIncorrect || "",
        options: d.options.map(o =>
          o._id ? { _id: o._id, text: o.text } : { text: o.text }
        ),
      };
      if (correctExistingId) firstBody.correctOption = correctExistingId;

      const res = await fetch(`${QUIZ_BASE}/${quizId}/questions/${qid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(firstBody),
      });

      if (!res.ok) {
        toast.error(await getErrorMessage(res));
        return;
      }

      const updated: QuestionDoc = await res.json();

      if (!correctExistingId && correctIdx >= 0) {
        const newCorrectId = updated.options[correctIdx]?._id;
        if (newCorrectId) {
          const res2 = await fetch(`${QUIZ_BASE}/${quizId}/questions/${qid}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ correctOption: newCorrectId }),
          });
          if (!res2.ok) {
            toast.error(await getErrorMessage(res2));
            return;
          }
          updated.correctOption = newCorrectId;
        }
      }

      setQuestions(prev => prev.map(q => (q._id === qid ? updated : q)));
      setCorrectMap(prev => ({ ...prev, [qid]: updated.correctOption ?? null }));
      setEditingId(null);
      setDrafts(prev => {
        const { [qid]: _, ...rest } = prev;
        return rest;
      });

      toast.success("Question updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save question");
    }
  }

  async function deleteSingleQuestion(qid: string) {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    try {
      const res = await fetch(`${QUIZ_BASE}/${quizId}/questions/${qid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error(await getErrorMessage(res));
        return;
      }
      setQuestions(prev => prev.filter(q => q._id !== qid));
      setEditingId(null);
      setDrafts(prev => {
        const { [qid]: _, ...rest } = prev;
        return rest;
      });
      toast.success("Question deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  }

  if (!mounted || loading) return <div>Loading...</div>;

  return (
    <Modal isOpen={true} onClose={() => onCancel?.()}>
      {/* ⬇️ NO <form> — nothing auto-submits */}
      <div className="flex flex-col h-[92vh] bg-white max-h-[92vh] w-full overflow-hidden">
        <Toaster position="top-right" />

        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 to-fuchsia-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={22} />
              <div>
                <h2 className="text-2xl font-bold">Edit Quiz</h2>
                <p className="text-indigo-200 text-sm">for {courseName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleTogglePublish}
                disabled={publishing}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${
                  published
                    ? "bg-emerald-600 text-white border-emerald-700"
                    : "bg-white/10 text-white border-white/30"
                } ${publishing ? "opacity-70 cursor-not-allowed" : "hover:bg-white/20"}`}
                title={published ? "Unpublish" : "Publish"}
              >
                {published ? <ToggleRight /> : <ToggleLeft />}
                <span>{published ? "Published" : "Unpublished"}</span>
              </button>
              <div className="flex items-center gap-2 opacity-90">
                <CalendarClock size={18} />
                <span className="text-sm">
                  Due: {dueDate ? new Date(dueDate).toLocaleString() : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-6 py-6 gap-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: metadata & description */}
            <div className="lg:col-span-2 min-w-0">
              <input
                className="w-full text-xl bg-gray-100 rounded p-3 border-b-2 border-indigo-400 focus:outline-none mb-3"
                placeholder="Quiz Title*"
                required
                value={title}
                onKeyDown={blockEnter}
                onChange={e => setTitle(e.target.value)}
              />
              <div className="border-2 rounded-lg bg-gray-50 focus-within:border-indigo-300">
                <div className="p-3 pb-0">
                  <div className="text-sm text-gray-600 mb-2">Description</div>
                  <TiptapEditor
                    content={description}
                    onChange={setDescription}
                    placeholder="Optional description…"
                    className="min-h-[140px] p-2"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT: sidebar */}
            <div className="w-full flex flex-col gap-5 bg-gray-50 rounded-2xl border border-gray-200 p-6">
              <div>
                <div className="text-gray-600 font-semibold mb-1">Course</div>
                <div className="bg-white rounded p-3 text-indigo-800 font-medium border text-center">
                  {courseName}
                </div>
              </div>
              <div>
                <div className="text-gray-600 font-semibold mb-1">Due Date</div>
                <input
                  type="datetime-local"
                  className="w-full bg-white rounded p-3 border"
                  value={dueDate}
                  onKeyDown={blockEnter}
                  onChange={e => setDueDate(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Must be in the future (backend enforces this).
                </div>
              </div>
            </div>
          </div>

          {/* Existing Questions */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Hash size={20} className="text-fuchsia-600" />
              <h3 className="text-lg font-semibold">Existing Questions</h3>
              <span className="text-sm text-gray-500">{questions.length}</span>
            </div>

            {questions.length === 0 && (
              <div className="text-sm text-gray-500 border rounded-xl p-4">
                No questions yet.
              </div>
            )}

            {questions.map((q, idx) => {
              const isEditing = editingId === q._id;
              const d = drafts[q._id];

              return (
                <div key={q._id} className="border rounded-2xl p-6 mb-6 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-lg flex items-center justify-center text-white">
                        {idx + 1}
                      </div>
                      {!isEditing ? (
                        <div>
                          <div className="font-semibold">{q.text}</div>
                          <div className="text-xs text-gray-500">Points: {q.points}</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            className="w-full border rounded px-3 py-2"
                            value={d.text}
                            onKeyDown={blockEnter}
                            onChange={(e) => updateDraft(q._id, { text: e.target.value })}
                            placeholder="Question text"
                          />
                          <input
                            type="number"
                            min={1}
                            className="w-32 border rounded px-3 py-2"
                            value={d.points}
                            onKeyDown={blockEnter}
                            onChange={(e) =>
                              updateDraft(q._id, { points: Math.max(1, Number(e.target.value || 0)) })
                            }
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {!isEditing ? (
                        <>
                          <button
                            type="button"
                            className="px-3 py-1 rounded-md border text-blue-700 border-blue-300 hover:bg-blue-50"
                            onClick={() => startEditQuestion(q)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1 rounded-md border text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => deleteSingleQuestion(q._id)}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={(e) => saveSingleQuestion(q._id, e)} // ← stops default/prop
                          >
                            <SaveIcon size={16} /> Save question
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1 rounded-md border text-gray-700 border-gray-300 hover:bg-gray-50"
                            onClick={() => cancelEditQuestion(q._id)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Options */}
                  {!isEditing ? (
                    <>
                      <div className="mt-4 space-y-2">
                        {q.options.map((o, oi) => {
                          const selected = (correctMap[q._id] || null) === o._id;
                          return (
                            <label key={o._id} className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`correct-${q._id}`}
                                checked={selected}
                                onChange={() =>
                                  setCorrectMap((m) => ({ ...m, [q._id]: o._id }))
                                }
                                className="w-4 h-4"
                              />
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                {String.fromCharCode(65 + oi)}
                              </div>
                              <span className="text-sm">{o.text}</span>
                              {selected && <Check className="ml-2" size={16} />}
                            </label>
                          );
                        })}
                      </div>

                      <div className="mt-3 text-xs text-amber-600 flex items-center gap-2">
                        <AlertCircle size={14} />
                        Click “Edit” to change text/options. Selecting a radio only changes the correct answer.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-4 space-y-2">
                        {d.options.map((o, oi) => {
                          const selected = d.correctKey === o.key;
                          return (
                            <div key={o.key} className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`draft-correct-${q._id}`}
                                checked={selected}
                                onChange={() => selectDraftCorrect(q._id, o.key)}
                                className="w-4 h-4"
                              />
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                {String.fromCharCode(65 + oi)}
                              </div>
                              <input
                                className="flex-1 border rounded px-3 py-2"
                                value={o.text}
                                onKeyDown={blockEnter}
                                onChange={(e) => updateDraftOption(q._id, o.key, e.target.value)}
                                placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              />
                              {!structureLocked && (
                                <button
                                  type="button"
                                  className="text-red-600"
                                  onClick={() => removeDraftOption(q._id, o.key)}
                                  title="Remove option"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {!structureLocked && (
                          <button
                            type="button"
                            onClick={() => addDraftOption(q._id)}
                            className="inline-flex items-center gap-2 text-green-700 hover:text-green-800"
                          >
                            <Plus size={16} /> Add option
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Feedback (Correct)
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded-xl px-4 py-3 focus:border-emerald-500"
                            value={d.feedbackCorrect}
                            onKeyDown={blockEnter}
                            onChange={(e) =>
                              updateDraft(q._id, { feedbackCorrect: e.target.value })
                            }
                            placeholder="Well done!"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Feedback (Incorrect)
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded-xl px-4 py-3 focus:border-emerald-500"
                            value={d.feedbackIncorrect}
                            onKeyDown={blockEnter}
                            onChange={(e) =>
                              updateDraft(q._id, { feedbackIncorrect: e.target.value })
                            }
                            placeholder="Try again."
                          />
                        </div>
                      </div>

                      {structureLocked && (
                        <div className="mt-3 text-xs text-amber-600 flex items-center gap-2">
                          <AlertCircle size={14} />
                          Quiz is published: you can edit text and the correct answer,
                          but you cannot add or remove options.
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add New Questions (saved via Save changes only) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Hash size={20} className="text-emerald-600" />
                <h3 className="text-lg font-semibold">Add New Questions</h3>
                <span className="text-sm text-gray-500">{newQs.length}</span>
              </div>
              <button
                type="button"
                onClick={() => addNewQuestion()}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700"
              >
                <Plus size={16} /> Add Question
              </button>
            </div>

            {newQs.map((q, idx) => (
              <div key={q.id} className="border rounded-2xl p-6 mb-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white">
                      {idx + 1}
                    </div>
                    <span className="font-semibold">New MCQ</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNewQuestion(q.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Text *</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-4 py-3 focus:border-emerald-500"
                    value={q.text}
                    onKeyDown={blockEnter}
                    onChange={(e) => updateNewQ(q.id, { text: e.target.value })}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Points *</label>
                  <input
                    type="number"
                    min={1}
                    className="w-32 border rounded-xl px-4 py-3 focus:border-emerald-500"
                    value={q.points}
                    onKeyDown={blockEnter}
                    onChange={(e) =>
                      updateNewQ(q.id, { points: Math.max(1, Number(e.target.value || 0)) })
                    }
                  />
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Options *</span>
                    <button
                      type="button"
                      onClick={() => addNewOption(q.id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>

                  {q.options.map((o, optIdx) => (
                    <div key={o.id} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={`new-correct-${q.id}`}
                        checked={o.isCorrect}
                        onChange={() => toggleNewCorrect(q.id, o.id)}
                        className="w-4 h-4"
                      />
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        {String.fromCharCode(65 + optIdx)}
                      </div>
                      <input
                        type="text"
                        className="flex-1 border rounded-xl px-3 py-2"
                        value={o.text}
                        onKeyDown={blockEnter}
                        onChange={(e) => updateNewOption(q.id, o.id, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeNewOption(q.id, o.id)}
                        className="text-red-600"
                      >
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
                  {!q.options.some((o) => o.isCorrect) && q.options.length >= 2 && (
                    <p className="text-sm text-amber-600 flex items-center gap-2">
                      <AlertCircle size={14} />
                      Mark one correct answer
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Feedback (Correct)
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded-xl px-4 py-3 focus:border-emerald-500"
                      value={q.feedbackCorrect}
                      onKeyDown={blockEnter}
                      onChange={(e) =>
                        updateNewQ(q.id, { feedbackCorrect: e.target.value })
                      }
                      placeholder="Well done!"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Feedback (Incorrect)
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded-xl px-4 py-3 focus:border-emerald-500"
                      value={q.feedbackIncorrect}
                      onKeyDown={blockEnter}
                      onChange={(e) =>
                        updateNewQ(q.id, { feedbackIncorrect: e.target.value })
                      }
                      placeholder="Try again."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-white py-4 px-8 flex justify-between items-center sticky bottom-0 z-20">
          <button
            type="button"
            className="text-gray-500 text-sm hover:text-gray-700"
            onClick={() => onCancel?.()}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => !saving && handleSave()}  // ← only this calls the bulk save
            disabled={saving || !title.trim() || (newQs.length > 0 && !canSaveNewQs)}
            className="bg-indigo-600 text-white px-8 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
