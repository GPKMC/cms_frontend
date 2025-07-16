"use client";

import React, { useEffect, useState, useCallback, FormEvent } from "react";
import axios from "axios";

type FacultyType = "semester" | "yearly";

interface Faculty {
  _id: string;
  code: string;
  name: string;
  type: FacultyType;
  totalSemestersOrYears: number;
}

interface Batch {
  _id: string;
  batchname: string;
  faculty: string;
  startYear?: number;
}

interface SemesterOrYear {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  faculty: Faculty;
  batch: Batch;
  semesterNumber?: number;
  yearNumber?: number;
  startDate?: string;
  endDate?: string;
  status: "not_started" | "ongoing" | "completed";
  courses: string[];
}

type Toast = {
  id: string;
  message: string;
  type: "success" | "error";
};

interface Props {
  id: string;
  onClose: () => void;
  onUpdateSuccess?: () => void;
}

export default function SemesterOrYearEditForm({ id, onClose, onUpdateSuccess }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const getUrl = `${baseUrl}/sem-api/semesterOrYear/${id}`;
  const patchUrl = `${baseUrl}/sem-api/semesterOrYear/${id}`;

  // State for form fields
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [description, setDescription] = useState("");
  const [semesterNumber, setSemesterNumber] = useState<number | "">("");
  const [yearNumber, setYearNumber] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState<SemesterOrYear["status"]>("not_started");
  const [courses, setCourses] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast helper
  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 10000);
  }, []);

  // Fetch existing data on mount
useEffect(() => {
  setFetching(true);
  axios.get(getUrl)
    .then((res) => {
      // Try to find data in possible places
      const data = res.data.semesterOrYear || res.data.semester || res.data;
      if (data && Object.keys(data).length > 0) {
        setFaculty(data.faculty);
        setBatch(data.batch);
        setDescription(data.description || "");
        setSemesterNumber(data.semesterNumber ?? "");
        setYearNumber(data.yearNumber ?? "");
        setStartDate(data.startDate ? data.startDate.split("T")[0] : "");
        setStatus(data.status || "not_started");
        setCourses(data.courses || []);
      } else {
        console.error("API returned failure or empty data:", res.data);
        addToast("Failed to load semester/year data", "error");
      }
    })
    .catch((err) => {
      console.error("Error fetching semester/year data:", err);
      addToast("Error fetching semester/year data", "error");
    })
    .finally(() => setFetching(false));
}, [getUrl, addToast]);


  if (fetching) return <div className="p-6 text-center">Loading data...</div>;

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!faculty) {
      addToast("Faculty info missing", "error");
      return;
    }

    if (
      faculty.type === "semester" &&
      (semesterNumber === "" || semesterNumber < 1 || semesterNumber > faculty.totalSemestersOrYears)
    ) {
      addToast(`Semester number must be between 1 and ${faculty.totalSemestersOrYears}`, "error");
      return;
    }

    if (
      faculty.type === "yearly" &&
      (yearNumber === "" || yearNumber < 1 || yearNumber > faculty.totalSemestersOrYears)
    ) {
      addToast(`Year number must be between 1 and ${faculty.totalSemestersOrYears}`, "error");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        description,
        startDate: startDate || undefined,
        status,
        courses,
      };

      if (faculty.type === "semester") {
        payload.semesterNumber = semesterNumber;
        payload.yearNumber = undefined;
      } else {
        payload.yearNumber = yearNumber;
        payload.semesterNumber = undefined;
      }

      const res = await axios.patch(patchUrl, payload);

      if (res.data.success) {
        addToast("Semester/Year updated successfully", "success");
        if (onUpdateSuccess) onUpdateSuccess();
        else onClose();
      } else {
        addToast(res.data.message || "Failed to update", "error");
      }
    } catch (error: any) {
      addToast(error?.response?.data?.message || "Failed to update", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[9999] p-4">
    <div className="bg-white rounded-lg p-6 max-w-lg w-full relative max-h-[90vh] overflow-auto">
      {/* Toasts */}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-xs px-4 py-2 rounded shadow text-white ${
              t.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 font-bold text-xl"
        aria-label="Close"
        type="button"
      >
        &times;
      </button>

      <h2 className="text-xl font-bold mb-4 text-center">Edit Semester / Year</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Faculty & Batch side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Faculty</label>
            <input
              type="text"
              readOnly
              value={faculty?.code || ""}
              className="w-full px-3 py-2 border rounded bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Batch</label>
            <input
              type="text"
              readOnly
              value={batch?.batchname || ""}
              className="w-full px-3 py-2 border rounded bg-gray-100 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Row 2: Start Date, Status, Semester/Year Number */}
        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="block font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SemesterOrYear["status"])}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="not_started">Not Started</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            {(faculty?.type === "semester") && (
              <>
                <label className="block font-medium mb-1">Semester Number</label>
                <input
                  type="number"
                  min={1}
                  max={faculty.totalSemestersOrYears}
                  value={semesterNumber}
                  onChange={(e) => setSemesterNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </>
            )}
            {(faculty?.type === "yearly") && (
              <>
                <label className="block font-medium mb-1">Year Number</label>
                <input
                  type="number"
                  min={1}
                  max={faculty.totalSemestersOrYears}
                  value={yearNumber}
                  onChange={(e) => setYearNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            rows={3}
          />
        </div>

        {/* Courses */}
        <div>
          <label className="block font-medium mb-1">Courses (comma separated IDs)</label>
          <input
            type="text"
            value={courses.join(",")}
            onChange={(e) => setCourses(e.target.value.split(",").map((s) => s.trim()))}
            className="w-full px-3 py-2 border rounded"
            placeholder="courseId1,courseId2,..."
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded bg-gray-200 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update"}
          </button>
        </div>
      </form>
    </div>
  </div>
);

}
