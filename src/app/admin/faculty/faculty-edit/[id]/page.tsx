"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Faculty } from "@/app/admin/types/type.faculty";

export default function FacultyEditPage() {
  const router = useRouter();
  const { id } = useParams();
  
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "",
    programLevel: "",
    totalSemestersOrYears: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        const token = localStorage.getItem("token_admin") || "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/faculty-api/faculties/${id}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Status ${res.status}`);
        }
        const data = await res.json();
        const fac = data.faculty as Faculty;
        setFaculty(fac);
        setForm({
          name: fac.name || "",
          code: fac.code || "",
          type: fac.type || "",
          programLevel: fac.programLevel || "",
          totalSemestersOrYears: fac.totalSemestersOrYears || 0,
        });
      } catch (err: any) {
        console.error("Failed to load faculty:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchFaculty();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]:
        name === "totalSemestersOrYears" ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token_admin") || "";
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/faculty-api/faculties/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Status ${res.status}`);
      }
      alert("Faculty updated successfully");
      router.push("/admin/faculty");
    } catch (err: any) {
      console.error("Update failed:", err);
      alert("Error updating faculty: " + err.message);
    }
  };

  if (loading) return <p className="p-4">Loading...</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

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
