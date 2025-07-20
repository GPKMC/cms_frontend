"use client";

import React, { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  batchId: string;
  facultyId: string;
  initialData: any;
  loading: boolean;
  error: string | null;
  onSuccess: () => void;
}

export default function BatchPeriodEditForm({
  open,
  onClose,
  batchId,
  facultyId,
  initialData,
  loading,
  error,
  onSuccess,
}: Props) {
  const [form, setForm] = useState({
    semesterOrYear: "",
    startDate: "",
    endDate: "",
    status: "not_started",
    description: "",
  });
  const [semesters, setSemesters] = useState<any[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const token = typeof window !== "undefined" ? localStorage.getItem("token_admin") : "";

  // Load initial data into form when modal opens or initialData changes
  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        semesterOrYear: initialData.semesterOrYear?._id || "",
        startDate: initialData.startDate ? initialData.startDate.slice(0, 10) : "",
        endDate: initialData.endDate ? initialData.endDate.slice(0, 10) : "",
        status: initialData.status || "not_started",
        description: initialData.description || "",
      });
      setFormError(null);
    }
  }, [open, initialData]);

  // Fetch semesters by facultyId
  useEffect(() => {
    if (!open || !facultyId) return;

    fetch(`${baseUrl}/sem-api/semesterOrYear?faculty=${facultyId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
    })
      .then(async (res) => {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setSemesters(data.semesters || []);
        } catch {
          setSemesters([]);
        }
      })
      .catch(() => setSemesters([]));
  }, [open, facultyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`${baseUrl}/batch-api/batchPeriod/${initialData._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ ...form }),
      });

      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (!res.ok) {
          setFormError(data.message || "Failed to update period");
        } else {
          onSuccess();
          onClose();
        }
      } catch {
        setFormError("Failed to parse response");
      }
    } catch {
      setFormError("Failed to update period");
    }
    setFormLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur">
      <div className="bg-white p-6 rounded-xl shadow-xl min-w-[320px] max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-black text-xl"
          aria-label="Close modal"
        >
          &times;
        </button>
        <h2 className="mb-4 font-bold text-lg">Edit Batch Period</h2>

        {error && <div className="mb-3 text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-medium mb-1">Semester/Year</label>
            <select
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={form.semesterOrYear}
              disabled
              onChange={() => {}} // Disabled, so no change handler needed
            >
              <option value="">Select Semester/Year</option>
              {semesters.map((sy) => (
                <option key={sy._id} value={sy._id}>
                  {sy.name ||
                    (sy.semesterNumber
                      ? `Semester ${sy.semesterNumber}`
                      : sy.yearNumber
                      ? `Year ${sy.yearNumber}`
                      : sy._id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Start Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">End Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              required
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Status</label>
            <select
              className="w-full border rounded px-3 py-2"
              required
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="not_started">Not Started</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {formError && <div className="text-red-600">{formError}</div>}

          <button
            type="submit"
            className="w-full bg-yellow-500 text-white rounded px-4 py-2 font-semibold hover:bg-yellow-600"
            disabled={formLoading}
          >
            {formLoading ? "Updating..." : "Update Period"}
          </button>
        </form>
      </div>
    </div>
  );
}
