"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, User, BookOpen } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import GroupAssignmentGroupsPanel from "./groupSubmission";

// Load client-only to avoid SSR clashes if the child uses client APIs
const GroupAssignmentDetail = dynamic(() => import("./details"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="mb-2 h-4 w-full animate-pulse rounded bg-gray-100" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
    </div>
  ),
});

const tabs = [
  { label: "Question / Instruction", key: "question", icon: BookOpen },
  { label: "Student Answer", key: "answer", icon: User },
] as const;

export default function GroupAssignmentDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string; groupAssignmentId: string }>();

  // Coerce params to strings (in case Next returns something union-y)
  const classId = String(params.id ?? "");
  const groupAssignmentId = String(params.groupAssignmentId ?? "");

  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("question");
  const [showConfirm, setShowConfirm] = useState(false);

  // Pull token + backend once (memoized)
  const token = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem("token") || undefined;
  }, []);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  // Close modal on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowConfirm(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleBack = () => {
    setShowConfirm(false);
    router.back();
  };

  return (
    <div>
      {/* Sticky toolbar */}
      <div className="sticky top-14 z-20 -mx-6 mb-6 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </button>

            {/* Segmented tabs */}
            <div className="flex items-center gap-1 rounded-xl border bg-white p-1 shadow-sm">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                      active ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* Main surface */}
      <div className="rounded-2xl p-0 shadow-sm">
        {activeTab === "question" ? (
          <div className="p-2 sm:p-2 lg:p-2">
            {/* Pass props to details */}
            <GroupAssignmentDetail
              classId={classId}
              groupAssignmentId={groupAssignmentId}
           
            />
          </div>
        ) : (
          <div className="p-6 lg:p-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">Student Answer</h2>
            {/* Pass props to the submissions/groups panel */}
            <GroupAssignmentGroupsPanel
              groupAssignmentId={groupAssignmentId}
              token={token}
              backendUrl={backendUrl}
            />
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Leave this page?</h3>
            <p className="mt-1 text-sm text-gray-600">You’ll return to the workspace.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                onClick={handleBack}
              >
                Yes, go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
