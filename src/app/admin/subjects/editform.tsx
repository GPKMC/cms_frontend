"use client";

import { useEffect, useState } from "react";

interface CourseInstanceEditModalProps {
  instanceId: string;
  onClose: () => void;
  onUpdated: () => void; // Callback to refresh parent list after update
}

type Teacher = {
  _id: string;
  name: string;
  email: string;
};

type CourseInstanceDetail = {
  _id: string;
  batch: { _id: string; batchname: string };
  course: {
    _id: string;
    name: string;
    code: string;
    type: string;
    semesterOrYear: {
      name: string;
      semesterNumber?: number;
      yearNumber?: number;
      faculty: { name: string; code: string };
    };
  };
  teacher: Teacher | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  assignments: any[];
  materials: any[];
  attendanceRecords: any[];
  grades: any[];
};

export default function CourseInstanceEditModal({
  instanceId,
  onClose,
  onUpdated,
}: CourseInstanceEditModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instance, setInstance] = useState<CourseInstanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const [form, setForm] = useState({
    teacher: "",
    isActive: false,
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("token_admin");
        if (!token) throw new Error("Authorization token missing");

        // Fetch instance details
        const instanceRes = await fetch(
          `${baseUrl}/course-api/courseInstance/${instanceId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!instanceRes.ok) {
          const data = await instanceRes.json();
          throw new Error(data.error || "Failed to fetch course instance");
        }
        const instanceData = await instanceRes.json();
        setInstance(instanceData.instance);

        // Set initial form values
        setForm({
          teacher: instanceData.instance.teacher?._id || "",
          isActive: instanceData.instance.isActive || false,
        });

        // Fetch all teachers
        const teachersRes = await fetch(`${baseUrl}/user-api/users?role=teacher`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!teachersRes.ok) {
          throw new Error("Failed to fetch teachers");
        }
        const teachersData = await teachersRes.json();
        setTeachers(teachersData.users || []);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [instanceId, baseUrl]);

  function getAuthHeaders() {
    if (typeof window === "undefined") return { "Content-Type": "application/json" };
    const token = localStorage.getItem("token_admin");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/course-api/courseInstance/${instanceId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
        <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full text-center">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
        <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="bg-white max-w-2xl w-full p-6 rounded shadow-lg max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit Course Instance</h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <strong>Batch:</strong> {instance?.batch.batchname}
          </div>
          <div>
            <strong>Course:</strong> {instance?.course.name} ({instance?.course.code})
          </div>
          <div>
            <strong>Type:</strong> {instance?.course.type}
          </div>
          <div>
            <strong>Semester/Year:</strong> {instance?.course.semesterOrYear.name}{" "}
            {instance?.course.semesterOrYear.semesterNumber
              ? `(${instance?.course.semesterOrYear.semesterNumber} Semester)`
              : instance?.course.semesterOrYear.yearNumber
              ? `(${instance?.course.semesterOrYear.yearNumber} Year)`
              : ""}
            {" - "}
            {instance?.course.semesterOrYear.faculty.code} ({instance?.course.semesterOrYear.faculty.name})
          </div>

          <label className="block mt-4">
            Teacher:
            <select
              name="teacher"
              value={form.teacher}
              onChange={handleChange}
              required
              className="mt-1 block w-full border p-2 rounded"
            >
              <option value="" disabled>
                Select a teacher
              </option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </label>

          <label className="block mt-4">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              disabled={instance?.course.type === "compulsory"} // compulsories are always active
              className="mr-2"
            />
            Is Active (Only editable for electives)
          </label>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {error && <p className="text-red-600 mt-2">{error}</p>}
        </form>
      </div>
    </div>
  );
}
