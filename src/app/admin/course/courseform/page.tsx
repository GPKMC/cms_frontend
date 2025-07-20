'use client';

import React, { useEffect, useState } from 'react';

type SemesterOrYear = {
  _id: string;
  name: string;
  semesterNumber?: number;
  yearNumber?: number;
  faculty?: { _id: string; code: string; name: string };
};

type Props = {
  onSuccess?: () => void; // optional: callback after successful create
};

const CreateCourseForm: React.FC<Props> = ({ onSuccess }) => {
  const [semOptions, setSemOptions] = useState<SemesterOrYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    type: 'compulsory' as 'compulsory' | 'elective',
    semesterOrYear: '',
  });

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  const semUrl = `${baseUrl}/sem-api/semesterOrYear`; // adjust as needed
  const coursePostUrl = `${baseUrl}/course-api/course`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 10000);
  };

  // Fetch semester/year options
  useEffect(() => {
    if (!token) return setError('Unauthorized: Please login.');
    const fetchSems = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(semUrl, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (Array.isArray(data.semesters)) setSemOptions(data.semesters);
        else if (Array.isArray(data.semesterOrYears)) setSemOptions(data.semesterOrYears);
        else setSemOptions([]);
      } catch (err: any) {
        setError('Failed to load semester/year options.');
        setSemOptions([]);
      }
      setLoading(false);
    };
    fetchSems();
  }, [token, semUrl]);

  // Form handler
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (!form.name || !form.code || !form.semesterOrYear || !form.type) {
      setError('Name, Code, Semester/Year, and Type are required.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(coursePostUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Course creation failed.');
      showToast('✅ Course created successfully!', 'success');
      setForm({
        name: '',
        code: '',
        description: '',
        type: 'compulsory',
        semesterOrYear: '',
      });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Course creation failed.', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded shadow relative">
      <h2 className="text-xl font-semibold text-center mb-4">Create Course</h2>

      {toast && (
        <div
          className={`fixed top-24 right-4 px-4 py-2 rounded text-white z-50 shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Course Name</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Course Code</label>
          <input
            name="code"
            value={form.code}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            rows={3}
          />
        </div>
        <div>
          <label className="block mb-1">Type</label>
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          >
            <option value="compulsory">Compulsory</option>
            <option value="elective">Elective</option>
          </select>
        </div>
        <div>
          <label className="block mb-1">Semester/Year</label>
          <select
            name="semesterOrYear"
            value={form.semesterOrYear}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          >
            <option value="">Select...</option>
            {semOptions.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
                {s.semesterNumber ? ` (${s.semesterNumber} Sem)` : ''}
                {s.yearNumber ? ` (${s.yearNumber} Year)` : ''}
                {s.faculty ? ` [${s.faculty.code}]` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCourseForm;
