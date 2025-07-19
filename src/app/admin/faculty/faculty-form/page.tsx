"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddFacultyPage() {
  const [form, setForm] = useState({
    name: '',
    code: '',
    programLevel: 'bachelor',
    type: 'semester',
    totalSemestersOrYears: 1,
    description: ''
  });

  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === 'totalSemestersOrYears' ? parseInt(value) : value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/faculty-api/faculties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.message || 'Failed to add faculty');
        return;
      }

      router.push('/admin/faculty');
    } catch (err) {
      console.error(err);
      setError('Something went wrong');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Add New Faculty</h1>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          placeholder="Faculty Name"
          className="w-full p-2 border rounded"
        />

        <input
          name="code"
          value={form.code}
          onChange={handleChange}
          required
          placeholder="Faculty Code"
          className="w-full p-2 border rounded"
        />

        <div className="flex gap-4">
          <select name="programLevel" value={form.programLevel} onChange={handleChange} className="w-1/2 p-2 border rounded">
            <option value="bachelor">Bachelor</option>
            <option value="master">Master</option>
          </select>

          <select name="type" value={form.type} onChange={handleChange} className="w-1/2 p-2 border rounded">
            <option value="semester">Semester</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <input
          type="number"
          name="totalSemestersOrYears"
          value={form.totalSemestersOrYears}
          onChange={handleChange}
          required
          placeholder="Number of Semesters/Years"
          className="w-full p-2 border rounded"
          min={1}
        />

        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Description"
          className="w-full p-2 border rounded h-24"
        />

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full">
          Add Faculty
        </button>
      </form>
    </div>
  );
}
