'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Faculty = {
  _id: string;
  code: string;
  programLevel: 'bachelor' | 'master' | string;
};

const CreateBatchWithFaculty = () => {
  const router = useRouter();
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [programLevel, setProgramLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'back' | 'cancel' | null>(null);

  const [formData, setFormData] = useState({
    facultyCode: '',
    startYear: new Date().getFullYear(),
    endYear: undefined as number | undefined,
    isCompleted: false,
    currentSemesterOrYear: 1,
  });

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  const facultyUrl = `${baseUrl}/faculty-api/facultycode`;
  const batchPostUrl = `${baseUrl}/batch-api/batch`;

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 20000);
  };

  useEffect(() => {
    const fetchFaculties = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(facultyUrl, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) throw new Error('Failed to fetch faculties');

        const data = await res.json();
        setFaculties(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error(err);
        setError('Failed to load faculties.');
      }
    };

    fetchFaculties();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (name === 'facultyCode') {
      const selectedFaculty = faculties.find((f) => f.code === value);
      const newProgramLevel = selectedFaculty?.programLevel || '';
      const baseStartYear = formData.startYear;

      let defaultEndYear: number | undefined;
      if (newProgramLevel === 'bachelor') {
        defaultEndYear = baseStartYear + 4;
      } else if (newProgramLevel === 'master') {
        defaultEndYear = baseStartYear + 2;
      }

      setProgramLevel(newProgramLevel);
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        endYear: defaultEndYear,
      }));
      return;
    }

    if (name === 'startYear') {
      const numericStartYear = parseInt(value);
      let defaultEndYear: number | undefined;

      if (programLevel === 'bachelor') {
        defaultEndYear = numericStartYear + 4;
      } else if (programLevel === 'master') {
        defaultEndYear = numericStartYear + 2;
      }

      setFormData((prev) => ({
        ...prev,
        startYear: numericStartYear,
        endYear: defaultEndYear,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(batchPostUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message);

      showToast('✅ Batch created successfully!', 'success');
      resetForm();
    } catch (err: any) {
      showToast(err.message || 'Batch creation failed.', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      facultyCode: '',
      startYear: new Date().getFullYear(),
      endYear: undefined,
      isCompleted: false,
      currentSemesterOrYear: 1,
    });
    setProgramLevel('');
  };

  const hasUnsavedChanges = () =>
    formData.facultyCode ||
    formData.endYear ||
    formData.currentSemesterOrYear !== 1 ||
    formData.isCompleted;

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setModalType('cancel');
      setShowModal(true);
    } else {
      resetForm();
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges()) {
      setModalType('back');
      setShowModal(true);
    } else {
      router.push('/admin/batch');
    }
  };

  const confirmModal = () => {
    if (modalType === 'cancel') {
      resetForm();
    } else if (modalType === 'back') {
      router.push('/admin/batch');
    }
    setShowModal(false);
    setModalType(null);
  };

  return (
    <div>
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="absolute  border-2 bg-primary px-4 py-2 rounded top-4 left-4 text-white hover:underline"
      >
        Back
      </button>
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow relative">
      {/* Back Button */}
    

      <h2 className="text-xl font-semibold text-center mb-4">Create Batch</h2>

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
          <label className="block mb-1">Faculty Code</label>
          <select
            name="facultyCode"
            value={formData.facultyCode}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          >
            <option value="">Select faculty code</option>
            {faculties.map((f) => (
              <option key={f._id} value={f.code}>
                {f.code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Program Level</label>
          <input
            type="text"
            value={programLevel}
            readOnly
            className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block mb-1">Start Year</label>
          <input
            type="number"
            name="startYear"
            value={formData.startYear}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">End Year</label>
          <input
            type="number"
            name="endYear"
            value={formData.endYear ?? ''}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block mb-1">Current Semester/Year</label>
          <input
            type="number"
            name="currentSemesterOrYear"
            value={formData.currentSemesterOrYear}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isCompleted"
            checked={formData.isCompleted}
            onChange={handleChange}
          />
          <label>Is Completed</label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Create Batch
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-full bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">
              {modalType === 'cancel' ? 'Cancel Form?' : 'Go Back?'}
            </h3>
            <p className="mb-4">
              {modalType === 'cancel'
                ? 'This will clear all form data. Are you sure?'
                : 'Any unsaved changes will be lost. Are you sure you want to go back?'}
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                No
              </button>
              <button
                onClick={confirmModal}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default CreateBatchWithFaculty;
