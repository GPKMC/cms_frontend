"use client";

import { useState, useEffect } from "react";
import { Faculty } from "../../types/type.faculty";
import { BatchInput } from "../../types/type.batch";

const initialForm: BatchInput = {
  facultyCode: "",               // Start empty for new batch creation
  startYear: new Date().getFullYear(),
  endYear: new Date().getFullYear() + 4,
  isCompleted: false,
  currentSemesterOrYear: 1,
};

const BatchForm = () => {
  const [form, setForm] = useState<BatchInput>(initialForm);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  useEffect(() => {
    const fetchFaculties = async () => {
      try {
        const res = await fetch(`${baseUrl}/faculty-api/faculties`);
        const data = await res.json();
        if (data.success && data.faculties) {
          setFaculties(data.faculties);
        }
      } catch (err) {
        console.error("Error fetching faculties:", err);
      }
    };
    fetchFaculties();
  }, [baseUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    let value: string | number | boolean = target.value;

    if (target.type === "checkbox") {
      value = (target as HTMLInputElement).checked;
    } else if (target.type === "number") {
      value = Number(value);
    }

    setForm((prev) => ({
      ...prev,
      [target.name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const res = await fetch(`${baseUrl}/batch-api/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setForm(initialForm);
      } else {
        setError(data.message || "Failed to create batch.");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("Failed to create batch.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto p-4 border rounded shadow-md">
      <h2 className="text-xl font-bold mb-4">Create New Batch</h2>

      {error && <p className="text-red-600 mb-2">{error}</p>}
      {message && <p className="text-green-600 mb-2">{message}</p>}

      <label className="block mb-2 font-medium">
        Faculty
        <select
          name="facultyCode"
          value={form.facultyCode}
          onChange={handleChange}
          required
          className="w-full mt-1 p-2 border rounded"
        >
          <option value="">-- Select Faculty --</option>
          {faculties.map((faculty) => (
            <option key={faculty._id} value={faculty.code}>
              {faculty.name} ({faculty.code})
            </option>
          ))}
        </select>
      </label>

      <label className="block mb-2 font-medium">
        Start Year
        <input
          type="number"
          name="startYear"
          value={form.startYear}
          onChange={handleChange}
          required
          className="w-full mt-1 p-2 border rounded"
          min={1900}
          max={2100}
        />
      </label>

      <label className="block mb-2 font-medium">
        End Year
        <input
          type="number"
          name="endYear"
          value={form.endYear ?? ""}
          onChange={handleChange}
          className="w-full mt-1 p-2 border rounded"
          min={1900}
          max={2100}
        />
      </label>

      <label className="block mb-2 font-medium">
        Current Semester/Year
        <input
          type="number"
          name="currentSemesterOrYear"
          value={form.currentSemesterOrYear}
          onChange={handleChange}
          required
          min={1}
          className="w-full mt-1 p-2 border rounded"
        />
      </label>

      <label className="inline-flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          name="isCompleted"
          checked={form.isCompleted}
          onChange={handleChange}
        />
        Mark as Completed
      </label>

      <button
        type="submit"
        className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
      >
        Create Batch
      </button>
    </form>
  );
};

export default BatchForm;
