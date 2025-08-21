"use client";

import { useEffect, useState } from "react";

export type StudentLite = { _id: string; name?: string; username?: string; email?: string };

type Props = {
  batchId?: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Provide a fetcher so you can plug your own endpoint easily */
  fetchStudents: (batchId: string) => Promise<StudentLite[]>;
  label?: string;
  placeholder?: string;
};

export default function StudentSelect({
  batchId,
  value,
  onChange,
  disabled,
  fetchStudents,
  label = "Student",
  placeholder = "Select student",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    (async () => {
      if (!batchId) {
        setStudents([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const list = await fetchStudents(batchId);
        if (!stop) setStudents(list);
      } catch (e: any) {
        if (!stop) {
          setStudents([]);
          setError(e?.message || "Failed to load students");
        }
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [batchId, fetchStudents]);

  const labelOf = (s: StudentLite) => s.username || s.email || s.name || s._id;

  return (
    <div>
      <label className="text-xs text-slate-600">{label}</label>
      <div className="relative">
        <select
          className="w-full border rounded-lg px-3 py-2 text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
          disabled={!batchId || disabled || loading}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {!batchId && <option value="">{placeholder}</option>}
          {batchId && loading && <option value="">Loading students…</option>}
          {batchId && !loading && students.length === 0 && <option value="">No students found</option>}
          {batchId &&
            !loading &&
            students.map((s) => (
              <option key={s._id} value={s._id}>
                {labelOf(s)}
              </option>
            ))}
        </select>
      </div>
      {error ? <div className="mt-1 text-xs text-rose-600">{error}</div> : null}
    </div>
  );
}
