import React, { useEffect, useState } from "react";
import { Course } from "../types/type.course";
import { SemesterOrYear } from "../types/type.semoryer";

type Props = {
  id: string;
  onClose: () => void;
  onUpdateSuccess: () => void;
};

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

const EditCourseForm: React.FC<Props> = ({ id, onClose, onUpdateSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [semOptions, setSemOptions] = useState<SemesterOrYear[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    type: "compulsory" as "compulsory" | "elective",
    semesterOrYear: "",
  });

  // Auth headers helper
  const getAuthHeaders = () => {
    if (typeof window === "undefined")
      return { "Content-Type": "application/json" };
    const token = localStorage.getItem("token_admin");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Load course
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${baseUrl}/course-api/course/${id}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!data.course) throw new Error("Not found");
        setCourse(data.course);
        setForm((prev) => ({
          ...prev,
          name: data.course.name,
          code: data.course.code,
          description: data.course.description ?? "",
          type: data.course.type,
          semesterOrYear: data.course.semesterOrYear?._id?.toString() ?? "",
        }));
      } catch (err: any) {
        setError("Failed to load course.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [id]);

  // Load sem/year options
  useEffect(() => {
    const fetchSems = async () => {
      try {
        const res = await fetch(`${baseUrl}/sem-api/semesterOrYear`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();

        if (Array.isArray(data.semesters)) {
          setSemOptions(data.semesters);
        } else if (Array.isArray(data.semesterOrYears)) {
          setSemOptions(data.semesterOrYears);
        } else {
          setSemOptions([]);
        }
      } catch (error) {
        setSemOptions([]);
      }
    };

    fetchSems();
    // eslint-disable-next-line
  }, []);

  // Ensure dropdown shows the right value after both data are loaded
  useEffect(() => {
    if (!course || !semOptions.length) return;
    setForm((prev) => ({
      ...prev,
      semesterOrYear: course.semesterOrYear?._id?.toString() ?? "",
    }));
    // eslint-disable-next-line
  }, [course, semOptions]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!form.name || !form.code || !form.semesterOrYear) {
      setError("Name, Code, and Semester/Year are required.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`${baseUrl}/course-api/course/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          description: form.description,
          type: form.type,
          semesterOrYear: form.semesterOrYear,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onClose();
        onUpdateSuccess();
      } else {
        setError(data.error || "Failed to update course.");
      }
    } catch {
      setError("Failed to update course.");
    }
    setSaving(false);
  };

  if (loading)
    return (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl">Loading...</div>
      </div>
    );

  if (!course) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-600 hover:text-black text-2xl font-bold"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-4">Edit Course</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="font-semibold">Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="block border rounded w-full px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="font-semibold">Code</label>
            <input
              name="code"
              value={form.code}
              onChange={handleChange}
              className="block border rounded w-full px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="font-semibold">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="block border rounded w-full px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold">Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="block border rounded w-full px-3 py-2"
            >
              <option value="compulsory">Compulsory</option>
              <option value="elective">Elective</option>
            </select>
          </div>
          <div>
            <label className="font-semibold">Semester/Year</label>
            <select
              name="semesterOrYear"
              value={form.semesterOrYear}
              onChange={handleChange}
              className="block border rounded w-full px-3 py-2"
              required
            >
              <option value="">Select...</option>
              {semOptions.map((s) => (
                <option key={s._id.toString()} value={s._id.toString()}>
                  {s.name}
                  {s.semesterNumber ? ` (${s.semesterNumber} Sem)` : ""}
                  {s.yearNumber ? ` (${s.yearNumber} Year)` : ""}
                </option>
              ))}
            </select>
          </div>
          {/* For debugging - see selected and options */}
          {/* <pre>
            Current: {form.semesterOrYear}
            Options: {JSON.stringify(semOptions.map(s => s._id))}
          </pre> */}
          {error && <div className="text-red-600">{error}</div>}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCourseForm;
