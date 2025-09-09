"use client";

import React, { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Faculty = {
  _id: string;
  name: string;
  code: string;
};

type Batch = {
  _id: string;
  batchname: string;
  faculty: string; // faculty _id
};

type UserRow = {
  username: string;
  email: string;
  password: string;
  role: "student" | "teacher" | "admin" | "superadmin";
  faculty?: string;
  batch?: string;
};

const roles = ["student", "teacher", "admin", "superadmin"] as const;

const BulkUserForm: React.FC = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const [users, setUsers] = useState<UserRow[]>([
    { username: "", email: "", password: "", role: "student" },
  ]);
  const [errors, setErrors] = useState<any[]>([
    { username: "", email: "", password: "", role: "", faculty: "", batch: "" },
  ]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Toast helper
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch faculties on mount with authorization
  useEffect(() => {
    const fetchFaculties = async () => {
      try {
        const token = localStorage.getItem("token_admin");
        if (!token) {
          showToast("error", "Please login to fetch faculties.");
          return;
        }
        const res = await fetch(`${baseUrl}/faculty-api/faculties`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch faculties");
        const data = await res.json();
        if (Array.isArray(data)) {
          setFaculties(data);
        } else if (Array.isArray(data.faculties)) {
          setFaculties(data.faculties);
        } else {
          setFaculties([]);
          console.error("Unexpected faculties response", data);
        }
      } catch (err) {
        setFaculties([]);
        showToast("error", "Error fetching faculties");
      }
    };
    fetchFaculties();
  }, [baseUrl]);

  // Fetch batches for a given faculty with authorization
  const fetchBatches = async (facultyId: string) => {
    try {
      const token = localStorage.getItem("token_admin");
      if (!token) {
        showToast("error", "Please login to fetch batches.");
        return;
      }
      const res = await fetch(`${baseUrl}/batch-api/batchcode?faculty=${facultyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch batches");
      const data = await res.json();
      // Backend returns { success: true, batches: [...] }
      if (data && Array.isArray(data.batches)) {
        setBatches(data.batches);
      } else {
        setBatches([]);
      }
    } catch {
      setBatches([]);
      showToast("error", "Error fetching batches");
    }
  };

  // Handle input changes
  const handleChange = (index: number, field: keyof UserRow, value: string) => {
    const updated = [...users];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "faculty") {
      updated[index].batch = ""; // reset batch if faculty changes
      fetchBatches(value);
    }

    if (field === "role" && value !== "student") {
      updated[index].faculty = undefined;
      updated[index].batch = undefined;
    }
if (field === "batch") {
    console.log(`Row ${index} selected batch:`, value);
  }
    setUsers(updated);

    const updatedErrors = [...errors];
    updatedErrors[index] = { ...updatedErrors[index], [field]: "" };
    if (field === "faculty") updatedErrors[index].batch = "";
    setErrors(updatedErrors);
  };

  // Add new blank row
  const addRow = () => {
    setUsers((prev) => [...prev, { username: "", email: "", password: "", role: "student" }]);
    setErrors((prev) => [...prev, { username: "", email: "", password: "", role: "", faculty: "", batch: "" }]);
  };

  // Remove a row by index
  const removeRow = (index: number) => {
    setUsers((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit bulk users
// Submit bulk users
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  // Reset all errors
  setErrors(users.map(() => ({ username: "", email: "", password: "", role: "", faculty: "", batch: "" })));

  try {
    const token = localStorage.getItem("token_admin");
    if (!token) {
      showToast("error", "Authorization token missing. Please login again.");
      setLoading(false);
      return;
    }

    let response;

    if (file) {
      // CSV upload
      const formData = new FormData();
      formData.append("file", file);
      response = await fetch(`${baseUrl}/user-api/users/bulk`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    } else {
      // JSON array
      const sendUsers = users.map(({ username, email, password, role, faculty, batch }) => ({
        username: username?.trim(),
        email: email?.trim(),
        password: password?.trim(),
        role: role?.trim(),
        faculty: faculty?.trim() || undefined,
        batch: batch?.trim() || undefined,
      }));

      response = await fetch(`${baseUrl}/user-api/users/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ users: sendUsers }),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      // Handle row-specific errors
      if (data.field && data.message && typeof data.rowIndex === "number") {
        const updatedErrors = [...errors];
        updatedErrors[data.rowIndex] = {
          ...updatedErrors[data.rowIndex],
          [data.field]: data.message,
        };
        setErrors(updatedErrors);
        showToast("error", `Row ${data.rowIndex + 1}: ${data.message}`);
      } else if (data.field && data.message) {
        // fallback if no rowIndex from backend
        const updatedErrors = [...errors];
        updatedErrors[0] = { ...updatedErrors[0], [data.field]: data.message };
        setErrors(updatedErrors);
        showToast("error", data.message);
      } else {
        showToast("error", data.message || "Submission failed");
      }
    } else {
      showToast("success", data.message || "Users created successfully");
      // Reset form
      setUsers([{ username: "", email: "", password: "", role: "student" }]);
      setErrors([{ username: "", email: "", password: "", role: "", faculty: "", batch: "" }]);
      setFile(null);
    }
  } catch (error) {
    console.error(error);
    showToast("error", "Something went wrong");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="relative">
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-white ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Bulk User Creation</h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* CSV Upload */}
          <div className="border border-gray-300 rounded-md p-4 bg-gray-50 mb-4">
            <label className="block font-medium text-gray-700 mb-1">Upload CSV File (optional):</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-fit border-gray-300 rounded-md text-sm"
            />
          </div>

          {/* Add Row button */}
          <div className="mb-4">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm"
              title="Add Row"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          </div>

          {/* Rows */}
          <div className="space-y-3">
            {users.map((user, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-gray-50 p-3 rounded-md relative"
              >
                {/* Username */}
                <div>
                  <label
                    htmlFor={`username-${index}`}
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Username
                  </label>
                  <input
                    id={`username-${index}`}
                    type="text"
                    value={user.username}
                    onChange={(e) => handleChange(index, "username", e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                    required={!file}
                  />
                  {errors[index]?.username && (
                    <span className="text-red-500 text-xs">{errors[index].username}</span>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor={`email-${index}`}
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id={`email-${index}`}
                    type="email"
                    value={user.email}
                    onChange={(e) => handleChange(index, "email", e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                    required={!file}
                  />
                  {errors[index]?.email && (
                    <span className="text-red-500 text-xs">{errors[index].email}</span>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor={`password-${index}`}
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Password
                  </label>
                  <input
                    id={`password-${index}`}
                    type="password"
                    value={user.password}
                    onChange={(e) => handleChange(index, "password", e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                    required={!file}
                  />
                  {errors[index]?.password && (
                    <span className="text-red-500 text-xs">{errors[index].password}</span>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label
                    htmlFor={`role-${index}`}
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Role
                  </label>
                  <select
                    id={`role-${index}`}
                    value={user.role}
                    onChange={(e) => handleChange(index, "role", e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Faculty & Batch for students */}
                {user.role === "student" && (
                  <>
                    <div>
                      <label
                        htmlFor={`faculty-${index}`}
                        className="block text-xs font-medium text-gray-600 mb-1"
                      >
                        Faculty
                      </label>
                      <select
                        id={`faculty-${index}`}
                        value={user.faculty || ""}
                        onChange={(e) => handleChange(index, "faculty", e.target.value)}
                        className="border rounded px-3 py-2 text-sm w-full"
                      >
                        <option value="">Select Faculty</option>
                        {faculties.map((fac) => (
                          <option key={fac._id} value={fac._id}>
                            {fac.name}
                          </option>
                        ))}
                      </select>
                      {errors[index]?.faculty && (
                        <span className="text-red-500 text-xs">{errors[index].faculty}</span>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor={`batch-${index}`}
                        className="block text-xs font-medium text-gray-600 mb-1"
                      >
                        Batch
                      </label>
                      <select
                        id={`batch-${index}`}
                        value={user.batch || ""}
                        onChange={(e) => handleChange(index, "batch", e.target.value)}
                        className="border rounded px-3 py-2 text-sm w-full"
                        disabled={!user.faculty}
                      >
                        <option value="">Select Batch</option>
                        {batches
                          .filter((b) => b.faculty === user.faculty)
                          .map((batch) => (
                            <option key={batch._id} value={batch._id}>
                              {batch.batchname}
                            </option>
                          ))}
                      </select>
                      {errors[index]?.batch && (
                        <span className="text-red-500 text-xs">{errors[index].batch}</span>
                      )}
                    </div>
                  </>
                )}

                {/* Remove row button */}
                <div className="flex items-center justify-center pt-5">
                  {users.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove this row"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2E3094] hover:bg-[#1f2173] text-white font-medium py-2 rounded-md"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setUsers([{ username: "", email: "", password: "", role: "student" }]);
                setErrors([{ username: "", email: "", password: "", role: "", faculty: "", batch: "" }]);
                setFile(null);
              }}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkUserForm;
