"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X, Users2, Plus, FileText, CalendarDays, Upload } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// Types
interface User { _id: string; username: string; }
interface Topic { _id: string; title: string; }

export default function GroupAssignmentForm({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const params = useParams();
  const courseInstanceId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  // States
  const [students, setStudents] = useState<User[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [topic, setTopic] = useState("");
  const [groups, setGroups] = useState<{ name: string; members: string[] }[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    if (!courseInstanceId) return;
    const token =
      localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");

    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${courseInstanceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setStudents(data.instance?.students || []))
      .catch(() => setStudents([]));

    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/topic-api/course/${courseInstanceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setTopics(data.topics || []))
      .catch(() => setTopics([]));
  }, [open, courseInstanceId]);

  // Group logic
  function handleAddGroup() {
    if (!groupName.trim() || groupMembers.length === 0) {
      toast.error("Provide group name and select at least one member.");
      return;
    }
    setGroups([...groups, { name: groupName.trim(), members: [...groupMembers] }]);
    setGroupName("");
    setGroupMembers([]);
  }

  function handleRemoveGroup(index: number) {
    setGroups(groups.filter((_, i) => i !== index));
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setDocuments(Array.from(e.target.files));
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !description || !dueDate || groups.length === 0) {
      toast.error("Fill all fields and add at least one group.");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("dueDate", dueDate);
      formData.append("topic", topic);
      formData.append("courseInstance", courseInstanceId);
      formData.append("groups", JSON.stringify(groups));
      documents.forEach(file => formData.append("documents", file));

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/group-assignment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Group Assignment created!");
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1000);
      } else {
        throw new Error(json.error || "Failed to create group assignment");
      }
    } catch (err: any) {
      toast.error(err.message || "Error submitting form.");
    } finally {
      setLoading(false);
    }
  }

  // Only show modal if open
  if (!open) return null;

  return (
   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur">
  <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full relative animate-fadeIn">
    <button
      className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-2xl"
      onClick={onClose}
      aria-label="Close"
    >
      <X size={28} />
    </button>
    <div className="max-h-[90vh] overflow-y-auto p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <h2 className="text-2xl font-bold mb-4">Create Group Assignment</h2>

          <input
            className="w-full text-lg bg-gray-100 rounded p-3 border-b-2 border-blue-400 mb-2"
            placeholder="Assignment Title*"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="w-full bg-gray-100 rounded p-3 border border-gray-200 mb-2"
            placeholder="Description*"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
          <div>
            <div className="flex items-center gap-2 mb-1 text-sm text-gray-600">
              <CalendarDays size={16} /> Due Date
            </div>
            <input
              type="date"
              className="w-full border rounded p-2"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Topic</div>
            <select
              className="w-full bg-white rounded p-3 border"
              value={topic}
              onChange={e => setTopic(e.target.value)}
            >
              <option value="">No topic</option>
              {topics.map(t => (
                <option key={t._id} value={t._id}>{t.title}</option>
              ))}
            </select>
          </div>
          {/* Document Upload */}
          <div>
            <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <FileText size={16} /> Attach Documents
            </div>
            <label className="flex items-center gap-2 border rounded px-3 py-2 bg-gray-50 cursor-pointer">
              <Upload size={18} /> Select files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFiles}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              />
            </label>
            {documents.length > 0 && (
              <div className="text-xs text-gray-600 mt-2">
                {documents.map(f => f.name).join(", ")}
              </div>
            )}
          </div>
          {/* Groups */}
          <div>
            <div className="text-lg font-bold mb-2 flex items-center gap-2">
              <Users2 /> Groups
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 bg-gray-100 rounded p-2 border"
                placeholder="Group name"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
              <select
                className="flex-1 bg-gray-100 rounded p-2 border"
                multiple
                value={groupMembers}
                onChange={e => setGroupMembers(Array.from(e.target.selectedOptions).map(o => o.value))}
              >
                {students.map(s => (
                  <option key={s._id} value={s._id}>{s.username}</option>
                ))}
              </select>
              <button
                type="button"
                className="bg-blue-600 text-white rounded px-3 py-2 flex items-center"
                onClick={handleAddGroup}
              >
                <Plus size={18} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {groups.map((g, idx) => (
                <div key={idx} className="bg-blue-50 rounded px-4 py-2 flex items-center gap-3">
                  <span className="font-semibold">{g.name}:</span>
                  <span className="text-sm">
                    {g.members.map(m => students.find(s => s._id === m)?.username).join(", ")}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-red-500 hover:text-red-700"
                    onClick={() => handleRemoveGroup(idx)}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            className="bg-blue-600 text-white rounded px-5 py-3 mt-4 text-lg font-bold hover:bg-blue-700"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating..." : "Assign Group Assignment"}
          </button>
        </form>
    </div>
  </div>
</div>
  );
}
