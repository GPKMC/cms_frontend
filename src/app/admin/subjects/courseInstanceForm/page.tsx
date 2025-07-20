// app/admin/courseinstance/CourseInstanceForm.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Batch } from "../../types/type.batch";
import { Course } from "../../types/type.course";
import { User } from "../../types/type.user";


const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface FormState {
  batch: string;
  course: string;
  teacher: string;
  isActive: boolean;
}

export default function CourseInstanceForm() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [form, setForm] = useState<FormState>({
    batch: "",
    course: "",
    teacher: "",
    isActive: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [courseType, setCourseType] = useState<"compulsory" | "elective" | "">("");

  const router = useRouter();

  function getAuthHeaders() {
    if (typeof window === "undefined") return { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // Fetch dropdown data for batches, courses, teachers
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [b, c, t] = await Promise.all([
          fetch(`${baseUrl}/batch-api/batch`, { headers: getAuthHeaders() }).then((r) => r.json()),
          fetch(`${baseUrl}/course-api/course`, { headers: getAuthHeaders() }).then((r) => r.json()),
          fetch(`${baseUrl}/user-api/users?role=teacher`, { headers: getAuthHeaders() }).then((r) => r.json()),
        ]);
        setBatches(b.batches || []);
        setCourses(c.courses || []);
        // Only show isActive teachers
        setTeachers((t.users || []).filter((u: User) => u.isActive));
      } catch {
        setError("Failed to load dropdown data.");
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <form
      className="max-w-lg mx-auto bg-white p-8 shadow rounded"
      onSubmit={handleSubmit}
    >
      <h2 className="text-2xl font-bold mb-6">Create Course Instance</h2>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {success && <div className="text-green-600 mb-4">Created successfully!</div>}

      <label className="block mb-3">
        Batch:
        <select
          name="batch"
          value={form.batch}
          onChange={handleChange}
          required
          className="block w-full p-2 border rounded"
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
        Course:
        <select
          name="course"
          value={form.course}
          onChange={handleChange}
          required
          className="block w-full p-2 border rounded"
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

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
      >
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
