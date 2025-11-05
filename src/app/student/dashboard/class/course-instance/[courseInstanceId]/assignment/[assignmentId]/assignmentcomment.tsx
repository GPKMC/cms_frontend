"use client";
import React, { useEffect, useState } from "react";
import { MessageCircle, MoreVertical, Edit2, Trash2, Send } from "lucide-react";
import TiptapEditor from "@/app/student/dashboard/class/course-instance/[courseInstanceId]/components/rtecomponet";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/app/student/dashboard/studentContext";
import { useSearchParams } from "next/navigation";

type CommentObj = {
  _id: string;
  content: string;
  postedBy: { _id: string; username: string };
  createdAt?: string;
};

interface Props {
  assignmentId: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function AssignmentCommentSection({ assignmentId }: Props) {
  const { user } = useUser();
  const [comments, setComments] = useState<CommentObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [comment, setComment] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [editPosting, setEditPosting] = useState(false);

  const searchParams = useSearchParams();
  // ✅ Use optional chaining so TS is happy
  const highlightCommentId = searchParams?.get("commentId") ?? null;

  // Fetch comments on mount/assignmentId change
  useEffect(() => {
    if (!assignmentId) return;
    setLoading(true);
    fetch(`${BACKEND_URL}/comment/assignment-comments/${assignmentId}`)
      .then((r) => r.json())
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  // Highlight + scroll to comment if needed
  useEffect(() => {
    if (highlightCommentId && comments.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`comment-${highlightCommentId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-blue-500", "bg-blue-50", "transition");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-blue-500", "bg-blue-50", "transition");
          }, 2000); // highlight for 2s
        }
      }, 300);
    }
  }, [comments, highlightCommentId]);

  // Post new comment
  async function handlePostComment() {
    if (!comment.replace(/<[^>]+>/g, "").trim()) return;
    setPosting(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/comment/assignment-comments/${assignmentId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer " +
              (localStorage.getItem("token_student") ||
                sessionStorage.getItem("token_student") ||
                ""),
          },
          body: JSON.stringify({ content: comment }),
        }
      );
      if (!res.ok) throw new Error("Failed to post comment");
      const data = await res.json();
      setComments((prev) => [data.comment, ...prev]);
      setComment(""); // clear editor
    } catch (err) {
      alert("Could not post comment");
    } finally {
      setPosting(false);
    }
  }

  // Delete comment
  async function handleDelete(commentId: string) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/comment/assignment-comments/${commentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Bearer " +
              (localStorage.getItem("token_student") ||
                sessionStorage.getItem("token_student") ||
                ""),
          },
        }
      );
      if (!res.ok) throw new Error("Failed to delete comment");
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      alert("Failed to delete comment.");
    }
  }

  // Edit comment
  async function handleEditSave(commentId: string) {
    setEditPosting(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/comment/assignment-comments/${commentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer " +
              (localStorage.getItem("token_student") ||
                sessionStorage.getItem("token_student") ||
                ""),
          },
          body: JSON.stringify({ content: editContent }),
        }
      );
      if (!res.ok) throw new Error("Failed to update comment");
      const data = await res.json();
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId ? { ...c, content: data.comment.content } : c
        )
      );
      setEditId(null);
      setEditContent("");
    } catch (err) {
      alert("Failed to update comment.");
    } finally {
      setEditPosting(false);
    }
  }

  function getUserId(user: any): string | undefined {
    return user?._id || user?.id;
  }

  const myUserId = getUserId(user);

  return (
    <div className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <MessageCircle className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Class Discussion</h3>
      </div>

      {/* List of comments */}
      <div className="space-y-6 mb-8">
        {loading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="text-gray-400 text-sm">No comments yet. Start the discussion!</div>
        ) : (
          comments.map((c, i) => {
            const commentUserId = c.postedBy?._id;
            const isEditing = editId === c._id;
            return (
              <div
                key={c._id || i}
                id={`comment-${c._id}`}
                className="border-b last:border-0 pb-4 relative group"
              >
                <div className="flex gap-2 items-center text-sm mb-1">
                  <span className="font-semibold text-blue-700">
                    {c.postedBy?.username || "Unknown"}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {c.createdAt
                      ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })
                      : ""}
                  </span>
                </div>

                {/* Three-dot menu */}
                {myUserId && commentUserId === myUserId && !isEditing && (
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      className="p-1 rounded hover:bg-gray-200"
                      onClick={() => setMenuOpenId(menuOpenId === c._id ? null : c._id)}
                    >
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                    {menuOpenId === c._id && (
                      <div className="absolute right-0 mt-2 z-50 bg-white border border-gray-200 rounded-lg shadow-md w-28">
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setEditId(c._id);
                            setEditContent(c.content);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 hover:bg-gray-100"
                        >
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setDeleteConfirmId(c._id);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 hover:bg-gray-100 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit Mode */}
                {isEditing ? (
                  <div className="mt-2">
                    <TiptapEditor
                      content={editContent}
                      onChange={setEditContent}
                      placeholder="Edit your comment..."
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        disabled={editPosting}
                        onClick={() => handleEditSave(c._id)}
                      >
                        {editPosting ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                        onClick={() => {
                          setEditId(null);
                          setEditContent("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="prose max-w-none text-gray-800 announcement-content"
                    dangerouslySetInnerHTML={{ __html: c.content }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Comment box */}
      <div className="flex gap-4">
        <div className="flex-1">
          <TiptapEditor
            content={comment}
            onChange={setComment}
            placeholder="Share your thoughts or ask questions about this assignment..."
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-500">
              {comment.replace(/<[^>]+>/g, "").length}/500 characters
            </div>
            <button
              disabled={posting || comment.replace(/<[^>]+>/g, "").length === 0}
              onClick={handlePostComment}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Post Comment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-4">Delete Comment?</h2>
            <p className="mb-6 text-gray-600">
              Are you sure you want to permanently delete this comment? This cannot be undone.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  await handleDelete(deleteConfirmId!);
                  setDeleteConfirmId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
