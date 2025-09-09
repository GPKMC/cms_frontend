"use client";

import React, { useEffect, useState } from "react";

type BatchRef = {
  _id: string;
  batchname: string;
  year?: number;
  faculty?: string;
};

type User = {
  _id: string;
  username: string;
  email: string;
  role: "student" | "teacher" | "admin" | "superadmin";
  faculty?: string;
  batch?: BatchRef; // batch is now an object
  isActive: boolean;
  isVerified: boolean;
};

type Faculty = {
  _id: string;
  name: string;
  code: string;
};

type Batch = {
  _id: string;
  batchname: string;
  faculty: string;
};

type Props = {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
};

const EditUserModal: React.FC<Props> = ({ userId, onClose, onSaved }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  // Fetch user by ID
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token_admin");
        const res = await fetch(`${baseUrl}/user-api/users/${userId}`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId, baseUrl]);

  // Fetch faculties on mount
  useEffect(() => {
    const fetchFaculties = async () => {
      try {
        const token = localStorage.getItem("token_admin");
        const res = await fetch(`${baseUrl}/faculty-api/facultycode`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        if (!res.ok) throw new Error("Failed to fetch faculties");
        const data = await res.json();
        setFaculties(data.faculties || []);
      } catch {
        setFaculties([]);
      }
    };
    fetchFaculties();
  }, [baseUrl]);

  // Fetch batches when user or faculty changes
  useEffect(() => {
    const facultyId = user?.faculty || user?.batch?.faculty;
    if (!facultyId) {
      setBatches([]);
      return;
    }

    const fetchBatches = async () => {
      try {
        const token = localStorage.getItem("token_admin");
        const res = await fetch(
          `${baseUrl}/batch-api/batchcode?faculty=${facultyId}`,
          {
            headers: { Authorization: token ? `Bearer ${token}` : "" },
          }
        );
        if (!res.ok) throw new Error("Failed to fetch batches");
        const data = await res.json();
        setBatches(data.batches || []);
      } catch {
        setBatches([]);
      }
    };

    fetchBatches();
  }, [user?.faculty, user?.batch?.faculty, baseUrl]);

  // Handle form change
  const handleChange = (field: keyof User, value: any) => {
    if (!user) return;

    if (field === "faculty") {
      // Reset batch if faculty changes
      setUser({ ...user, faculty: value, batch: undefined });
    } else if (field === "batch") {
      // Convert batch _id to batch object
      const selectedBatch = batches.find((b) => b._id === value);
      setUser({ ...user, batch: selectedBatch });
    } else {
      setUser({ ...user, [field]: value });
    }

    setError(null);
  };

  // Handle save
  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const token = localStorage.getItem("token_admin");

      // Prepare payload: send batch _id to backend
      const payload = {
        ...user,
        batch: user.batch?._id,
      };

      const res = await fetch(`${baseUrl}/user-api/users/${user._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Update failed");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-semibold">Edit User</h2>
          <button onClick={onClose} className="text-white text-2xl">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={user.username}
              onChange={(e) => handleChange("username", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={user.role}
              onChange={(e) =>
                handleChange("role", e.target.value as User["role"])
              }
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>

          {/* Faculty & Batch (only for student) */}
          {user.role === "student" && (
            <>
              {/* Faculty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faculty
                </label>
                <select
                  value={user.faculty || user.batch?.faculty || ""}
                  onChange={(e) => handleChange("faculty", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Faculty</option>
                  {faculties.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch
                </label>
                <select
                  value={user.batch?._id || ""}
                  onChange={(e) => handleChange("batch", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!user.faculty && !user.batch?.faculty}
                >
                  <option value="">Select Batch</option>
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.batchname}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Status toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={user.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
              />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={user.isVerified}
                onChange={(e) =>
                  handleChange("isVerified", e.target.checked)
                }
              />
              Verified
            </label>
          </div>

          {/* Error */}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;
