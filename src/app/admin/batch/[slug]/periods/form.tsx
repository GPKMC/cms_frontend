"use client";

import React, { useEffect, useState } from "react";

interface Props {
  batchId: string;
  facultyId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchPeriodForm({ batchId, facultyId, open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    semesterOrYear: "",
    startDate: "",
    endDate: "",
    status: "not_started",
    description: "",
  });
  const [semesters, setSemesters] = useState<any[]>([]);
  const [batchInfo, setBatchInfo] = useState<{ batchname?: string }>({});
  const [facultyInfo, setFacultyInfo] = useState<{ name?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";

  // Fetch batch info by batchId
  useEffect(() => {
    if (!open || !batchId) return;

    fetch(`${baseUrl}/batch-api/batch/${batchId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.batch) setBatchInfo(data.batch);
      })
      .catch(() => setBatchInfo({}));
  }, [open, batchId]);

  // Fetch faculty info by facultyId
  useEffect(() => {
    if (!open || !facultyId) return;

    fetch(`${baseUrl}/faculty-api/faculties/${facultyId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.faculty) setFacultyInfo(data.faculty);
      })
      .catch(() => setFacultyInfo({}));
  }, [open, facultyId]);

  // Fetch semesters by facultyId
  useEffect(() => {
    if (!open || !facultyId) return;

    setForm({
      semesterOrYear: "",
      startDate: "",
      endDate: "",
      status: "not_started",
      description: "",
    });
    setFormError(null);

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
          console.error("Invalid JSON response for semesters:", text);
          setSemesters([]);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch semesters:", err);
        setSemesters([]);
      });
  }, [open, facultyId]);

  // Find selected semester/year object for endDate calculation
  const selectedSemesterOrYear = semesters.find((sy) => sy._id === form.semesterOrYear);

  // Auto-calc endDate based on startDate & semester/year type
  useEffect(() => {
    if (!form.startDate || !selectedSemesterOrYear) return;

    const start = new Date(form.startDate);
    const calculatedEndDate = new Date(start);

    if (selectedSemesterOrYear.semesterNumber) {
      // Semester: add 6 months
      calculatedEndDate.setMonth(calculatedEndDate.getMonth() + 6);
    } else if (selectedSemesterOrYear.yearNumber) {
      // Year: add 12 months
      calculatedEndDate.setFullYear(calculatedEndDate.getFullYear() + 1);
    } else {
      return;
    }

    const yyyy = calculatedEndDate.getFullYear();
    const mm = String(calculatedEndDate.getMonth() + 1).padStart(2, "0");
    const dd = String(calculatedEndDate.getDate()).padStart(2, "0");
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    // Update endDate every time startDate or semester/year changes
    setForm((prev) => ({ ...prev, endDate: formattedDate }));
  }, [form.startDate, selectedSemesterOrYear]);

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`${baseUrl}/batch-api/batchPeriod`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ ...form, batch: batchId }),
      });

      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (!res.ok) {
          setFormError(data.message || "Failed to add period");
        } else {
          onSuccess();
          onClose();
        }
      } catch {
        setFormError("Failed to parse response");
      }
    } catch {
      setFormError("Failed to add period");
    }
    setFormLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur">
      <div className="bg-white p-6 rounded-xl shadow-xl min-w-[320px] max-w-md w-full relative">
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-black text-xl"
          onClick={onClose}
          aria-label="Close modal"
        >
          &times;
        </button>

        <h2 className="mb-4 font-bold text-lg">Add Batch Period</h2>

        {/* Show batch and faculty info */}
        <div className="mb-4 space-y-1">
          <p>
            <strong>Batch:</strong> {batchInfo.batchname || "Loading..."}
          </p>
          <p>
            <strong>Faculty:</strong> {facultyInfo.name ? `${facultyInfo.name} (${facultyInfo.code})` : "Loading..."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-medium mb-1">Semester/Year</label>
            <select
              className="w-full border rounded px-3 py-2"
              required
              value={form.semesterOrYear}
              onChange={(e) => setForm({ ...form, semesterOrYear: e.target.value })}
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
            <label className="block font-medium mb-1">End Date (auto-calculated)</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={form.endDate}
              disabled
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
              value={form.description}
              rows={2}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {formError && <div className="text-red-600">{formError}</div>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded px-4 py-2 font-semibold hover:bg-blue-700"
            disabled={formLoading}
          >
            {formLoading ? "Adding..." : "Add Period"}
          </button>
        </form>
      </div>
    </div>
  );
}
