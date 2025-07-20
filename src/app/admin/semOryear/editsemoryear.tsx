"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { X } from "lucide-react";

type Faculty = {
  code: string;
  name?: string;
  type?: string;
  programLevel?: string;
  _id?: string;
};

type Course = {
  _id: string;
  name: string;
  code: string;
};

type SemesterDetail = {
  _id: string;
  name?: string;
  semesterName?: string;
  faculty: Faculty | null;
  description?: string;
  courses: Course[];
  semesterNumber?: number;
  yearNumber?: number;
};

interface Props {
  id: string;
  onClose: () => void;
  onUpdateSuccess?: () => void;
}

export default function SemesterOrYearEditForm({ id, onClose, onUpdateSuccess }: Props) {
  const [details, setDetails] = useState<SemesterDetail | null>(null);
  const [desc, setDesc] = useState("");
  const [semesterNumber, setSemesterNumber] = useState<number | "">("");
  const [yearNumber, setYearNumber] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const url = `${baseUrl}/sem-api/semesterOrYear`;

  // Auth
  const token = typeof window !== "undefined" ? localStorage.getItem("token_admin") : null;
  const axiosConfig = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  // Load semester/year details
  useEffect(() => {
    if (!token) return setError("Unauthorized: Please login.");

    async function fetchDetails() {
      setError(null);
      try {
        const res = await axios.get(`${url}/${id}`, axiosConfig);
        if (res.data.success) {
          setDetails(res.data.semester);
          setDesc(res.data.semester.description || "");
          setSemesterNumber(res.data.semester.semesterNumber ?? "");
          setYearNumber(res.data.semester.yearNumber ?? "");
        } else setError("Failed to fetch details");
      } catch {
        setError("Error fetching details");
      }
    }
    fetchDetails();
    // eslint-disable-next-line
  }, [id, token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: any = {
        description: desc,
      };
      if (details.faculty?.type === "semester") payload.semesterNumber = semesterNumber;
      if (details.faculty?.type === "yearly") payload.yearNumber = yearNumber;
      const res = await axios.patch(`${url}/${id}`, payload, axiosConfig);
      if (res.data.success) {
        setSuccess("Updated successfully!");
        if (onUpdateSuccess) onUpdateSuccess();
        setTimeout(onClose, 1500);
      } else {
        setError(res.data.message || "Update failed.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  if (!details) {
    return (
      <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-8 relative">
          <p className="text-center text-gray-600 text-lg font-medium">
            {error || "Loading..."}
          </p>
          <button
            className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-8 relative">
        <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-3">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit: {details.semesterName || details.name || ""}
          </h2>
          <button
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full p-1"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <p className="mb-4 text-red-600 font-semibold text-lg">{error}</p>
        )}
        {success && (
          <p className="mb-4 text-green-600 font-semibold text-lg">{success}</p>
        )}

        <form className="space-y-4" onSubmit={handleSave}>
          <div>
            <label className="block font-medium mb-1">Faculty</label>
            <div className="px-3 py-2 rounded bg-gray-100 text-gray-900 border">
              {details.faculty?.code} {details.faculty?.name && `(${details.faculty.name})`} [{details.faculty?.type}]
            </div>
          </div>

          {details.faculty?.type === "semester" && (
            <div>
              <label className="block font-medium mb-1">
                Semester Number <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={8}
                className="w-full px-3 py-2 border rounded"
                value={semesterNumber}
                onChange={e => setSemesterNumber(Number(e.target.value))}
                required
              />
            </div>
          )}

          {details.faculty?.type === "yearly" && (
            <div>
              <label className="block font-medium mb-1">
                Year Number <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={4}
                className="w-full px-3 py-2 border rounded"
                value={yearNumber}
                onChange={e => setYearNumber(Number(e.target.value))}
                required
              />
            </div>
          )}

          <div>
            <label className="block font-medium mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded"
              rows={2}
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Courses</label>
            <ul className="text-gray-900 list-disc ml-6">
              {details.courses && details.courses.length > 0
                ? details.courses.map(c => (
                    <li key={c._id}>
                      {c.code} - {c.name}
                    </li>
                  ))
                : <li>-</li>}
            </ul>
            <div className="text-xs text-gray-500 mt-1">
              (Courses are managed automatically; you cannot edit them here.)
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              className="flex-1 py-2 px-4 border border-gray-400 rounded font-semibold hover:bg-gray-100"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
