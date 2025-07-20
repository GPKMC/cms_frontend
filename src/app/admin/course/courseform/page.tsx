'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Faculty = {
  _id: string;
  name: string;
  code: string;
};

type SemesterOrYear = {
  _id: string;
  name: string;
  semesterNumber?: number;
  yearNumber?: number;
  faculty?: { _id: string; code: string; name: string };
};

type Props = {
  onSuccess?: () => void; // optional callback after successful create
};

const CreateCourseForm: React.FC<Props> = ({ onSuccess }) => {
  const router = useRouter();

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [semOptions, setSemOptions] = useState<SemesterOrYear[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [loadingSems, setLoadingSems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal states for cancel/back confirmation
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showBackModal, setShowBackModal] = useState(false);

  const [form, setForm] = useState({
    faculty: '',
    name: '',
    code: '',
    description: '',
    type: 'compulsory' as 'compulsory' | 'elective',
    semesterOrYear: '',
  });

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token_admin') : null;

  // Helper to check if form is dirty (any field not empty/default)
  const isFormDirty = () => {
    return (
      form.faculty !== '' ||
      form.name !== '' ||
      form.code !== '' ||
      form.description !== '' ||
      form.type !== 'compulsory' ||
      form.semesterOrYear !== ''
    );
  };

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 10000);
  };

  // Fetch faculties on mount
  useEffect(() => {
    if (!token) return setError('Unauthorized: Please login.');
    setLoadingFaculties(true);
    fetch(`${baseUrl}/faculty-api/faculties`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFaculties(data);
        } else if (data.faculties) {
          setFaculties(data.faculties);
        } else {
          setFaculties([]);
        }
      })
      .catch(() => setFaculties([]))
      .finally(() => setLoadingFaculties(false));
  }, [baseUrl, token]);

  // Fetch semesters/years when faculty changes
  useEffect(() => {
    if (!form.faculty) {
      setSemOptions([]);
      setForm((f) => ({ ...f, semesterOrYear: '' })); // reset semester/year
      return;
    }
    if (!token) return;

    setLoadingSems(true);
    fetch(`${baseUrl}/sem-api/semesterOrYear?faculty=${form.faculty}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.semesters)) setSemOptions(data.semesters);
        else if (Array.isArray(data.semesterOrYears)) setSemOptions(data.semesterOrYears);
        else setSemOptions([]);
      })
      .catch(() => setSemOptions([]))
      .finally(() => setLoadingSems(false));
  }, [form.faculty, baseUrl, token]);

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

    if (!form.faculty || !form.name || !form.code || !form.semesterOrYear || !form.type) {
      setError('Faculty, Name, Code, Semester/Year, and Type are required.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/course-api/course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          faculty: form.faculty,
          semesterOrYear: form.semesterOrYear,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Course creation failed.');
      showToast('✅ Course created successfully!', 'success');
      setForm({
        faculty: '',
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

  // Handle Cancel click
  const onCancelClick = () => {
    if (isFormDirty()) {
      setShowCancelModal(true);
    } else {
      // No data changed, just reset
      setForm({
        faculty: '',
        name: '',
        code: '',
        description: '',
        type: 'compulsory',
        semesterOrYear: '',
      });
      setError(null);
    }
  };

  // Handle Back click
  const onBackClick = () => {
    if (isFormDirty()) {
      setShowBackModal(true);
    } else {
      router.back();
    }
  };

  // Confirm Cancel modal handler
  const confirmCancel = () => {
    setShowCancelModal(false);
    setForm({
      faculty: '',
      name: '',
      code: '',
      description: '',
      type: 'compulsory',
      semesterOrYear: '',
    });
    setError(null);
  };

  // Confirm Back modal handler
  const confirmBack = () => {
    setShowBackModal(false);
    router.back();
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded shadow relative">
      <button
        onClick={onBackClick}
        className="mb-4 text-blue-600 hover:underline font-semibold"
      >
        &larr; Back
      </button>

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
          <label className="block mb-1">Faculty</label>
          {loadingFaculties ? (
            <p>Loading faculties...</p>
          ) : (
            <select
              name="faculty"
              value={form.faculty}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            >
              <option value="">Select faculty...</option>
              {faculties.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          )}
        </div>
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
          {loadingSems ? (
            <p>Loading semester/year options...</p>
          ) : (
            <select
              name="semesterOrYear"
              value={form.semesterOrYear}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
              disabled={!form.faculty}
            >
              <option value="">Select semester/year...</option>
              {semOptions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                  {s.semesterNumber ? ` (${s.semesterNumber} Sem)` : ''}
                  {s.yearNumber ? ` (${s.yearNumber} Year)` : ''}
                  {s.faculty ? ` [${s.faculty.code}]` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Create Course'}
          </button>
          <button
            type="button"
            onClick={onCancelClick}
            className="w-full bg-gray-400 text-black py-2 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <Modal
          message="You have unsaved changes. Are you sure you want to cancel and reset the form?"
          onConfirm={confirmCancel}
          onCancel={() => setShowCancelModal(false)}
        />
      )}

      {/* Back confirmation modal */}
      {showBackModal && (
        <Modal
          message="You have unsaved changes. Are you sure you want to cancel and go back?"
          onConfirm={confirmBack}
          onCancel={() => setShowBackModal(false)}
        />
      )}
    </div>
  );
};

// Simple reusable modal component
const Modal = ({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-sm">
      <div className="bg-white p-6 rounded shadow max-w-sm w-full">
        <p className="mb-6">{message}</p>
        <div className="flex justify-end gap-4">
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
};

export default CreateCourseForm;
