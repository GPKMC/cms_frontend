"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  ImageIcon,
  YoutubeIcon,
  FileTextIcon,
  LinkIcon,
  X,
  ZoomIn,
  Play,
  ExternalLink,
  Trash2
} from "lucide-react";
import { useUser } from "../../teacherContext";

interface AnnouncementFormProps {
  courseInstanceId: string;
  onSuccess?: () => void;
}

interface User {
  _id: string;
  username?: string;
  name?: string;
  email?: string;
}

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto relative">
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

export default function AnnouncementForm({
  courseInstanceId,
  onSuccess,
}: AnnouncementFormProps) {
  // Core state
  const [images, setImages] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Modal state
  const [modalType, setModalType] = useState<"none" | "link" | "youtube" | "preview">("none");
  const [previewContent, setPreviewContent] = useState<React.ReactNode>(null);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [youtubeError, setYoutubeError] = useState("");

  // Visible‐to logic
  const [students, setStudents] = useState<User[]>([]);
  const [visibleTo, setVisibleTo] = useState<string[]>([]);
        // <-- Use context
  const { user } = useUser();         // <-- Use context
  const role = user?.role || "student";
  // TipTap editor
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: "",
    editorProps: {
      attributes: {
        class: "min-h-[120px] outline-none px-3 py-2 prose prose-sm max-w-none",
      },
    },
    editable: true,
    injectCSS: false,
    immediatelyRender: false,
  });

  // Load user role + student list if teacher
useEffect(() => {
    setMounted(true);

    // Only fetch students if user is teacher
    if (role === "teacher") {
      const token =
        localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher");
      fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${courseInstanceId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
        .then((res) => res.json())
        .then((data) => {
          setStudents(data.instance?.students || []);
        })
        .catch(console.error);
    }
  }, [courseInstanceId, role]);



  const isAllSelected =
    students.length > 0 && visibleTo.length === students.length;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    setLoading(true);
    setMessage(null);
    try {
      const token =
        localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher");
      const formData = new FormData();
      formData.append("content", editor.getHTML());
      formData.append("courseInstance", courseInstanceId);
      if (videos.length) formData.append("videos", JSON.stringify(videos));
      if (links.length) formData.append("links", JSON.stringify(links));
      images.forEach((f) => formData.append("attachments", f));
      docs.forEach((f) => formData.append("attachments", f));

      if (role === "teacher") {
        // empty array => all students
        formData.append(
          "visibleTo",
          isAllSelected ? JSON.stringify([]) : JSON.stringify(visibleTo)
        );
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/announcement-routes/course-announcement`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to post");
      editor.commands.clearContent();
      setImages([]);
      setDocs([]);
      setVideos([]);
      setLinks([]);
      setVisibleTo([]);
      onSuccess?.();
      setMessage("✅ Posted successfully!");
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-6 shadow-lg space-y-4 max-w-4xl mx-auto"
      >
        {/* Course selector (read-only) */}
        <div className="flex items-center gap-4">
          <select
            className="p-2 border rounded bg-gray-100 text-sm"
            value={courseInstanceId}
            disabled
          >
            <option>{courseInstanceId}</option>
          </select>
        </div>

        {/* Teacher-only: pick which students see this */}
        {role === "teacher" && students.length > 0 && (
          <div>
            <label className="block mb-1 font-medium">
              Visible To (students):
            </label>
            <div className="mb-2 flex items-center">
              <input
                type="checkbox"
                id="select-all-students"
                checked={isAllSelected}
                onChange={(e) =>
                  e.target.checked
                    ? setVisibleTo(students.map((s) => s._id))
                    : setVisibleTo([])
                }
                className="mr-2"
              />
              <label
                htmlFor="select-all-students"
                className="cursor-pointer text-sm font-semibold"
              >
                Select All Students
              </label>
            </div>
            <div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
              {students.map((stu) => (
                <label
                  key={stu._id}
                  className="flex items-center gap-2 mb-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleTo.includes(stu._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVisibleTo((prev) => [...prev, stu._id]);
                      } else {
                        setVisibleTo((prev) =>
                          prev.filter((id) => id !== stu._id)
                        );
                      }
                    }}
                  />
                  <span>
                    {stu.name || stu.username}{" "}
                    {stu.email && (
                      <span className="text-xs text-gray-500">
                        ({stu.email})
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Leave all unchecked or use “Select All” to show to everyone.
            </div>
          </div>
        )}

        {/* Rich-text editor */}
        <div className="border-2 rounded-lg bg-gray-50 focus-within:border-blue-300">
          <div className="p-3 pb-0">
            <div className="text-sm text-gray-600 mb-2">
              Announce something to your class
            </div>
            <EditorContent editor={editor} />
          </div>
          <div className="flex gap-2 p-3 pt-2 border-t bg-white rounded-b-lg">
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`px-3 py-1 rounded text-sm font-bold hover:bg-gray-100 ${
                editor?.isActive("bold")
                  ? "bg-blue-100 text-blue-700"
                  : ""
              }`}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`px-3 py-1 rounded text-sm italic hover:bg-gray-100 ${
                editor?.isActive("italic")
                  ? "bg-blue-100 text-blue-700"
                  : ""
              }`}
            >
              I
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={`px-3 py-1 rounded text-sm underline hover:bg-gray-100 ${
                editor?.isActive("underline")
                  ? "bg-blue-100 text-blue-700"
                  : ""
              }`}
            >
              U
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={`px-3 py-1 rounded text-sm hover:bg-gray-100 ${
                editor?.isActive("bulletList")
                  ? "bg-blue-100 text-blue-700"
                  : ""
              }`}
            >
              • List
            </button>
            <button
              type="button"
              onClick={() =>
                editor?.chain().focus().toggleOrderedList().run()
              }
              className={`px-3 py-1 rounded text-sm hover:bg-gray-100 ${
                editor?.isActive("orderedList")
                  ? "bg-blue-100 text-blue-700"
                  : ""
              }`}
            >
              1. List
            </button>
            <button
              type="button"
              onClick={() =>
                editor?.chain().focus().clearNodes().unsetAllMarks().run()
              }
              className="px-3 py-1 rounded text-sm hover:bg-gray-100 text-red-600"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Image previews */}
        {images.map((file, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-20 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
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
                  className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow hover:bg-gray-100"
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
                >
                  <ZoomIn size={14} />
                </button>
              </div>
              <div>
                <div className="text-sm font-medium">{file.name}</div>
                <div className="text-xs text-gray-500">
                  Image • {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setImages((prev) => prev.filter((_, idx) => idx !== i))
              }
              className="p-2 text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {/* Video previews */}
        {videos.map((url, i) => {
          const videoId = getYouTubeVideoId(url);
          const embedUrl = videoId
            ? `https://www.youtube.com/embed/${videoId}`
            : url;
          return (
            <div
              key={i}
              className="bg-gray-50 rounded-lg border overflow-hidden"
            >
              <div className="p-3 flex justify-between items-center bg-white border-b">
                <div className="flex items-center gap-2">
                  <Play size={16} className="text-red-600" />
                  <span className="text-sm font-medium">YouTube Video</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setVideos((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div
                className="relative cursor-pointer"
                onClick={() => {
                  setPreviewContent(
                    <div className="p-4">
                      <iframe
                        width="800"
                        height="450"
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
                  width="100%"
                  height="200"
                  src={embedUrl}
                  title="YouTube video"
                  allowFullScreen
                  className="rounded-b-lg pointer-events-none"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 opacity-0 hover:opacity-100 transition-opacity">
                  <ZoomIn size={24} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Document previews */}
        {docs.map((file, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                <FileTextIcon size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium">{file.name}</div>
                <div className="text-xs text-gray-500">
                  {file.type || "Document"} •{" "}
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewContent(
                    <div className="p-6 text-center">
                      <FileTextIcon
                        size={48}
                        className="text-blue-600 mx-auto mb-4"
                      />
                      <h3 className="text-lg font-medium mb-2">{file.name}</h3>
                      <p className="text-gray-600 mb-4">
                        {file.type || "Document"} •{" "}
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <p className="text-sm text-gray-500">
                        Preview not available. Document will be attached.
                      </p>
                    </div>
                  );
                  setModalType("preview");
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setDocs((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="p-2 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {/* Link previews */}
        {links.map((url, i) => (
          <div
            key={i}
            className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded flex items-center justify-center">
                <LinkIcon size={20} className="text-green-600" />
              </div>
              <div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm font-medium"
                >
                  {url.length > 50 ? `${url.slice(0, 50)}…` : url}
                </a>
                <div className="text-xs text-gray-500">External Link</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
              >
                <ExternalLink size={16} />
              </a>
              <button
                type="button"
                onClick={() =>
                  setLinks((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="p-2 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {/* Upload controls */}
        <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
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

        {/* Actions */}
        <div className="flex justify-between items-center pt-4">
          <button
            type="button"
            className="text-gray-500 text-sm hover:text-gray-700"
            onClick={() => {
              editor?.commands.clearContent();
              setImages([]);
              setDocs([]);
              setVideos([]);
              setLinks([]);
              setVisibleTo([]);
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !editor?.getText().trim()}
            className="bg-blue-600 text-white px-8 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {loading ? "Posting..." : "Post Announcement"}
          </button>
        </div>

        {/* Feedback */}
        {message && (
          <div
            className={`text-center text-sm p-3 rounded ${
              message.includes("✅")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}
      </form>

      {/* Global Modal */}
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
    </>
  );
}
