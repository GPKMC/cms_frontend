"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Faculty } from "@/app/admin/types/type.faculty";

export default function FacultyEditPage() {
  const router = useRouter();
  const params = useParams();
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "",
    programLevel: "",
    totalSemestersOrYears: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFaculty = async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/faculty-api/faculties/${params.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      const facultyData = data.faculty; // access nested faculty object
      setFaculty(facultyData);
      setForm({
        name: facultyData.name || "",
        code: facultyData.code || "",
        type: facultyData.type || "",
        programLevel: facultyData.programLevel || "",
        totalSemestersOrYears: facultyData.totalSemestersOrYears || 0,
      });
      setLoading(false);
    };

    if (params.id) fetchFaculty();
  }, [params.id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/faculty-api/faculties/${params.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      }
    );
    alert("Faculty updated successfully");
    router.push("/admin/faculty");
  };

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Faculty</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Faculty Name"
          className="w-full border p-2 rounded"
        />
        <input
          name="code"
          value={form.code}
          onChange={handleChange}
          placeholder="Code"
          className="w-full border p-2 rounded"
        />
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          className="w-full border p-2 rounded"
        >
          <option value="">Select Type</option>
          <option value="semester">Semester</option>
          <option value="year">Year</option>
        </select>
        <select
          name="programLevel"
          value={form.programLevel}
          onChange={handleChange}
          className="w-full border p-2 rounded"
        >
          <option value="">Select Program Level</option>
          <option value="bachelor">Bachelor</option>
          <option value="master">Master</option>
        </select>
        <input
          type="number"
          name="totalSemestersOrYears"
          value={form.totalSemestersOrYears}
          onChange={handleChange}
          placeholder="Total Semesters/Years"
          className="w-full border p-2 rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Update Faculty
        </button>
      </form>
    </div>
  );
}
