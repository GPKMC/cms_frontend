"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Batch } from "../../types/type.batch";
import { Course } from "../../types/type.course";
import { User } from "../../types/type.user";

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface FormState {
  faculty: string;
  batch: string;
  semesterOrYear: string;
  course: string;
  teacher: string;
  isActive: boolean;
}

export default function CourseInstanceForm() {
  const [faculties, setFaculties] = useState<{ _id: string; name: string }[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [semesterOrYears, setSemesterOrYears] = useState<{ _id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [form, setForm] = useState<FormState>({
    faculty: "",
    batch: "",
    semesterOrYear: "",
    course: "",
    teacher: "",
    isActive: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [courseType, setCourseType] = useState<"compulsory" | "elective" | "">("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  const router = useRouter();

  function getAuthHeaders() {
    if (typeof window === "undefined") return { "Content-Type": "application/json" };
    const token = localStorage.getItem("token_admin");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // Check if any form field is filled (for confirmation)
  const isFormDirty = () => {
    return (
      form.faculty !== "" ||
      form.batch !== "" ||
      form.semesterOrYear !== "" ||
      form.course !== "" ||
      form.teacher !== "" ||
      form.isActive !== false
    );
  };

  // Fetch faculties, teachers on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fRes, tRes] = await Promise.all([
          fetch(`${baseUrl}/faculty-api/faculties`, { headers: getAuthHeaders() }),
          fetch(`${baseUrl}/user-api/users?role=teacher`, { headers: getAuthHeaders() }),
        ]);

        const fData = await fRes.json();
        setFaculties(fData.faculties || fData || []);

        const tData = await tRes.json();
        setTeachers((tData.users || []).filter((u: User) => u.isActive));
      } catch {
        setError("Failed to load faculties or teachers.");
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch batches filtered by selected faculty
  useEffect(() => {
    if (!form.faculty) {
      setBatches([]);
      setForm(f => ({ ...f, batch: "" }));
      return;
    }

    setLoading(true);
    fetch(`${baseUrl}/batch-api/batchcode?faculty=${form.faculty}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBatches(data.batches);
        } else {
          setBatches([]);
        }
        setForm(f => ({ ...f, batch: "" }));
      })
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, [form.faculty]);

  // Fetch semesterOrYears based on faculty selection
  useEffect(() => {
    if (!form.faculty) {
      setSemesterOrYears([]);
      setForm(f => ({ ...f, semesterOrYear: "" }));
      return;
    }
    setLoading(true);
    fetch(`${baseUrl}/sem-api/semesterOrYear?faculty=${form.faculty}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.semesterOrYears)) setSemesterOrYears(data.semesterOrYears);
        else if (Array.isArray(data.semesters)) setSemesterOrYears(data.semesters);
        else setSemesterOrYears([]);
        setForm(f => ({ ...f, semesterOrYear: "" }));
      })
      .catch(() => {
        setSemesterOrYears([]);
        setForm(f => ({ ...f, semesterOrYear: "" }));
      })
      .finally(() => setLoading(false));
  }, [form.faculty]);

  // Fetch courses filtered by faculty and semesterOrYear
  useEffect(() => {
    if (!form.faculty || !form.semesterOrYear) {
      setCourses([]);
      setForm(f => ({ ...f, course: "" }));
      return;
    }
    setLoading(true);
    fetch(`${baseUrl}/course-api/coursecode?faculty=${form.faculty}&semesterOrYear=${form.semesterOrYear}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.courses) setCourses(data.courses);
        else setCourses([]);
        setForm(f => ({ ...f, course: "" }));
      })
      .catch(() => {
        setCourses([]);
        setForm(f => ({ ...f, course: "" }));
      })
      .finally(() => setLoading(false));
  }, [form.faculty, form.semesterOrYear]);

  // Update courseType on course change
  useEffect(() => {
    const selected = courses.find((c) => c._id === form.course);
    if (!selected) setCourseType("");
    else {
      setCourseType(selected.type);
      setForm((f) => ({
        ...f,
        isActive: selected.type === "compulsory" ? true : false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.course]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch(`${baseUrl}/course-api/courseInstance`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.join(", ") || data.error || "Failed to create course instance.");
      setSuccess(true);
      setTimeout(() => router.push("/admin/subjects"), 1200);
    } catch (err: any) {
      setError(err.message || "Unknown error.");
    }
    setLoading(false);
  }

  // Cancel handler
  function handleCancel() {
    if (isFormDirty()) {
      setShowCancelConfirm(true);
    } else {
      resetForm();
    }
  }

  function resetForm() {
    setForm({
      faculty: "",
      batch: "",
      semesterOrYear: "",
      course: "",
      teacher: "",
      isActive: false,
    });
    setError("");
    setSuccess(false);
    setShowCancelConfirm(false);
  }

  // Back handler
  function handleBack() {
    if (isFormDirty()) {
      setShowBackConfirm(true);
    } else {
      router.push("/admin/subjects");
    }
  }

  function confirmCancel() {
    resetForm();
    setShowCancelConfirm(false);
  }

  function confirmBack() {
    setShowBackConfirm(false);
    router.push("/admin/subjects");
  }

  return (
    <>
      <form
        className="max-w-lg mx-auto bg-white p-8 shadow rounded"
        onSubmit={handleSubmit}
      >
        <h2 className="text-2xl font-bold mb-6">Create Course Instance</h2>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        {success && <div className="text-green-600 mb-4">Created successfully!</div>}

        <label className="block mb-3">
          Faculty:
          <select
            name="faculty"
            value={form.faculty}
            onChange={handleChange}
            required
            className="block w-full p-2 border rounded"
          >
            <option value="">Select faculty</option>
            {faculties.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-3">
          Batch:
          <select
            name="batch"
            value={form.batch}
            onChange={handleChange}
            required
            className="block w-full p-2 border rounded"
            disabled={!form.faculty || loading}
          >
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.batchname}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-3">
          Semester/Year:
          <select
            name="semesterOrYear"
            value={form.semesterOrYear}
            onChange={handleChange}
            required
            className="block w-full p-2 border rounded"
            disabled={!form.faculty || loading}
          >
            <option value="">Select semester/year</option>
            {semesterOrYears.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-3">
          Course:
          <select
            name="course"
            value={form.course}
            onChange={handleChange}
            required
            className="block w-full p-2 border rounded"
            disabled={!form.faculty || !form.semesterOrYear || loading}
          >
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-3">
          Teacher:
          <select
            name="teacher"
            value={form.teacher}
            onChange={handleChange}
            required
            className="block w-full p-2 border rounded"
          >
            <option value="">Select teacher</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.username} ({t.email})
              </option>
            ))}
          </select>
        </label>

        {/* Show isActive only for electives */}
        {courseType === "elective" && (
          <label className="block mb-3">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="mr-2"
            />
            Is Active
          </label>
        )}

        <div className="flex justify-between gap-4 mt-4">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Back
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </form>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <ConfirmModal
          title="Confirm Cancel"
          message="Are you sure you want to cancel? Your input will be lost."
          onConfirm={confirmCancel}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {/* Back confirmation modal */}
      {showBackConfirm && (
        <ConfirmModal
          title="Confirm Navigation"
          message="Are you sure you want to go back? Your input will be lost."
          onConfirm={confirmBack}
          onCancel={() => setShowBackConfirm(false)}
        />
      )}
    </>
  );
}

// Simple reusable confirmation modal component
function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="mb-6">{message}</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
