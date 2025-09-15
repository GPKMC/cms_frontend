"use client";

import React, { useEffect, useState } from "react";
import { Trash2, Plus, Upload, FileText, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ---------- Types ----------
export type Faculty = {
  _id: string;
  name: string;
  code: string;
};

export type Batch = {
  _id: string;
  batchname: string;
  faculty: string; // faculty _id
};

export type UserRow = {
  username: string;
  email: string;
  password: string;
  role: "student" | "teacher" | "admin" | "superadmin";
  faculty?: string;
  batch?: string;
};

const roles = ["student", "teacher", "admin", "superadmin"] as const;

// ---------- Component ----------
const BulkUserForm: React.FC = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  // Data
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batchesByFaculty, setBatchesByFaculty] = useState<Record<string, Batch[]>>({});

  // Form state
  const [users, setUsers] = useState<UserRow[]>([
    { username: "", email: "", password: "", role: "student" },
  ]);
  const [errors, setErrors] = useState<
    Array<{ username?: string; email?: string; password?: string; role?: string; faculty?: string; batch?: string }>
  >([{ username: "", email: "", password: "", role: "", faculty: "", batch: "" }]);

  // File upload
  const [file, setFile] = useState<File | null>(null);

  // UX state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ---------- Data fetching ----------
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
        if (Array.isArray(data)) setFaculties(data);
        else if (Array.isArray(data.faculties)) setFaculties(data.faculties);
        else setFaculties([]);
      } catch (err) {
        setFaculties([]);
        showToast("error", "Error fetching faculties");
      }
    };
    fetchFaculties();
  }, [baseUrl]);

  const fetchBatchesForFaculty = async (facultyId: string) => {
    if (!facultyId || batchesByFaculty[facultyId]) return; // cached
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
      const list: Batch[] = Array.isArray(data?.batches) ? data.batches : [];
      setBatchesByFaculty((prev) => ({ ...prev, [facultyId]: list }));
    } catch (err) {
      setBatchesByFaculty((prev) => ({ ...prev, [facultyId]: [] }));
      showToast("error", "Error fetching batches");
    }
  };

  // ---------- Handlers ----------
  const handleChange = (index: number, field: keyof UserRow, value: string) => {
    const updated = [...users];
    // cast role safely
    const patch: Partial<UserRow> = field === "role" ? { role: value as UserRow["role"] } : { [field]: value } as any;
    updated[index] = { ...updated[index], ...patch };

    if (field === "faculty") {
      updated[index].batch = ""; // reset batch if faculty changes
      void fetchBatchesForFaculty(value);
    }

    if (field === "role" && value !== "student") {
      updated[index].faculty = undefined;
      updated[index].batch = undefined;
    }

    setUsers(updated);

    // clear field error on change
    const copy = [...errors];
    copy[index] = { ...copy[index], [field]: "" };
    if (field === "faculty") copy[index].batch = "";
    setErrors(copy);
  };

  const addRow = () => {
    setUsers((prev) => [...prev, { username: "", email: "", password: "", role: "student" }]);
    setErrors((prev) => [...prev, { username: "", email: "", password: "", role: "", faculty: "", batch: "" }]);
  };

  const removeRow = (index: number) => {
    setUsers((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFile = () => setFile(null);

  // quick client-side guard (manual mode only)
  const validateManual = (): boolean => {
    if (file) return true; // CSV mode
    const nextErrors = users.map((u) => ({ username: "", email: "", password: "", role: "", faculty: "", batch: "" }));
    let ok = true;
    users.forEach((u, i) => {
      if (!u.username?.trim()) {
        nextErrors[i].username = "Required";
        ok = false;
      }
      if (!u.email?.trim()) {
        nextErrors[i].email = "Required";
        ok = false;
      }
      if (!u.password?.trim()) {
        nextErrors[i].password = "Required";
        ok = false;
      }
      if (!u.role) {
        nextErrors[i].role = "Required";
        ok = false;
      }
      if (u.role === "student") {
        if (!u.faculty) {
          nextErrors[i].faculty = "Select a faculty";
          ok = false;
        }
        if (!u.batch) {
          nextErrors[i].batch = "Select a batch";
          ok = false;
        }
      }
    });
    if (!ok) {
      setErrors(nextErrors);
      showToast("error", "Please fix the highlighted fields");
    }
    return ok;
  };

  const downloadTemplate = (withFaculty = true) => {
    const headers = withFaculty
      ? ["username", "email", "password", "role", "faculty", "batch"]
      : ["username", "email", "password", "role", "batch"];
    const rows = [
      withFaculty
        ? ["Aakash Pathak", "aakash.7037701@gpkmc.edu.np", "Aakash@121", "student", "BCA", "2077"]
        : ["Aakash Pathak", "aakash.7037701@gpkmc.edu.np", "Aakash@121", "student", "2077"],
    ];
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = withFaculty ? "users_template_with_faculty.csv" : "users_template_minimal.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---------- Submit ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateManual()) return;

    setLoading(true);
    // reset errors for fresh server response mapping
    setErrors(users.map(() => ({ username: "", email: "", password: "", role: "", faculty: "", batch: "" })));

    try {
      const token = localStorage.getItem("token_admin");
      if (!token) {
        showToast("error", "Authorization token missing. Please login again.");
        return;
      }

      let response: Response;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        response = await fetch(`${baseUrl}/user-api/users/bulk`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        const payload = users.map((u) => ({
          username: u.username?.trim(),
          email: u.email?.trim(),
          password: u.password?.trim(),
          role: u.role,
          faculty: u.faculty || undefined,
          batch: u.batch || undefined,
        }));
        response = await fetch(`${baseUrl}/user-api/users/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ users: payload }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        if (data.field && typeof data.rowIndex === "number") {
          const next = [...errors];
          next[data.rowIndex] = { ...next[data.rowIndex], [data.field]: data.message };
          setErrors(next);
          showToast("error", `Row ${data.rowIndex + 1}: ${data.message}`);
        } else {
          showToast("error", data.message || "Submission failed");
        }
      } else {
        showToast("success", data.message || "Users created successfully");
        setUsers([{ username: "", email: "", password: "", role: "student" }]);
        setErrors([{ username: "", email: "", password: "", role: "", faculty: "", batch: "" }]);
        setFile(null);
      }
    } catch (err) {
      console.error("Submit error:", err);
      showToast("error", "Something went wrong while submitting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl text-white border-l-4 ${
              toast.type === "success" 
                ? "bg-gradient-to-r from-green-500 to-emerald-600 border-green-300" 
                : "bg-gradient-to-r from-red-500 to-rose-600 border-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? "✅" : "❌"}
              <span className="font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-7xl p-6">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                  <Plus className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Bulk User Creation
                  </h2>
                  <p className="mt-2 text-gray-600 text-lg">
                    Upload a CSV file or create users manually with our intuitive form
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => downloadTemplate(true)}
                  className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <FileText className="h-5 w-5 group-hover:rotate-12 transition-transform duration-200" />
                  <span className="font-medium">Download Template</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Form Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          <form onSubmit={handleSubmit} noValidate>
            {/* Enhanced CSV Upload Section */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50/30 border-b border-gray-200 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">CSV Upload</h3>
                      <p className="text-sm text-gray-600">Upload a CSV file for bulk user creation</p>
                    </div>
                  </div>
                  <label className="group cursor-pointer">
                    <div className="flex items-center gap-2 bg-white border-2 border-dashed border-gray-300 hover:border-blue-400 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-blue-50">
                      <Upload className="h-4 w-4 text-gray-500 group-hover:text-blue-600" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                        Choose CSV File
                      </span>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                
                {file ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-4 py-2 rounded-xl"
                  >
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800 truncate max-w-[200px]" title={file.name}>
                      {file.name}
                    </span>
                    <button 
                      type="button" 
                      onClick={clearFile} 
                      className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-200 rounded transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
                    No file selected
                  </div>
                )}
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">
                  💡 CSV Format: <code className="bg-white px-2 py-1 rounded text-blue-800">username,email,password,role,faculty,batch</code>
                </p>
              </div>
            </div>

            {/* Enhanced User Rows */}
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <Plus className="h-4 w-4 text-purple-600" />
                  </div>
                  Manual User Entry
                </h3>
                <p className="text-sm text-gray-600 mt-1">Add users individually using the form below</p>
              </div>
              
              <div className="space-y-4">
                {users.map((user, index) => {
                  const facultyId = user.faculty || "";
                  const batches = batchesByFaculty[facultyId] || [];
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative group"
                    >
                      <div className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 hover:border-blue-300">
                        <div className="absolute top-3 right-3 flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            User #{index + 1}
                          </span>
                          {users.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(index)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove this user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        
                          {/* Username */}
                          <div>
                            <label htmlFor={`username-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                              Username
                            </label>
                            <input
                              id={`username-${index}`}
                              type="text"
                              value={user.username}
                              onChange={(e) => handleChange(index, "username", e.target.value)}
                              className={`w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                errors[index]?.username ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-blue-400"
                              }`}
                              required={!file}
                              placeholder="e.g., Aakash Pathak"
                            />
                            {errors[index]?.username && (
                              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <span>⚠️</span> {errors[index].username}
                              </p>
                            )}
                          </div>

                          {/* Email */}
                          <div>
                            <label htmlFor={`email-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                              Email Address
                            </label>
                            <input
                              id={`email-${index}`}
                              type="email"
                              value={user.email}
                              onChange={(e) => handleChange(index, "email", e.target.value)}
                              className={`w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                errors[index]?.email ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-blue-400"
                              }`}
                              required={!file}
                              placeholder="user@gpkmc.edu.np"
                            />
                            {errors[index]?.email && (
                              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <span>⚠️</span> {errors[index].email}
                              </p>
                            )}
                          </div>

                          {/* Password */}
                          <div>
                            <label htmlFor={`password-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                              Password
                            </label>
                            <input
                              id={`password-${index}`}
                              type="password"
                              value={user.password}
                              onChange={(e) => handleChange(index, "password", e.target.value)}
                              className={`w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                errors[index]?.password ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-blue-400"
                              }`}
                              required={!file}
                              placeholder="Secure password"
                              autoComplete="new-password"
                            />
                            {errors[index]?.password && (
                              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <span>⚠️</span> {errors[index].password}
                              </p>
                            )}
                          </div>

                          {/* Role */}
                          <div>
                            <label htmlFor={`role-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                              User Role
                            </label>
                            <select
                              id={`role-${index}`}
                              value={user.role}
                              onChange={(e) => handleChange(index, "role", e.target.value)}
                              className={`w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                errors[index]?.role ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-blue-400"
                              }`}
                            >
                              {roles.map((role) => (
                                <option key={role} value={role}>
                                  {role.charAt(0).toUpperCase() + role.slice(1)}
                                </option>
                              ))}
                            </select>
                            {errors[index]?.role && (
                              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <span>⚠️</span> {errors[index].role}
                              </p>
                            )}
                          </div>

                          {/* Faculty & Batch (students only) */}
                          {user.role === "student" ? (
                            <>
                              <div>
                                <label htmlFor={`faculty-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                                  Faculty
                                </label>
                                <select
                                  id={`faculty-${index}`}
                                  value={user.faculty || ""}
                                  onChange={(e) => handleChange(index, "faculty", e.target.value)}
                                  className={`w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                    errors[index]?.faculty ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-blue-400"
                                  }`}
                                  disabled={!!file}
                                >
                                  <option value="">Select Faculty</option>
                                  {faculties.map((fac) => (
                                    <option key={fac._id} value={fac._id}>
                                      {fac.name}
                                    </option>
                                  ))}
                                </select>
                                {errors[index]?.faculty && (
                                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                    <span>⚠️</span> {errors[index].faculty}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label htmlFor={`batch-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                                  Batch
                                </label>
                                <select
                                  id={`batch-${index}`}
                                  value={user.batch || ""}
                                  onChange={(e) => handleChange(index, "batch", e.target.value)}
                                  className={`w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                    errors[index]?.batch ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-blue-400"
                                  }`}
                                  disabled={!user.faculty || !!file}
                                >
                                  <option value="">Select Batch</option>
                                  {batches.map((b) => (
                                    <option key={b._id} value={b._id}>
                                      {b.batchname}
                                    </option>
                                  ))}
                                </select>
                                {errors[index]?.batch && (
                                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                    <span>⚠️</span> {errors[index].batch}
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="md:col-span-2" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Enhanced Actions Section */}
              <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-2xl border border-gray-200">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <button
                    type="button"
                    onClick={addRow}
                    className="group flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-200" />
                    <span className="font-medium">Add Another User</span>
                  </button>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <button
                      type="submit"
                      disabled={loading}
                      className="group flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 disabled:transform-none min-w-[140px]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="font-medium">Creating...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 group-hover:translate-y-[-2px] transition-transform duration-200" />
                          <span className="font-medium">Create Users</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setUsers([{ username: "", email: "", password: "", role: "student" }]);
                        setErrors([{ username: "", email: "", password: "", role: "", faculty: "", batch: "" }]);
                        setFile(null);
                      }}
                      className="flex items-center justify-center gap-2 bg-gray-500 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl hover:bg-gray-600 transform hover:scale-105 transition-all duration-200"
                    >
                      <X className="h-4 w-4" />
                      <span className="font-medium">Reset Form</span>
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="text-blue-500">ℹ️</span>
                    <span>
                      <strong>{users.length}</strong> user{users.length !== 1 ? 's' : ''} ready to be created
                      {file && <span className="text-blue-600 font-medium"> • CSV file attached</span>}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BulkUserForm;
