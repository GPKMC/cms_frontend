"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  FileTextIcon, ImageIcon, LinkIcon, X, ExternalLink, Trash2, Plus, Users2
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// --- RecipientsPanel component (assign to students) ---
function RecipientsPanel({
  students,
  visibleTo,
  setVisibleTo,
  isAllSelected,
  onClose
}: {
  students: User[];
  visibleTo: string[];
  setVisibleTo: (ids: string[]) => void;
  isAllSelected: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = students.filter(s =>
    (s.username || s.email || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  function toggle(id: string) {
    setVisibleTo(
      visibleTo.includes(id)
        ? visibleTo.filter((x) => x !== id)
        : [...visibleTo, id]
    );
  }
  return (
    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border">
      <div className="flex justify-between items-center mb-4">
        <span className="font-semibold text-lg">Assign to students</span>
        <button onClick={onClose}><X /></button>
      </div>
      <input
        type="text"
        className="w-full p-2 mb-3 border rounded"
        placeholder="Search students..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="max-h-56 overflow-y-auto space-y-2">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={() =>
              setVisibleTo(isAllSelected ? [] : students.map(s => s._id))
            }
          />
          All students
        </label>
        {filtered.map(s => (
          <label key={s._id} className="flex items-center gap-2 pl-2">
            <input
              type="checkbox"
              checked={visibleTo.includes(s._id)}
              onChange={() => toggle(s._id)}
            />
            {s.username || s.email}
          </label>
        ))}
      </div>
      <div className="flex justify-end pt-4">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={onClose}
        >Done</button>
      </div>
    </div>
  );
}

// --- MAIN FORM ---
interface User { _id: string; username?: string; email?: string; }
interface Topic { _id: string; name: string; }

interface CourseMaterialFormProps {
  courseInstanceId: string;
  courseName: string;
  onSuccess?: () => void;
}

export default function CourseMaterialForm({
  courseInstanceId,
  courseName,
  onSuccess,
}: CourseMaterialFormProps) {
  // State for form fields
  const [docs, setDocs] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [content, setContent] = useState<string>("");
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [youtube, setYoutube] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const [students, setStudents] = useState<User[]>([]);
  const [visibleTo, setVisibleTo] = useState<string[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<string>("");
  const [newTopic, setNewTopic] = useState("");
  const [showTopicInput, setShowTopicInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Fetch students and topics
  useEffect(() => {
    const token =
      localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${courseInstanceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setStudents(data.instance?.students || []))
      .catch(console.error);

    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/topics/course/${courseInstanceId}`)
      .then(res => res.json())
      .then(data => setTopics(data.topics || []))
      .catch(() => setTopics([]));
  }, [courseInstanceId]);

  const isAllSelected = students.length > 0 && visibleTo.length === students.length;

  // --- SUBMIT FORM ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
      const formData = new FormData();
      formData.append("content", content);
      formData.append("courseInstance", courseInstanceId);
      formData.append("links", JSON.stringify(links));
      if (youtube) formData.append("youtubeLinks", JSON.stringify([youtube]));
      images.forEach((f) => formData.append("files", f));
      docs.forEach((f) => formData.append("files", f));
      if (visibleTo) {
        formData.append(
          "visibleTo",
          isAllSelected ? JSON.stringify([]) : JSON.stringify(visibleTo)
        );
      }
      if (topic) formData.append("topic", topic);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/materials/course-material`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload material");
      setContent(""); setDocs([]); setImages([]); setLinks([]);
      setVisibleTo([]); setYoutube(""); setTopic("");
      setMessage("✅ Material posted!");
      toast.success("✅ Material posted!");
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Topic add
  async function handleAddTopic() {
    if (!newTopic.trim()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/topics/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTopic, courseInstance: courseInstanceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create topic");
      setTopics(t => [...t, json.topic]);
      setTopic(json.topic._id);
      setShowTopicInput(false);
      setNewTopic("");
      toast.success("Topic created!");
    } catch (e) {
      toast.error("Error creating topic.");
    }
  }

  if (!mounted) return null;

  return (
    <div className="w-full max-w-5xl mx-auto my-8 rounded-2xl overflow-hidden shadow-2xl border bg-white">
      <Toaster position="top-right" />
      <form onSubmit={handleSubmit}>
        {/* Flex Row: Main left, Controls right */}
        <div className="flex gap-8 py-8 px-10">
          {/* LEFT: MAIN */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
              <FileTextIcon className="text-blue-600" />
              <span className="font-bold text-xl">Material</span>
            </div>
            {/* Title */}
            <input
              className="w-full text-xl bg-gray-100 rounded p-3 border-b-2 border-blue-400 focus:outline-none mb-2"
              placeholder="Title*"
              required
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <div className="text-xs text-gray-500 mb-4">*Required</div>
            {/* Attach */}
            <div className="bg-gray-50 border rounded-xl p-4 mb-4">
              <div className="text-gray-600 font-semibold mb-2">Attach</div>
              <div className="flex gap-6 mb-3">
                {/* YouTube */}
                <label className="flex flex-col items-center cursor-pointer w-16">
                  <svg className="mb-1" width={28} height={28} fill="red" viewBox="0 0 24 24"><path d="M23.5 6.1s-.2-1.7-.9-2.5c-.8-.9-1.6-1-2-1.1-2.8-.2-7-.2-7-.2h-.1s-4.2 0-7 .2c-.4 0-1.2.2-2 1.1-.7.8-.9 2.5-.9 2.5s-.2 2.1-.2 4.1v1.9c0 2 .2 4.1.2 4.1s.2 1.7.9 2.5c.8.9 1.9.9 2.4 1.1C7.5 22 12 22 12 22s4.2 0 7-.2c.4 0 1.2-.2 2-1.1.7-.8.9-2.5.9-2.5s.2-2.1.2-4.1v-1.9c0-2-.2-4.1-.2-4.1z"></path></svg>
                  <input
                    type="text"
                    className="hidden"
                    value={youtube}
                    onChange={e => setYoutube(e.target.value)}
                  />
                  <span className="text-xs mt-1">YouTube</span>
                  <input
                    type="text"
                    placeholder="YouTube link"
                    value={youtube}
                    className="w-20 mt-1 p-1 text-xs border rounded"
                    onChange={e => setYoutube(e.target.value)}
                  />
                </label>
                {/* Upload */}
                <label className="flex flex-col items-center cursor-pointer w-16">
                  <ImageIcon size={28} className="text-blue-500 mb-1" />
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={e => setImages([...images, ...Array.from(e.target.files || [])])}
                  />
                  <span className="text-xs mt-1">Images</span>
                  <button
                    type="button"
                    className="w-20 mt-1 p-1 border rounded text-xs bg-gray-100 hover:bg-gray-200"
                    onClick={e => (e.currentTarget.previousSibling as HTMLInputElement).click()}
                  >Choose</button>
                </label>
                <label className="flex flex-col items-center cursor-pointer w-16">
                  <FileTextIcon size={28} className="text-green-500 mb-1" />
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.csv,.xls,.xlsx,.txt"
                    onChange={e => setDocs([...docs, ...Array.from(e.target.files || [])])}
                  />
                  <span className="text-xs mt-1">Docs</span>
                  <button
                    type="button"
                    className="w-20 mt-1 p-1 border rounded text-xs bg-gray-100 hover:bg-gray-200"
                    onClick={e => (e.currentTarget.previousSibling as HTMLInputElement).click()}
                  >Choose</button>
                </label>
                {/* Link */}
                <label className="flex flex-col items-center cursor-pointer w-16">
                  <LinkIcon size={28} className="text-gray-700 mb-1" />
                  <input
                    type="text"
                    className="hidden"
                    value={linkInput}
                    onChange={e => setLinkInput(e.target.value)}
                  />
                  <span className="text-xs mt-1">Link</span>
                  <input
                    type="text"
                    placeholder="Link"
                    value={linkInput}
                    className="w-20 mt-1 p-1 text-xs border rounded"
                    onChange={e => setLinkInput(e.target.value)}
                    onBlur={() => {
                      if (linkInput) {
                        try {
                          new URL(linkInput);
                          if (!links.includes(linkInput))
                            setLinks([...links, linkInput]);
                          setLinkInput("");
                          setLinkError("");
                        } catch {
                          setLinkError("Invalid URL.");
                        }
                      }
                    }}
                  />
                </label>
              </div>
              {linkError && <div className="text-xs text-red-600 mb-1">{linkError}</div>}
              {/* Previews */}
              <div className="flex flex-wrap gap-2 mt-2">
                {images.map((file, i) => (
                  <div key={i} className="bg-gray-200 px-2 py-1 rounded text-xs flex items-center gap-1">
                    <ImageIcon size={16} />{file.name}
                    <button type="button" className="ml-1 text-red-600" onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {docs.map((file, i) => (
                  <div key={i} className="bg-gray-200 px-2 py-1 rounded text-xs flex items-center gap-1">
                    <FileTextIcon size={16} />{file.name}
                    <button type="button" className="ml-1 text-red-600" onClick={() => setDocs(d => d.filter((_, idx) => idx !== i))}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {links.map((url, i) => (
                  <div key={i} className="bg-green-100 px-2 py-1 rounded text-xs flex items-center gap-1">
                    <LinkIcon size={14} />{url}
                    <button type="button" className="ml-1 text-red-600" onClick={() => setLinks(l => l.filter((_, idx) => idx !== i))}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Feedback */}
            {message && (
              <div className={`text-center text-sm p-3 rounded ${message.includes("✅")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"}`}>
                {message}
              </div>
            )}
          </div>
          {/* RIGHT: SIDEBAR */}
          <div className="w-[320px] flex-shrink-0 bg-white rounded-lg p-6 border space-y-6">
            {/* For */}
            <div>
              <div className="text-gray-600 font-semibold mb-1">For</div>
              <div className="bg-gray-100 rounded p-3">{courseName}</div>
            </div>
            {/* Assign to */}
            <div>
              <div className="text-gray-600 font-semibold mb-1">Assign to</div>
              <button
                type="button"
                className="w-full flex items-center justify-between bg-white border rounded-full px-4 py-2 hover:border-blue-400 transition"
                onClick={() => setShowRecipients(true)}
              >
                <span className="flex items-center gap-2">
                  <Users2 size={18} className="text-blue-600" />
                  {visibleTo.length === 0 ? "All students" : `Selected: ${visibleTo.length}`}
                </span>
              </button>
            </div>
            {/* Topic */}
            <div>
              <div className="text-gray-600 font-semibold mb-1 flex items-center gap-1">
                Topic
                <button
                  type="button"
                  onClick={() => setShowTopicInput(v => !v)}
                  className="ml-1 text-blue-500 hover:underline"
                >
                  <Plus size={16} />
                </button>
              </div>
              {showTopicInput ? (
                <div className="flex gap-2 mt-1">
                  <input
                    className="flex-1 bg-gray-100 p-2 rounded border"
                    placeholder="New topic name"
                    value={newTopic}
                    onChange={e => setNewTopic(e.target.value)}
                  />
                  <button
                    type="button"
                    className="px-2 rounded bg-blue-600 text-white"
                    onClick={handleAddTopic}
                  >Add</button>
                </div>
              ) : (
                <select
                  className="w-full bg-gray-100 rounded p-3 mt-1"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                >
                  <option value="">No topic</option>
                  {topics.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="border-t bg-white py-4 px-6 flex justify-between items-center sticky bottom-0 z-20">
          <button
            type="button"
            className="text-gray-500 text-sm hover:text-gray-700"
            onClick={() => {
              setContent(""); setImages([]); setDocs([]); setLinks([]); setVisibleTo([]);
              setYoutube(""); setTopic("");
              onSuccess?.();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="bg-blue-600 text-white px-8 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {loading ? "Posting..." : "Post Material"}
          </button>
        </div>
      </form>
      {/* Recipients modal */}
      {showRecipients && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <RecipientsPanel
            students={students}
            visibleTo={visibleTo}
            setVisibleTo={setVisibleTo}
            isAllSelected={isAllSelected}
            onClose={() => setShowRecipients(false)}
          />
        </div>
      )}
    </div>
  );
}
