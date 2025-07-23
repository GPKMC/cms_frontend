"use client";
import React, { useState, useEffect } from "react";

interface Topic {
  _id: string;
  title: string;
  description?: string;
}

interface TopicModalProps {
  courseInstanceId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: (msg?: string) => void;
  topic?: Topic; // Pass this for editing
}

export default function TopicModal({
  courseInstanceId,
  open,
  onClose,
  onSuccess,
  topic,
}: TopicModalProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill fields when editing, or clear when creating
  useEffect(() => {
    if (topic) {
      setTitle(topic.title || "");
      setDesc(topic.description || "");
    } else {
      setTitle("");
      setDesc("");
    }
    setError("");
  }, [topic, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Topic title is required");
      return;
    }
    setLoading(true);
    try {
      const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const token =
        localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");

      let res, data;
      if (topic?._id) {
        // Edit (PATCH)
        res = await fetch(`${baseurl}/topic-api/topic/${topic._id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            title,
            description: desc,
          }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not update topic");
        onSuccess?.("Topic updated successfully!");
      } else {
        // Create (POST)
        res = await fetch(`${baseurl}/topic-api/topic`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            title,
            description: desc,
            courseInstance: courseInstanceId,
          }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create topic");
        onSuccess?.("Topic created successfully!");
      }
      setTitle("");
      setDesc("");
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
        <button
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-700 text-xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 text-blue-700">
          {topic ? "Edit Topic" : "Add Topic"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              type="text"
              className="w-full p-3 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
              placeholder="Topic title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div>
            <textarea
              className="w-full p-3 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
              placeholder="Short description (optional)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              disabled={loading}
              rows={2}
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm font-medium">{error}</div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
              disabled={loading}
            >
              {loading
                ? (topic ? "Saving..." : "Adding...")
                : (topic ? "Save Changes" : "Add Topic")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
