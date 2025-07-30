"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  ImageIcon, YoutubeIcon, FileTextIcon, LinkIcon, X, ZoomIn,
  Play, ExternalLink, Trash2
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

import toast, { Toaster } from 'react-hot-toast';
import { useUser } from "@/app/student/dashboard/studentContext";

interface User {
  _id: string;
  username?: string;
  name?: string;
  email?: string;
}

// Modal wrapper
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
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden relative shadow-2xl">
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

function hasChanged(a: any[], b: any[]) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

interface EditAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcementId: string;
  courseInstanceId: string;
  onSuccess?: () => void;
}

export default function EditAnnouncementModal({
  isOpen,
  onClose,
  announcementId,
  courseInstanceId,
  onSuccess,
}: EditAnnouncementModalProps) {
  // States
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Recipients
  const [showRecipients, setShowRecipients] = useState(false);
  const [students, setStudents] = useState<User[]>([]);
  const [visibleTo, setVisibleTo] = useState<string[]>([]);
  const [editorStateVersion, setEditorStateVersion] = useState(0);

  // File/link/video states (current)
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imagesToAdd, setImagesToAdd] = useState<File[]>([]);
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [docsToAdd, setDocsToAdd] = useState<File[]>([]);
  const [docsToRemove, setDocsToRemove] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);

  // Originals for change detection
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [originalDocs, setOriginalDocs] = useState<string[]>([]);
  const [originalVideos, setOriginalVideos] = useState<string[]>([]);
  const [originalLinks, setOriginalLinks] = useState<string[]>([]);
  const [originalVisibleTo, setOriginalVisibleTo] = useState<string[]>([]);

  // UI
  const [modalType, setModalType] = useState<"none" | "link" | "youtube" | "preview">("none");
  const [previewContent, setPreviewContent] = useState<React.ReactNode>(null);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
const [fetchedContent, setFetchedContent] = useState("");

  const { user } = useUser();
  const role = user?.role || "student";

  // TipTap
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: "",
    editorProps: {
      attributes: {
        class: "min-h-[120px] outline-none px-3 py-2 prose prose-sm max-w-none",
      },
    },
    editable: true,
    immediatelyRender: false,
    onUpdate: ({ editor }) => setContent(editor.getHTML()),
  });
useEffect(() => {
  if (editor && fetchedContent !== "") {
    editor.commands.setContent(fetchedContent);
  }
}, [editor, fetchedContent]);
  // Fetch data
  useEffect(() => {
    setMounted(true);
    if (!isOpen) return;
    setLoading(true);

    // 1. Fetch students for recipients
    if (role === "teacher") {
      const token = localStorage.getItem("token_student") || sessionStorage.getItem("token_student");
      fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${courseInstanceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setStudents(data.instance?.students || []))
        .catch(console.error);
    }

    // 2. Fetch announcement
    const token = localStorage.getItem("token_student") || sessionStorage.getItem("token_student");
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/announcement-routes/${announcementId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (!data.announcement) throw new Error("Announcement not found");
        const ann = data.announcement;
        // setContent(ann.content || "");
        setImages(ann.images || []);
        setOriginalImages(ann.images || []);
        setDocs(ann.documents || []);
        setOriginalDocs(ann.documents || []);
        setLinks(ann.links || []);
        setOriginalLinks(ann.links || []);
        setVideos(ann.youtubeLinks || []);
        setOriginalVideos(ann.youtubeLinks || []);
        setVisibleTo(Array.isArray(ann.visibleTo) ? ann.visibleTo : []);
        setOriginalVisibleTo(Array.isArray(ann.visibleTo) ? ann.visibleTo : []);
        // setTimeout(() => {
        //   editor?.commands.setContent(ann.content || "");
        // }, 0);
        setFetchedContent(ann.content || "");

      })
      .catch(err => toast.error("Failed to load announcement"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [isOpen, announcementId]);

  useEffect(() => {
    if (!editor) return;
    const update = () => setEditorStateVersion(v => v + 1);
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  const isAllSelected = students.length > 0 && visibleTo.length === students.length;

  // PATCH submit with only changed fields
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("token_student") || sessionStorage.getItem("token_student");
      const formData = new FormData();
      formData.append("content", editor.getHTML());

      if (hasChanged(links, originalLinks)) {
        formData.append("links", JSON.stringify(links));
      }
      if (hasChanged(videos, originalVideos)) {
        formData.append("videos", JSON.stringify(videos));
      }
      imagesToAdd.forEach(f => formData.append("attachments", f));
      docsToAdd.forEach(f => formData.append("attachments", f));
      if (imagesToRemove.length > 0) {
        formData.append("imagesToRemove", JSON.stringify(imagesToRemove));
      }
      if (docsToRemove.length > 0) {
        formData.append("docsToRemove", JSON.stringify(docsToRemove));
      }
      if (role === "teacher") {
        if (hasChanged(visibleTo, originalVisibleTo)) {
          formData.append(
            "visibleTo",
            isAllSelected ? JSON.stringify([]) : JSON.stringify(visibleTo)
          );
        }
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/announcement-routes/${announcementId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      toast.success("✅ Announcement updated!");
      setMessage("✅ Announcement updated!");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col h-[80vh] bg-white max-h-[80vh] w-full overflow-hidden"
      >
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <Toaster position="top-right" />
          <div>
            <div className="flex items-center gap-2 mb-4 relative">
              {role === "teacher" && students.length > 0 && (
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded bg-blue-50 border text-blue-700 font-medium shadow-sm"
                      onClick={() => setShowRecipients((v) => !v)}
                    >
                      Manage Recipients
                    </button>
                    <span className="text-sm text-gray-700">
                      {visibleTo.length === 0
                        ? "All students selected"
                        : `Selected: ${visibleTo.length} / ${students.length}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {/* <AnimatePresence>
              {showRecipients && (
                <RecipientsPanel
                  students={students}
                  visibleTo={visibleTo}
                  setVisibleTo={setVisibleTo}
                  isAllSelected={isAllSelected}
                />
              )}
            </AnimatePresence> */}
          </div>
          {/* Editor */}
          <div className="border-2 rounded-lg bg-gray-50 focus-within:border-blue-300">
            <div className="p-3 pb-0">
              <div className="text-sm text-gray-600 mb-2">
                Edit your announcement
              </div>
              <EditorContent editor={editor} />
            </div>
            <div className="flex gap-2 p-3 pt-2 border-t bg-white rounded-b-lg">
              <button type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`px-3 py-1 rounded text-sm font-bold transition
                  ${editor?.isActive("bold")
                    ? "bg-blue-600 text-white border border-blue-700 shadow font-extrabold scale-95"
                    : "hover:bg-blue-100 hover:text-blue-700"}`}>B</button>
              <button type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`px-3 py-1 rounded text-sm italic transition
                  ${editor?.isActive("italic")
                    ? "bg-purple-600 text-white border border-purple-700 shadow scale-95"
                    : "hover:bg-purple-100 hover:text-purple-700"}`}>I</button>
              <button type="button"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                className={`px-3 py-1 rounded text-sm underline transition
                  ${editor?.isActive("underline")
                    ? "bg-green-600 text-white border border-green-700 shadow scale-95"
                    : "hover:bg-green-100 hover:text-green-700"}`}>U</button>
              <button type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={`px-3 py-1 rounded text-sm hover:bg-gray-100 ${editor?.isActive("bulletList")
                  ? "bg-blue-100 text-blue-700"
                  : ""}`}>• List</button>
              <button type="button"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className={`px-3 py-1 rounded text-sm hover:bg-gray-100 ${editor?.isActive("orderedList")
                  ? "bg-blue-100 text-blue-700"
                  : ""}`}>1. List</button>
              <button type="button"
                onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
                className="px-3 py-1 rounded text-sm hover:bg-gray-100 text-red-600"
              >Clear</button>
            </div>
          </div>
          {/* Existing Images (can remove) */}
          {images.map((img, i) =>
            imagesToRemove.includes(img) ? null : (
              <div key={i} className="flex items-center bg-gray-50 rounded p-2 mb-2">
                <img src={img.startsWith("http") ? img : process.env.NEXT_PUBLIC_BACKEND_URL + img}
                  className="w-16 h-16 object-cover rounded border mr-3" />
                <button type="button"
                  className="text-red-600 text-xs ml-auto"
                  onClick={() => setImagesToRemove(prev => [...prev, img])}
                >Remove</button>
              </div>
            )
          )}
          {/* New images */}
          {imagesToAdd.map((file, i) => (
            <div key={i} className="flex items-center bg-gray-50 rounded p-2 mb-2">
              <img src={URL.createObjectURL(file)} className="w-16 h-16 object-cover rounded border mr-3" />
              <span className="text-xs">{file.name}</span>
              <button type="button"
                className="text-red-600 text-xs ml-auto"
                onClick={() => setImagesToAdd(prev => prev.filter((_, idx) => idx !== i))}
              >Remove</button>
            </div>
          ))}
          {/* Existing Docs */}
          {docs.map((doc, i) =>
            docsToRemove.includes(doc) ? null : (
              <div key={i} className="flex items-center bg-gray-50 rounded p-2 mb-2">
                <FileTextIcon size={20} className="text-blue-600 mr-3" />
                <a href={doc.startsWith("http") ? doc : process.env.NEXT_PUBLIC_BACKEND_URL + doc}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline">{doc.split("/").pop()}</a>
                <button type="button"
                  className="text-red-600 text-xs ml-auto"
                  onClick={() => setDocsToRemove(prev => [...prev, doc])}
                >Remove</button>
              </div>
            )
          )}
          {/* New docs */}
          {docsToAdd.map((file, i) => (
            <div key={i} className="flex items-center bg-gray-50 rounded p-2 mb-2">
              <FileTextIcon size={20} className="text-blue-600 mr-3" />
              <span className="text-xs">{file.name}</span>
              <button type="button"
                className="text-red-600 text-xs ml-auto"
                onClick={() => setDocsToAdd(prev => prev.filter((_, idx) => idx !== i))}
              >Remove</button>
            </div>
          ))}
          {/* Videos */}
          {videos.map((url, i) => {
            const videoId = getYouTubeVideoId(url);
            const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
            return (
              <div key={i} className="bg-gray-50 rounded-lg border overflow-hidden">
                <div className="p-3 flex justify-between items-center bg-white border-b">
                  <div className="flex items-center gap-2">
                    <Play size={16} className="text-red-600" />
                    <span className="text-sm font-medium">YouTube Video</span>
                  </div>
                  <button type="button"
                    onClick={() => setVideos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  ><Trash2 size={16} /></button>
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
          {/* Links */}
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
                  onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {/* File pickers */}
          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
            <label className="cursor-pointer group">
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setImagesToAdd((prev) => [...prev, ...files]);
                }}
              />
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-blue-500 group-hover:bg-blue-50">
                <ImageIcon size={20} className="text-gray-500 group-hover:text-blue-500" />
              </div>
              <div className="text-xs text-center mt-1 text-gray-500">Images</div>
            </label>
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
            <label className="cursor-pointer group">
              <input
                type="file"
                hidden
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.csv,.xls,.xlsx,.txt"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setDocsToAdd((prev) => [...prev, ...files]);
                }}
              />
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-green-500 group-hover:bg-green-50">
                <FileTextIcon size={20} className="text-gray-500 group-hover:text-green-500" />
              </div>
              <div className="text-xs text-center mt-1 text-gray-500">Documents</div>
            </label>
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
          {/* Feedback */}
          {message && (
            <div
              className={`text-center text-sm p-3 rounded ${message.includes("✅")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
                }`}
            >
              {message}
            </div>
          )}
        </div>
        {/* Sticky Footer */}
        <div className="border-t bg-white py-4 px-6 flex justify-between items-center sticky bottom-0 z-20">
          <button
            type="button"
            className="text-gray-500 text-sm hover:text-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              loading ||
              !(
                editor?.getText().trim() ||
                images.length - imagesToRemove.length > 0 ||
                imagesToAdd.length > 0 ||
                docs.length - docsToRemove.length > 0 ||
                docsToAdd.length > 0 ||
                videos.length > 0 ||
                links.length > 0
              )
            }
            className="bg-blue-600 text-white px-8 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {loading ? "Updating..." : "Update Announcement"}
          </button>
        </div>
      </form>
      {/* Modal for Link/Youtube/Preview */}
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
    </Modal>
  );
}
