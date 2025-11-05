"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  HelpCircle,
  MoreVertical,
  Send,
  Users,
  Loader2,
  ArrowLeft,
  Pencil,
  Trash2,
  AlertCircle,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import QuestionEditForm from "../../../workspace/question/editQuestionForm";
import QuestionDetail from "./questiondetails";
import TeacherStudentWork from "./studentAnswer";

/** ====== Config ====== */
const API = process.env.NEXT_PUBLIC_BACKEND_URL;
const QUESTION_URL = (id: string) => `${API}/question/${id}`;
const CLASS_URL = (id: string) => `${API}/course-api/courseInstance/${id}`;

/** ====== Types ====== */
type User = {
  _id?: string;
  username?: string;
  name?: string;
  email?: string;
  role?: string;
};

type FileObj = { url: string; originalname?: string };

type Question = {
  _id: string;
  title: string;
  content?: string;
  points?: number;
  postedBy?: User;
  courseInstance?: string;
  topic?: string | null;
  media?: FileObj[];
  documents?: FileObj[];
  links?: string[];
  youtubeLinks?: string[];
  commentsDisabled?: boolean;
  mutedStudents?: string[];
  visibleTo?: string[];
  dueDate?: string;
  createdAt?: string;
};

type Answer = {
  _id: string;
  student?: User;
  text?: string;
  attachments?: FileObj[];
  createdAt?: string;
  pointsAwarded?: number;
};

/** ====== Auth (teacher-first) ====== */
function getTeacherToken(): string {
  let t =
    (typeof window !== "undefined" &&
      (localStorage.getItem("token_teacher") ??
        sessionStorage.getItem("token_teacher") ??
        localStorage.getItem("token") ??
        localStorage.getItem("authToken"))) ||
    "";
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  return t.trim();
}

function authHeaders(): HeadersInit {
  const token = getTeacherToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** ====== Page ====== */
export default function QuestionDetailsPage() {
  const router = useRouter();

  // ✅ Make params safe (avoid “possibly null”)
  const params = useParams<{ id: string; questionid: string }>() ?? {
    id: "",
    questionid: "",
  };

  const classId = params.id ?? "";
  const questionid = params.questionid ?? "";

  const [className, setClassName] = useState<string>("");

  // Data
  const [q, setQ] = useState<Question | null>(null);
  const [loadingQ, setLoadingQ] = useState(true);
  const [errQ, setErrQ] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  const [errA, setErrA] = useState<string | null>(null);

  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"question" | "answers">("question");

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Click outside to close kebab menu
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  // Fetch Question
  const loadQuestion = async () => {
    if (!questionid) {
      setErrQ("Missing question id");
      setLoadingQ(false);
      return;
    }

    try {
      setLoadingQ(true);
      setErrQ(null);
      const res = await fetch(QUESTION_URL(questionid), {
        headers: { "Content-Type": "application/json", ...authHeaders() },
        cache: "no-store",
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j?.error || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }
      const data = JSON.parse(text);
      setQ(data?.question || (data as Question));
    } catch (e: any) {
      setErrQ(e?.message || "Failed to load question.");
    } finally {
      setLoadingQ(false);
    }
  };

  const loadClassName = async () => {
    try {
      if (!classId) {
        setClassName("Unknown Class");
        return;
      }

      const res = await fetch(CLASS_URL(classId), {
        headers: { "Content-Type": "application/json", ...authHeaders() },
        cache: "no-store",
      });

      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j?.error || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      const data = JSON.parse(text);

      // Robustly pull the instance and name from various API shapes
      const ci = data?.instance || data?.courseInstance || data?.data || data;

      const name =
        ci?.course?.name ??
        ci?.course?.title ??
        ci?.name ??
        (ci?.batch && ci?.semester
          ? `Batch ${ci.batch} • Sem ${ci.semester}`
          : null) ??
        "Unknown Class";

      setClassName(name);
    } catch (e) {
      setClassName("Failed to load class name.");
    }
  };

  useEffect(() => {
    loadQuestion();
    loadClassName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionid]);

  // Delete
  const handleDelete = async () => {
    if (!questionid) return;
    try {
      const res = await fetch(QUESTION_URL(questionid), {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j?.error || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }
      toast.success("Question deleted");
      router.push(`/teacher/dashboard/class/${classId}/Details/Question`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete question");
    } finally {
      setConfirmOpen(false);
    }
  };

  const author =
    q?.postedBy?.username || q?.postedBy?.name || q?.postedBy?.email || "Unknown";
  const date =
    q?.createdAt &&
    new Date(q.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar with tabs */}
      <div className="border-b">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-8">
              <Tab
                label="Question"
                active={activeTab === "question"}
                onClick={() => setActiveTab("question")}
              />
              <Tab
                label={`Student answers${answers.length ? ` (${answers.length})` : ""}`}
                active={activeTab === "answers"}
                onClick={() => setActiveTab("answers")}
              />
            </div>

            <div className="text-sm text-gray-500">
              Class Name: <span className="font-mono">{className}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="">
        {activeTab === "question" ? (
          <div className="">
            {/* Question tab content */}
            <QuestionDetail questionId={questionid} classId={classId} />
          </div>
        ) : (
          <div className="">
            {/* Student answers tab content */}
            <TeacherStudentWork questionId={questionid} token={getTeacherToken()} />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && q && (
        <QuestionEditForm
          QuestionId={q._id}
          courseInstanceId={q.courseInstance as string}
          courseName={`Class ${classId}`}
          onSuccess={async () => {
            setShowEdit(false);
            await loadQuestion();
            toast.success("Question updated");
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}

      {/* Delete Confirm Modal */}
      {confirmOpen && (
        <ConfirmModal
          title="Delete question?"
          message="This action cannot be undone."
          confirmText="Delete"
          confirmTone="danger"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

/** ===== UI Bits ===== */
function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative pb-2 text-sm",
        active ? "text-blue-600" : "text-gray-600 hover:text-gray-900",
      ].join(" ")}
    >
      {label}
      {active && (
        <span className="absolute left-0 right-0 -bottom-[9px] h-0.5 bg-blue-600 rounded-full" />
      )}
    </button>
  );
}

function RowLoading({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{text}</span>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmText = "Confirm",
  confirmTone = "primary",
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmText?: string;
  confirmTone?: "primary" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-full ${
              confirmTone === "danger" ? "bg-red-100" : "bg-blue-100"
            }`}
          >
            <AlertCircle
              className={
                confirmTone === "danger" ? "text-red-600" : "text-blue-600"
              }
            />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-100">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={[
              "px-4 py-2 rounded text-white",
              confirmTone === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700",
            ].join(" ")}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
