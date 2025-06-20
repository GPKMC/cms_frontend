"use client";

import { useState } from "react";
import { Trash2, Plus, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const roles = ["student", "teacher", "admin", "superadmin"] as const;

const BulkUserForm = () => {
  const [users, setUsers] = useState([{ username: "", email: "", password: "", role: "student" }]);
  const [errors, setErrors] = useState<any[]>([{ username: "", email: "", password: "", role: "" }]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [numberOfRows, setNumberOfRows] = useState(1);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const token = process.env.NEXT_PUBLIC_TOKEN || "";

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleChange = (index: number, field: string, value: string) => {
    const updated = [...users];
    updated[index] = { ...updated[index], [field]: value };
    setUsers(updated);

    const updatedErrors = [...errors];
    updatedErrors[index] = { ...updatedErrors[index], [field]: "" };
    setErrors(updatedErrors);
  };

  const addRow = () => {
    setUsers((prev) => [...prev, { username: "", email: "", password: "", role: "student" }]);
    setErrors((prev) => [...prev, { username: "", email: "", password: "", role: "" }]);
  };

  const addMultipleRows = () => {
    if (numberOfRows < 1 || numberOfRows > 100) return;
    const newRows = Array.from({ length: numberOfRows }, () => ({
      username: "",
      email: "",
      password: "",
      role: "student",
    }));
    const newErrors = Array.from({ length: numberOfRows }, () => ({
      username: "",
      email: "",
      password: "",
      role: "",
    }));
    setUsers((prev) => [...prev, ...newRows]);
    setErrors((prev) => [...prev, ...newErrors]);
  };

  const removeRow = (index: number) => {
    setUsers((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCancelConfirm = () => {
    setUsers([{ username: "", email: "", password: "", role: "student" }]);
    setErrors([{ username: "", email: "", password: "", role: "" }]);
    setFile(null);
    setNumberOfRows(1);
    setShowCancelModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors(users.map(() => ({ username: "", email: "", password: "", role: "" })));

    try {
      let response;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        response = await fetch(`${baseUrl}/user-api/users/bulk`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        response = await fetch(`${baseUrl}/user-api/users/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ users }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        if (data.field) {
          const updatedErrors = [...errors];
          updatedErrors[0] = { ...updatedErrors[0], [data.field]: data.message };
          setErrors(updatedErrors);
          showToast("error", data.message);
        } else {
          showToast("error", data.message || "Error");
        }
      } else {
        showToast("success", data.message || "Success");
        handleCancelConfirm();
      }
    } catch (error) {
      showToast("error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* ✅ Toast Notification */}
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

      {/* Main Form */}
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Bulk User Creation</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Row Controls */}
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm"
            >
              <Plus className="w-4 h-4" /> Add 1 Row
            </button>

            <div className="flex items-center gap-2">
              <input
                type="number"
                value={numberOfRows}
                min={1}
                max={100}
                onChange={(e) => setNumberOfRows(Number(e.target.value))}
                className="w-20 border rounded px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={addMultipleRows}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm"
              >
                Add Multiple Rows
              </button>
            </div>
          </div>

          {/* Manual Input Rows */}
          <div className="space-y-3">
            {users.map((user, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 bg-gray-50 p-3 rounded-md relative">
                <div>
                  <label htmlFor={`username-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
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
                  {errors[index]?.username && <span className="text-red-500 text-xs">{errors[index].username}</span>}
                </div>

                <div>
                  <label htmlFor={`email-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
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
                  {errors[index]?.email && <span className="text-red-500 text-xs">{errors[index].email}</span>}
                </div>

                <div>
                  <label htmlFor={`password-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
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
                  {errors[index]?.password && <span className="text-red-500 text-xs">{errors[index].password}</span>}
                </div>

                <div>
                  <label htmlFor={`role-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
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

          {/* Actions */}
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
              onClick={() => setShowCancelModal(true)}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Cancel</h3>
            <p className="mb-6 text-gray-600">Are you sure you want to clear all inputs?</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-md bg-gray-300 hover:bg-gray-400"
              >
                No
              </button>
              <button
                onClick={handleCancelConfirm}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkUserForm;
