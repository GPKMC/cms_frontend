"use client";
import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  ImageIcon, YoutubeIcon, FileTextIcon, LinkIcon, X, ZoomIn,
  Trash2, Plus, Users2
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";

// --- Recipients Panel ---
function RecipientsPanel({
  students,
  visibleTo,
  setVisibleTo,
  isAllSelected,
  onClose
}: {
  students: any[];
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

// --- Modal Wrapper ---
const Modal = ({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/45 h-full border backdrop-blur-md p-3">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[98vh] min-h-[80vh] flex flex-col overflow-hidden relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full z-10"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
};

const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

interface Topic { _id: string; title: string; }
interface User { _id: string; username?: string; name?: string; email?: string; }

interface AssignmentFormProps {
  courseInstanceId: string;
  courseName: string;
  onSuccess?: () => void;
}

export default function AssignmentForm({
  courseInstanceId,
  courseName,
  onSuccess,
}: AssignmentFormProps) {
  // --- Form States ---
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<string>("");
  const [newTopic, setNewTopic] = useState("");
  const [showTopicInput, setShowTopicInput] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [visibleTo, setVisibleTo] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalType, setModalType] = useState<"none" | "link" | "youtube" | "preview">("none");
  const [previewContent, setPreviewContent] = useState<React.ReactNode>(null);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [editorState, setEditorState] = useState(0);
  const [mutedStudents, setMutedStudents] = useState<string[]>([]);
  const [isMuteAll, setIsMuteAll] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);

  // New state for points and dueDate
  const [points, setPoints] = useState<number | "">("");
  const [dueDate, setDueDate] = useState<string>("");

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: "",
    editorProps: {
      attributes: {
        class: "min-h-[120px] outline-none px-3 py-2 prose prose-sm max-w-none",
      },
    },
    onSelectionUpdate: () => setEditorState(x => x + 1),
    onUpdate: () => setEditorState(x => x + 1),
    editable: true,
    immediatelyRender: false,
  });

  useEffect(() => { setMounted(true); }, []);
  // --- Fetch topics and students
  useEffect(() => {
    const token = localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${courseInstanceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setStudents(data.instance?.students || []))
      .catch(console.error);

    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/topic-api/course/${courseInstanceId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then(res => res.json())
      .then(data => setTopics(data.topics || []))
      .catch(() => setTopics([]));
  }, [courseInstanceId]);

  const isAllSelected = students.length > 0 && visibleTo.length === students.length;

  // --- Add Topic Handler
  async function handleAddTopic() {
    if (!newTopic.trim()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/topic-api/topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher")}` },
        body: JSON.stringify({ title: newTopic, courseInstance: courseInstanceId }),
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

  // --- FORM SUBMIT ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required!");
      return;
    }
    if (!editor?.getText().trim()) {
      toast.error("Content is required!");
      return;
    }
    if (!points) {
      toast.error("Points are required!");
      return;
    }
    if (!dueDate) {
      toast.error("Due date is required!");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", editor.getHTML());
      formData.append("courseInstance", courseInstanceId);
      formData.append("mutedStudents", JSON.stringify(mutedStudents));
      formData.append("points", String(points));
      formData.append("dueDate", new Date(dueDate).toISOString());

      if (topic) formData.append("topic", topic);
      if (links.length) formData.append("links", JSON.stringify(links));
      if (videos.length) formData.append("youtubeLinks", JSON.stringify(videos));
      images.forEach((f) => formData.append("media", f));
      docs.forEach((f) => formData.append("documents", f));
      formData.append(
        "visibleTo",
        isAllSelected ? JSON.stringify([]) : JSON.stringify(visibleTo)
      );
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/assignment/`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create assignment");
      setTitle(""); setDocs([]); setImages([]); setLinks([]); setVideos([]); setVisibleTo([]); setPoints(""); setDueDate("");
      editor?.commands.clearContent();
      setMessage("✅ Assignment posted!");
      toast.success("✅ Assignment posted!");
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <Modal isOpen={true} onClose={() => onSuccess?.()}>
      <form onSubmit={handleSubmit} className="flex flex-col h-[90vh] bg-white max-h-[90vh] w-full overflow-hidden">
        <Toaster position="top-right" />
        {/* 2 COLUMN FLEX GRID */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          <div className="flex flex-1 min-h-0 w-full  px-4 py-6 gap-8">
            {/* LEFT: Editor and Uploads */}
            <div className="flex-1 min-w-0 flex flex-col max-h-[68vh] overflow-y-auto">
              <input
                className="w-full text-xl bg-gray-100 rounded p-3 border-b-2 border-blue-400 focus:outline-none mb-3"
                placeholder="Assignment Title*"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              <div className="border-2 rounded-lg bg-gray-50 focus-within:border-blue-300 mb-3">
                <div className="p-3 pb-0">
                  <div className="text-sm text-gray-600 mb-2">Write your assignment</div>
                  <EditorContent editor={editor} />
                </div>
                <div className="flex gap-2 p-3 pt-2 border-t bg-white rounded-b-lg">
                  <button
                    type="button"
                    onClick={() => {
                      editor?.chain().focus().toggleBold().run();
                      setEditorState(x => x + 1);
                    }}
                    className={`px-3 py-1 rounded text-sm font-bold transition
    ${editor?.isActive("bold")
                        ? "bg-blue-600 text-white border border-blue-700 shadow font-extrabold scale-95"
                        : "hover:bg-blue-100 hover:text-blue-700"}`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor?.chain().focus().toggleItalic().run();
                      setEditorState(x => x + 1);
                    }}
                    className={`px-3 py-1 rounded text-sm italic transition
                  ${editor?.isActive("italic")
                        ? "bg-purple-600 text-white border border-purple-700 shadow scale-95"
                        : "hover:bg-purple-100 hover:text-purple-700"}`}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor?.chain().focus().toggleUnderline().run();
                      setEditorState(x => x + 1);
                    }}
                    className={`px-3 py-1 rounded text-sm underline transition
                  ${editor?.isActive("underline")
                        ? "bg-green-600 text-white border border-green-700 shadow scale-95"
                        : "hover:bg-green-100 hover:text-green-700"}`}
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    className={`px-3 py-1 rounded text-sm hover:bg-gray-100 ${editor?.isActive("bulletList")
                      ? "bg-blue-100 text-blue-700"
                      : ""}`}
                  >
                    • List
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                    className={`px-3 py-1 rounded text-sm hover:bg-gray-100 ${editor?.isActive("orderedList")
                      ? "bg-blue-100 text-blue-700"
                      : ""}`}
                  >
                    1. List
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
                    className="px-3 py-1 rounded text-sm hover:bg-gray-100 text-red-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {/* Media/Docs/Links/Youtube Controls */}
              <div className="flex gap-4 mb-2">
                {/* Images */}
                <label className="cursor-pointer group">
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setImages((prev) => [...prev, ...files]);
                    }}
                  />
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-blue-500 group-hover:bg-blue-50">
                    <ImageIcon size={20} className="text-gray-500 group-hover:text-blue-500" />
                  </div>
                  <div className="text-xs text-center mt-1 text-gray-500">Images</div>
                </label>
                {/* YouTube */}
                <button
                  type="button"
                  onClick={() => {
                    setYoutubeInput("");
                    setYoutubeError("");
                    setModalType("youtube");
                  }}
                  className="group"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-red-500 group-hover:bg-red-50">
                    <YoutubeIcon size={20} className="text-gray-500 group-hover:text-red-500" />
                  </div>
                  <div className="text-xs text-center mt-1 text-gray-500">YouTube</div>
                </button>
                {/* Documents */}
                <label className="cursor-pointer group">
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.csv,.xls,.xlsx,.txt"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setDocs((prev) => [...prev, ...files]);
                    }}
                  />
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-green-500 group-hover:bg-green-50">
                    <FileTextIcon size={20} className="text-gray-500 group-hover:text-green-500" />
                  </div>
                  <div className="text-xs text-center mt-1 text-gray-500">Documents</div>
                </label>
                {/* Links */}
                <button
                  type="button"
                  onClick={() => {
                    setLinkInput("");
                    setLinkError("");
                    setModalType("link");
                  }}
                  className="group"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-purple-500 group-hover:bg-purple-50">
                    <LinkIcon size={20} className="text-gray-500 group-hover:text-purple-500" />
                  </div>
                  <div className="text-xs text-center mt-1 text-gray-500">Links</div>
                </button>
              </div>
            </div>
            {/* RIGHT: Sidebar */}
            <div className="w-[340px] flex-shrink-0 h-fit flex flex-col gap-5 bg-gray-50 rounded-2xl border border-gray-200 p-6">
              <div>
                <div className="text-gray-600 font-semibold mb-1">Course</div>
                <div className="bg-white rounded p-3 text-blue-800 font-medium border text-center">{courseName}</div>
              </div>
              {/* Assign to */}
              <div>
                <div className="text-gray-600 font-semibold mb-1">People</div>
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
                    <button
                      type="button"
                      className="p-2 hover:bg-gray-100 rounded"
                      onClick={() => {
                        setShowTopicInput(false);
                        setNewTopic("");
                      }}
                      title="Cancel"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <select
                    className="w-full bg-white rounded p-3 mt-1 border"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                  >
                    <option value="">No topic</option>
                    {topics.map(t => (
                      <option key={t._id} value={t._id}>{t.title}</option>
                    ))}
                  </select>
                )}
              </div>
              {/* Points */}
              <div>
                <div className="text-gray-600 font-semibold mb-1">Points</div>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  required
                  className="w-full bg-white rounded p-3 border"
                  placeholder="Total Points (e.g., 10)"
                  value={points}
                  onChange={e => setPoints(Number(e.target.value) || "")}
                />
              </div>
              {/* Due Date */}
              <div>
                <div className="text-gray-600 font-semibold mb-1">Due Date</div>
                <input
                  type="datetime-local"
                  required
                  className="w-full bg-white rounded p-3 border"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
              {/* --- Mute All & Select to Mute --- */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <label className="font-semibold text-gray-600">Mute</label>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-sm font-medium border ${isMuteAll ? "bg-gray-700 text-white border-gray-800" : "bg-gray-200 text-gray-700 border-gray-300"} hover:bg-gray-800 hover:text-white transition`}
                    onClick={() => {
                      if (!isMuteAll) setMutedStudents(students.map(s => s._id));
                      else setMutedStudents([]);
                      setIsMuteAll(!isMuteAll);
                    }}
                  >
                    {isMuteAll ? "Unmute All" : "Mute All"}
                  </button>
                </div>
                <button
                  type="button"
                  className="w-full border rounded-full px-4 py-2 bg-white text-gray-700 hover:border-blue-400 transition mb-1"
                  onClick={() => setShowMuteModal(true)}
                >
                  Select Students to Mute
                </button>
                <div className="text-xs text-gray-500 mt-1">
                  {mutedStudents.length
                    ? `Muted: ${mutedStudents.length} student${mutedStudents.length > 1 ? "s" : ""}`
                    : "No students muted"}
                </div>
              </div>
            </div>
          </div>
          {/* Preview Bar Below (Scrollable) */}
           {(images.length > 0 || docs.length > 0 || videos.length > 0 || links.length > 0) && (
            <div className="w-full px-8 pb-5 flex flex-col gap-6 items-start bg-gray-50 max-h-[180px] overflow-x-auto overflow-y-auto">
            {/* Images Row */}
            {images.length > 0 && (
              <div className="w-full">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Images</h4>
                <div className="flex flex-wrap gap-2">
                  {images.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white p-2 rounded shadow border">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-20 h-16 object-cover rounded cursor-pointer"
                        onClick={() => {
                          setPreviewContent(
                            <div className="p-4">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="max-w-full max-h-[80vh] object-contain mx-auto"
                              />
                              <p className="text-center mt-2 text-gray-600">
                                {file.name}
                              </p>
                            </div>
                          );
                          setModalType("preview");
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                        className="text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Documents Row */}
            {docs.length > 0 && (
              <div className="w-full">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Documents</h4>
                <div className="flex flex-wrap gap-2">
                  {docs.map((file, i) => {
                    const isPDF = file.type === "application/pdf";
                    const blobUrl = URL.createObjectURL(file);
                    return (
                      <div key={i} className="flex items-center gap-2 bg-white p-2 rounded shadow border">
                        <FileTextIcon size={20} className="text-blue-600" />
                        <span className="text-xs">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewContent(
                              <div className="p-4">
                                {isPDF ? (
                                  <iframe src={blobUrl} title={file.name} width="700" height="500" className="rounded border" />
                                ) : (
                                  <div>
                                    <p className="mb-2">{file.name}</p>
                                    <a href={blobUrl} download={file.name} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                                      Download file
                                    </a>
                                    <div className="mt-2 text-xs text-gray-400">Preview for this document type is not available.</div>
                                  </div>
                                )}
                              </div>
                            );
                            setModalType("preview");
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          <ZoomIn size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocs(d => d.filter((_, idx) => idx !== i))}
                          className="text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* YouTube Videos Row */}
            {videos.length > 0 && (
              <div className="w-full">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Videos</h4>
                <div className="flex flex-wrap gap-2">
                  {videos.map((url, i) => {
                    const videoId = getYouTubeVideoId(url);
                    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
                    return (
                      <div key={i} className="bg-white rounded shadow border overflow-hidden flex">
                        <div
                          className="cursor-pointer"
                          onClick={() => {
                            setPreviewContent(
                              <div className="p-4">
                                <iframe
                                  width="850"
                                  height="480"
                                  src={embedUrl}
                                  title="YouTube video"
                                  allowFullScreen
                                  className="rounded"
                                />
                              </div>
                            );
                            setModalType("preview");
                          }}
                        >
                          <iframe
                            width="180"
                            height="100"
                            src={embedUrl}
                            title="YouTube video"
                            allowFullScreen
                            className="pointer-events-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setVideos(vid => vid.filter((_, idx) => idx !== i))}
                          className="text-red-500 p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Links Row */}
            {links.length > 0 && (
              <div className="w-full">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Links</h4>
                <div className="flex flex-wrap gap-2">
                  {links.map((url, i) => (
                    <div key={i} className="bg-white p-2 rounded shadow border flex items-center gap-2">
                      <LinkIcon size={14} className="text-green-600" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        {url.length > 30 ? `${url.slice(0, 30)}…` : url}
                      </a>
                      <button
                        type="button"
                        onClick={() => setLinks(l => l.filter((_, idx) => idx !== i))}
                        className="text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
             )}
        </div>
     
        {/* Footer */}
        <div className="border-t bg-white py-4 px-8 flex justify-between items-center sticky bottom-0 z-20">
          <button
            type="button"
            className="text-gray-500 text-sm hover:text-gray-700"
            onClick={() => {
              setTitle(""); setImages([]); setDocs([]); setVideos([]); setLinks([]); setVisibleTo([]); setTopic(""); editor?.commands.clearContent(); setMessage(null); setPoints(""); setDueDate("");
              onSuccess?.();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="bg-blue-600 text-white px-8 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {loading ? "Posting..." : "Post Assignment"}
          </button>
        </div>
      </form>
      {/* Modals */}
      <Modal isOpen={modalType !== "none"} onClose={() => setModalType("none")}>
        {modalType === "link" && (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2">Add External Link</h2>
            <input
              type="url"
              autoFocus
              className="w-full p-2 border rounded mb-2"
              placeholder="https://example.com"
              onChange={(e) => setLinkInput(e.target.value)}
              value={linkInput}
            />
            {linkError && (
              <div className="text-red-600 text-xs mb-2">{linkError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalType("none")}
                className="px-4 py-2 rounded bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    new URL(linkInput);
                    if (links.includes(linkInput)) {
                      setLinkError("Link already added.");
                      return;
                    }
                    setLinks((prev) => [...prev, linkInput]);
                    setLinkInput("");
                    setLinkError("");
                    setModalType("none");
                  } catch {
                    setLinkError("Invalid URL.");
                  }
                }}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                Add
              </button>
            </div>
          </div>
        )}
        {modalType === "youtube" && (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2">Add YouTube Video</h2>
            <input
              type="url"
              autoFocus
              className="w-full p-2 border rounded mb-2"
              placeholder="Paste YouTube URL"
              onChange={(e) => setYoutubeInput(e.target.value)}
              value={youtubeInput}
            />
            {youtubeError && (
              <div className="text-red-600 text-xs mb-2">{youtubeError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalType("none")}
                className="px-4 py-2 rounded bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const id = getYouTubeVideoId(youtubeInput);
                  if (!id) {
                    setYoutubeError("Please enter a valid YouTube URL");
                    return;
                  }
                  if (videos.includes(youtubeInput)) {
                    setYoutubeError("Video already added.");
                    return;
                  }
                  setVideos((prev) => [...prev, youtubeInput]);
                  setYoutubeInput("");
                  setYoutubeError("");
                  setModalType("none");
                }}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                Add
              </button>
            </div>
          </div>
        )}
        {modalType === "preview" && previewContent}
      </Modal>
      {/* Recipients Modal */}
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
      {/* Mute Students Modal */}
      {showMuteModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-lg">Mute Students</span>
              <button onClick={() => setShowMuteModal(false)}><X /></button>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-2">
              {students.map(s => (
                <label key={s._id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mutedStudents.includes(s._id)}
                    onChange={() => {
                      setMutedStudents(mutedStudents.includes(s._id)
                        ? mutedStudents.filter(id => id !== s._id)
                        : [...mutedStudents, s._id]
                      );
                    }}
                  />
                  {s.username || s.email}
                </label>
              ))}
            </div>
            <div className="flex justify-end pt-4 gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-100"
                onClick={() => setShowMuteModal(false)}
              >Done</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
