"use client";

import React, { useState, useEffect, FormEvent, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

type FacultyType = "semester" | "yearly";

interface Faculty {
  _id: string;
  code: string;
  name: string;
  type: FacultyType;
  totalSemestersOrYears: number;
}

type Toast = {
  id: string;
  message: string;
  type: "success" | "error";
};

export default function SemesterOrYearForm() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [faculty, setFaculty] = useState("");
  const [facultyType, setFacultyType] = useState<FacultyType | "">("");
  const [semesterNumber, setSemesterNumber] = useState("");
  const [yearNumber, setYearNumber] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"cancel" | "back" | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const facultyUrl = `${baseUrl}/faculty-api/facultycode`;
  const postUrl = `${baseUrl}/sem-api/semesterOrYear`;

  const router = useRouter();

  // Get token from localStorage
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const axiosConfig = token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : undefined;

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 10000);
  }, []);

  useEffect(() => {
    if (!token) {
      addToast("Unauthorized: Please login to fetch faculties.", "error");
      setFaculties([]);
      return;
    }
    axios
      .get(facultyUrl, axiosConfig)
      .then((res) => {
        const facs: Faculty[] = Array.isArray(res.data) ? res.data : res.data.faculties;
        setFaculties(facs || []);
      })
      .catch(() => {
        setFaculties([]);
        addToast("Failed to load faculties", "error");
      });
  }, [facultyUrl, token, addToast]);

  useEffect(() => {
    if (!faculty) {
      setFacultyType("");
      setSemesterNumber("");
      setYearNumber("");
      return;
    }
    const selectedFaculty = faculties.find((f) => f._id === faculty);
    setFacultyType(selectedFaculty?.type || "");
    setSemesterNumber("");
    setYearNumber("");
  }, [faculty, faculties]);

  const isFormDirty = () => {
    return (
      faculty !== "" ||
      semesterNumber !== "" ||
      yearNumber !== "" ||
      description !== ""
    );
  };

  const handleCancelClick = () => {
    if (isFormDirty()) {
      setPendingAction("cancel");
      setShowCancelModal(true);
    } else {
      resetForm();
    }
  };

  const handleBackClick = () => {
    if (isFormDirty()) {
      setPendingAction("back");
      setShowCancelModal(true);
    } else {
      router.push("/admin/semOryear");
    }
  };

  const resetForm = () => {
    setFaculty("");
    setFacultyType("");
    setSemesterNumber("");
    setYearNumber("");
    setDescription("");
  };

  const handleConfirmModal = () => {
    setShowCancelModal(false);
    if (pendingAction === "cancel") {
      resetForm();
    } else if (pendingAction === "back") {
      router.push("/admin/semOryear");
    }
    setPendingAction(null);
  };

  const handleCloseModal = () => {
    setShowCancelModal(false);
    setPendingAction(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!token) {
      addToast("Unauthorized: Please login to create semester/year.", "error");
      return;
    }

    if (!faculty) {
      addToast("Please select a faculty.", "error");
      return;
    }
    if (facultyType === "semester" && !semesterNumber) {
      addToast("Please enter semester number.", "error");
      return;
    }
    if (facultyType === "yearly" && !yearNumber) {
      addToast("Please enter year number.", "error");
      return;
    }

    setLoading(true);

    const payload: Record<string, any> = {
      faculty,
      description,
    };
    if (facultyType === "semester") payload.semesterNumber = Number(semesterNumber);
    if (facultyType === "yearly") payload.yearNumber = Number(yearNumber);

    try {
      await axios.post(postUrl, payload, axiosConfig);
      addToast("Semester/Year created successfully!", "success");
      resetForm();
    } catch (err: any) {
      addToast(err?.response?.data?.message || "Failed to create semester/year.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Back button top-left fixed */}
      <button
        onClick={handleBackClick}
        className="absolute  border-2 bg-primary px-4 py-2 rounded top-4 left-4 text-white hover:underline"
        type="button"
      >
        &larr; Back
      </button>

      <div className="max-w-lg mx-auto mt-8 p-6 border rounded bg-white shadow relative">
        {/* Toast container */}
        <div className="fixed top-4 right-4 flex flex-col gap-2 z-50">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`max-w-xs px-4 py-2 rounded shadow text-white ${
                toast.type === "success" ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-4 text-center">Add Semester / Year</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium mb-1">
              Faculty <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              required
            >
              <option value="">Select Faculty</option>
              {faculties.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.code} ({f.name}) [{f.type}]
                </option>
              ))}
            </select>
          </div>

          {facultyType === "semester" && (
            <div>
              <label className="block font-medium mb-1">
                Semester Number <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={faculties.find((f) => f._id === faculty)?.totalSemestersOrYears || 8}
                className="w-full px-3 py-2 border rounded"
                value={semesterNumber}
                onChange={(e) => setSemesterNumber(e.target.value)}
                required
              />
            </div>
          )}

          {facultyType === "yearly" && (
            <div>
              <label className="block font-medium mb-1">
                Year Number <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={faculties.find((f) => f._id === faculty)?.totalSemestersOrYears || 4}
                className="w-full px-3 py-2 border rounded"
                value={yearNumber}
                onChange={(e) => setYearNumber(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block font-medium mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={handleCancelClick}
              className="flex-1 py-2 px-4 border border-gray-400 rounded font-semibold hover:bg-gray-100"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Cancel Confirmation Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-transparent bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Unsaved Changes</h3>
              <p className="mb-6">
                Canceling will not save your data. Are you sure you want to continue?
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  disabled={loading}
                >
                  Stay
                </button>
                <button
                  onClick={handleConfirmModal}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  disabled={loading}
                >
                  Yes, {pendingAction === "cancel" ? "Cancel" : "Go Back"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
