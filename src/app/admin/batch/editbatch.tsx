'use client';

import React, { useEffect, useState } from 'react';

type EditBatchProps = {
  id: string;
  onClose: () => void;
  onUpdateSuccess?: () => void;
};

const EditBatchForm = ({ id, onClose, onUpdateSuccess }: EditBatchProps) => {
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    startYear: 0,
    endYear: 0,
    currentSemesterOrYear: 1,
    isCompleted: false,
  });

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  const url = `${baseUrl}/batch-api/batch/${id}`;

  // Get token safely (only in browser)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token_admin') : null;

  useEffect(() => {
    const fetchBatch = async () => {
      if (!token) {
        setError('Unauthorized: Please login.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Failed to fetch batch');
        }

        const data = await res.json();
        setBatch(data.batch);
        setFormData({
          startYear: data.batch.startYear,
          endYear: data.batch.endYear ?? 0,
          currentSemesterOrYear: data.batch.currentSemesterOrYear,
          isCompleted: data.batch.isCompleted,
        });
      } catch (error: any) {
        console.error('Failed to load batch', error);
        setError(error.message || 'Failed to load batch');
      } finally {
        setLoading(false);
      }
    };

    fetchBatch();
  }, [url, token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Unauthorized: Please login.');
      return;
    }

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update batch.');

      setSuccess('✅ Batch updated successfully!');
      onUpdateSuccess?.();
      setTimeout(onClose, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to update batch.');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!batch) return <div>{error || 'Batch not found.'}</div>;

  const label = batch.faculty.type === 'semester' ? 'Current Semester' : 'Current Year';
  const maxTotal = batch.faculty.totalSemestersOrYears;

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg relative">
        <h2 className="text-xl font-bold mb-4">Edit Batch</h2>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Non-editable fields */}
          <div>
            <label className="block mb-1">Batch Name</label>
            <input
              type="text"
              value={batch.batchname}
              disabled
              className="w-full border p-2 rounded bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Faculty Code</label>
              <input
                type="text"
                value={batch.faculty.code}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1">Faculty Name</label>
              <input
                type="text"
                value={batch.faculty.name}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Faculty Type</label>
              <input
                type="text"
                value={batch.faculty.type}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1">Program Level</label>
              <input
                type="text"
                value={batch.faculty.programLevel}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
          </div>

          {/* Editable fields */}
          <div>
            <label className="block mb-1">Start Year</label>
            <input
              type="number"
              name="startYear"
              value={formData.startYear}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
              min={1900}
              max={2100}
            />
          </div>

          <div>
            <label className="block mb-1">End Year</label>
            <input
              type="number"
              name="endYear"
              value={formData.endYear || ''}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
              min={formData.startYear}
              max={formData.startYear + 6}
            />
          </div>

          <div>
            <label className="block mb-1">{label}</label>
            <input
              type="number"
              name="currentSemesterOrYear"
              value={formData.currentSemesterOrYear}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
              min={1}
              max={maxTotal}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isCompleted"
              checked={formData.isCompleted}
              onChange={handleChange}
              className="w-6 h-6"
            />
            <label>Completed</label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-400 text-white rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBatchForm;
