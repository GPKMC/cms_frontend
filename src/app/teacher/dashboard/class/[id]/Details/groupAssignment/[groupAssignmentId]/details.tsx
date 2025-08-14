"use client";
import React, { useEffect, useState } from "react";
import {
  Loader2, AlertCircle, User, FileText, ExternalLink as LinkIcon, Image as ImageIcon, Youtube,
  Users, MessageSquare as MessageSquareIcon, Send, Calendar, BookOpen, Award, Eye,
  ChevronDown, ChevronUp, X
} from "lucide-react";
import { useUser } from "@/app/teacher/dashboard/teacherContext";

/* =========================
   Types
========================= */
type UserObj = { _id?: string; id?: string; username?: string; email?: string };
type FileObj = { url: string; originalname: string; filetype?: string };
type Discussion = { user: UserObj; message: string; createdAt: string };
type Participation = {
  user: UserObj;
  contribution?: string;
  files?: string[];
  messageCount?: number;
  discussionMinutes?: number;
};
type SubmissionFile = { url: string; originalname: string; mimetype?: string };
type Submission = {
  _id: string;
  status: "draft" | "submitted";
  files: SubmissionFile[];
  links: string[];
  submittedAt?: string;
  feedback?: string;
  grade?: number;
  youtubeLinks?: string[];
};

type GroupObj = {
  _id: string;
  name: string;
  task: string;
  title?: string;
  content?: string;
  members: UserObj[];
  media?: FileObj[];
  documents?: FileObj[];
  points?: number;
  youtubeLinks?: string[];
  links?: string[];
  marks?: number;
  feedback?: string;
  discussion?: Discussion[];
  participation?: Participation[];
  submissions?: Submission[]; // group submissions here
};

type Assignment = {
  _id: string;
  title?: string;
  content?: string;
  postedBy?: UserObj;
  courseInstance?: { course: string; batch: string };
  topic?: { title?: string };
  dueDate?: string;
  media?: FileObj[];
  documents?: FileObj[];
  links?: string[];
  youtubeLinks?: string[];
  groups: GroupObj[];
  acceptingSubmissions?: boolean;   // NEW
  closeAt?: string | null;          // NEW
  points?: number;
  createdAt?: string;
};

type GroupAssignmentProps = {
  classId: string;
  groupAssignmentId: string;
};

/* =========================
   Helpers
========================= */
function getFileUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `http://localhost:5000${url.startsWith("/") ? url : "/" + url}`;
}
const isOfficeDoc = (filename: string) => /\.(docx?|pptx?|xlsx?)$/i.test(filename);
const isImage = (filename: string) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(filename);
const getYouTubeId = (url: string) => {
  const m = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return m ? m[1] : null;
};

// Any attachments on a group?
const groupHasAssets = (g: GroupObj) =>
  (g.media?.length || 0) +
  (g.documents?.length || 0) +
  (g.links?.length || 0) +
  (g.youtubeLinks?.length || 0) > 0;

/* =========================
   Image Modal
========================= */
function ImageModal({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  if (!src) return null;
  return (
    <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/70">
      <div className="relative bg-white rounded-2xl shadow-xl p-4 max-w-3xl max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-gray-200 rounded-full p-2 hover:bg-gray-300 z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <img src={src} alt={alt || "Preview"} className="rounded-xl max-w-[70vw] max-h-[70vh] object-contain" />
      </div>
    </div>
  );
}

/* =========================
   Main Component
========================= */
export default function GroupAssignmentDetail({ classId, groupAssignmentId }: GroupAssignmentProps) {
  const { user } = useUser() || {};
  const myUserId = user?.id || user?._id || "";
  const [submitting] = useState(false); // kept for future actions

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [imgModal, setImgModal] = useState<{ src: string; alt?: string } | null>(null);
  const [groupUndoState, setGroupUndoState] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const [plagResults, setPlagResults] = useState<Record<string, any>>({});
  const [activeGroupForModal, setActiveGroupForModal] = useState<string | null>(null);
  const [groupSubmissions, setGroupSubmissions] = useState<Record<string, Submission | null>>({});

  const setLoadingUndo = (groupId: string, loading: boolean) =>
    setGroupUndoState((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), loading } }));
  const setUndoError = (groupId: string, error: string | null) =>
    setGroupUndoState((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), error } }));

  function onGroupPlagCheck(groupId: string, result: any) {
    setPlagResults((r) => ({ ...r, [groupId]: result }));
    setActiveGroupForModal(groupId);
  }

  // Fetch assignment
  const fetchAssignment = () => {
    if (!groupAssignmentId) return;
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/group-assignment/${groupAssignmentId}`, {
      headers: {
        Authorization:
          "Bearer " +
          (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher") || ""),
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch");
        setAssignment(data.assignment);
        // Expand user's group(s) by default
        const expand: Record<string, boolean> = {};
        (data.assignment.groups || []).forEach((g: GroupObj) => {
          expand[g._id] = !!(myUserId && g.members.some((m: UserObj) => (m._id || m.id) === myUserId));
        });
        setExpandedGroups(expand);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(fetchAssignment, [groupAssignmentId, myUserId]);

  // Compute myGroups (for student view if needed; teacher view shows all)
  const myGroups: GroupObj[] =
    assignment?.groups?.filter(
      (g) => myUserId && g.members.some((m) => (m._id || m.id) === myUserId)
    ) || [];

  // Fetch submissions for each of my groups (kept from your code)
  useEffect(() => {
    if (!assignment || !myUserId) return;

    const fetchAllGroupSubmissions = async () => {
      const newGroupSubs: Record<string, Submission | null> = {};
      await Promise.all(
        myGroups.map(async (group) => {
          try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/groupsubmission/by-assignment/${assignment._id}/${group._id}`,
              {
                headers: {
                  Authorization:
                    "Bearer " +
                    (localStorage.getItem("token_teacher") ||
                      sessionStorage.getItem("token_teacher") ||
                      ""),
                },
              }
            );
            if (res.ok) {
              const data = await res.json();
              newGroupSubs[group._id] = data.submission;
            } else {
              newGroupSubs[group._id] = null; // no submission found
            }
          } catch {
            newGroupSubs[group._id] = null;
          }
        })
      );
      setGroupSubmissions(newGroupSubs);
    };

    fetchAllGroupSubmissions();
  }, [assignment, myUserId]); // do not depend on myGroups to avoid loops

  // Submission window helpers (kept)
  const now = new Date();
  const accepting = assignment?.acceptingSubmissions !== false;
  const closeAt = assignment?.closeAt ? new Date(assignment.closeAt) : null;
  const isPastClose = closeAt ? now > closeAt : false;
  const canSubmit = accepting && !isPastClose;

  // Discussion post
  const handlePost = async (groupIdx: number, group: GroupObj) => {
    const msg = newMsg[group._id]?.trim();
    if (!msg) return;
    setPosting((p) => ({ ...p, [group._id]: true }));
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/group-assignment/${groupAssignmentId}/group/${groupIdx}/discussion`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer " +
              (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher") || ""),
          },
          body: JSON.stringify({ message: msg }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).message || "Failed to post");
      setNewMsg((n) => ({ ...n, [group._id]: "" }));
      fetchAssignment();
    } catch (e: any) {
      alert(e.message || "Failed to post message");
    } finally {
      setPosting((p) => ({ ...p, [group._id]: false }));
    }
  };

  const toggleGroup = (groupId: string) =>
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  const getDaysUntilDue = (dueDate?: string) => {
    if (!dueDate) return null;
    return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Loader2 className="animate-spin w-6 h-6 text-blue-600" />
      </div>
    );
  }
  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-700 bg-white px-6 py-4 rounded-xl shadow">
          <AlertCircle className="w-5 h-5" />
          {err}
        </div>
      </div>
    );
  }
  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 bg-white px-6 py-4 rounded-xl shadow">No assignment found.</div>
      </div>
    );
  }

  const daysUntilDue = assignment.dueDate ? getDaysUntilDue(assignment.dueDate) : null;

  // Teacher sees all groups; student could be switched to myGroups
  const groupsToRender: GroupObj[] = assignment.groups || [];

  // If ANY group has its own attachments, hide global attachments
  const anyGroupHasAssets = groupsToRender.some(groupHasAssets);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {imgModal?.src && (
        <ImageModal src={imgModal.src} alt={imgModal.alt} onClose={() => setImgModal(null)} />
      )}
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                  <BookOpen className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{assignment.title || "Untitled Group Assignment"}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-white/80 mt-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{assignment.postedBy?.username || assignment.postedBy?.email || "Unknown Teacher"}</span>
                    </div>
                    {assignment.courseInstance?.course && assignment.courseInstance?.batch && (
                      <>
                        <span>•</span>
                        <span>
                          {assignment.courseInstance.course} ({assignment.courseInstance.batch})
                        </span>
                      </>
                    )}
                    {assignment.topic?.title && (
                      <>
                        <span>•</span>
                        <span>Topic: {assignment.topic.title}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {assignment.dueDate && (
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5" />
                    <div>
                      <div className="font-semibold">Due Date</div>
                      <div className="text-sm">{new Date(assignment.dueDate).toLocaleString()}</div>
                      {daysUntilDue !== null && (
                        <div
                          className={`text-sm font-medium mt-1 ${
                            daysUntilDue < 3
                              ? "text-red-200"
                              : daysUntilDue < 7
                              ? "text-yellow-200"
                              : "text-green-200"
                          }`}
                        >
                          {daysUntilDue > 0
                            ? `${daysUntilDue} days remaining`
                            : daysUntilDue === 0
                            ? "Due today!"
                            : "Overdue"}
                        </div>
                      )}
                    </div>
                    {assignment.points && (
                      <div className="ml-auto text-right">
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5" />
                          <span className="text-2xl font-bold">{assignment.points}</span>
                        </div>
                        <div className="text-sm text-white/80">points</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-8">
            {assignment.content && (
              <div
                className="prose prose-lg max-w-none mb-6 text-gray-700 leading-relaxed announcement-content"
                dangerouslySetInnerHTML={{ __html: assignment.content }}
              />
            )}

            {/* Global Resources — only show if no group has its own attachments */}
            {!anyGroupHasAssets && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {assignment.media?.length ? (
                  <ResourceCard
                    icon={<ImageIcon className="w-5 h-5 text-purple-600" />}
                    title="Media Files"
                    items={assignment.media.map((f) => ({ url: getFileUrl(f.url), label: f.originalname }))}
                    type="media"
                    onImageClick={setImgModal}
                  />
                ) : null}

                {assignment.documents?.length ? (
                  <ResourceCard
                    icon={<FileText className="w-5 h-5 text-blue-600" />}
                    title="Documents"
                    items={assignment.documents.map((f) => ({ url: getFileUrl(f.url), label: f.originalname }))}
                    type="doc"
                  />
                ) : null}

                {assignment.links?.length ? (
                  <ResourceCard
                    icon={<LinkIcon className="w-5 h-5 text-green-600" />}
                    title="Links"
                    items={(assignment.links || []).map((l) => ({ url: l, label: l }))}
                  />
                ) : null}

                {assignment.youtubeLinks?.length ? (
                  <ResourceCard
                    icon={<Youtube className="w-5 h-5 text-red-600" />}
                    title="YouTube Links"
                    items={(assignment.youtubeLinks || []).map((l, i) => ({ url: l, label: `Video ${i + 1}` }))}
                    type="youtube"
                  />
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* ===== Group-wise view ===== */}
        <div className="space-y-6">
          {groupsToRender.map((g, idx) => {
            const showAssets = groupHasAssets(g);
            const groupTitle = g.title || `${g.name || `Group ${idx + 1}`}`;
            const groupContent = g.content || ""; // if empty, we can optionally fallback to assignment.content

            return (
              <div key={g._id} className="bg-white rounded-2xl shadow border">
                {/* Group header */}
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <div>
                      <div className="font-semibold">{groupTitle}</div>
                      <div className="text-sm text-gray-500">
                        Members: {g.members?.map((m) => m.username || m.email).join(", ") || "—"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleGroup(g._id)}
                    className="text-sm flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                  >
                    {expandedGroups[g._id] ? (
                      <>
                        <ChevronUp className="w-4 h-4" /> Collapse
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" /> Expand
                      </>
                    )}
                  </button>
                </div>

                {expandedGroups[g._id] && (
                  <div className="p-6 space-y-5">
                    {/* Group content (question/description) */}
                    {groupContent ? (
                      <div
                        className="prose prose-lg max-w-none text-gray-700 leading-relaxed announcement-content"
                        dangerouslySetInnerHTML={{ __html: groupContent }}
                      />
                    ) : assignment.content ? (
                      // fallback to parent content only if group has no own content
                      <div
                        className="prose prose-lg max-w-none text-gray-700 leading-relaxed announcement-content"
                        dangerouslySetInnerHTML={{ __html: assignment.content }}
                      />
                    ) : null}

                    {/* Group attachments — ONLY these (parent hidden globally if any group has assets) */}
                    {showAssets && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {g.media?.length ? (
                          <ResourceCard
                            icon={<ImageIcon className="w-5 h-5 text-purple-600" />}
                            title="Group Media"
                            items={g.media.map((f) => ({ url: getFileUrl(f.url), label: f.originalname }))}
                            type="media"
                            onImageClick={setImgModal}
                          />
                        ) : null}

                        {g.documents?.length ? (
                          <ResourceCard
                            icon={<FileText className="w-5 h-5 text-blue-600" />}
                            title="Group Documents"
                            items={g.documents.map((f) => ({ url: getFileUrl(f.url), label: f.originalname }))}
                            type="doc"
                          />
                        ) : null}

                        {g.links?.length ? (
                          <ResourceCard
                            icon={<LinkIcon className="w-5 h-5 text-green-600" />}
                            title="Group Links"
                            items={(g.links || []).map((l) => ({ url: l, label: l }))}
                          />
                        ) : null}

                        {g.youtubeLinks?.length ? (
                          <ResourceCard
                            icon={<Youtube className="w-5 h-5 text-red-600" />}
                            title="Group YouTube"
                            items={(g.youtubeLinks || []).map((l, i) => ({ url: l, label: `Video ${i + 1}` }))}
                            type="youtube"
                          />
                        ) : null}
                      </div>
                    )}

                    {/* Discussion composer (kept minimal, you can wire your UI here) */}
                    <div className="mt-4">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border rounded-lg px-3 py-2"
                          placeholder="Post a message to discussion…"
                          value={newMsg[g._id] || ""}
                          onChange={(e) => setNewMsg((n) => ({ ...n, [g._id]: e.target.value }))}
                        />
                        <button
                          onClick={() => handlePost(idx, g)}
                          disabled={posting[g._id]}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {posting[g._id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>

                      {g.discussion?.length ? (
                        <div className="mt-3 space-y-2">
                          {g.discussion.map((d, i) => (
                            <div key={i} className="p-3 rounded-lg border">
                              <div className="text-sm text-gray-600">
                                {(d.user?.username || d.user?.email) ?? "User"} •{" "}
                                {new Date(d.createdAt).toLocaleString()}
                              </div>
                              <div className="mt-1">{d.message}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {assignment.createdAt && (
          <div className="text-center text-gray-400 text-sm mt-12 py-4">
            Assignment created on {new Date(assignment.createdAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Resource Card
========================= */
type ResourceCardProps = {
  icon: React.ReactNode;
  title: string;
  items: { url: string; label: string }[];
  type?: "doc" | "youtube" | "media";
  onImageClick?: (info: { src: string; alt?: string }) => void;
};
function ResourceCard({ icon, title, items, type, onImageClick }: ResourceCardProps) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.map((it, i) => {
          // Image preview
          if (type === "media" && isImage(it.label)) {
            return (
              <div key={i} className="inline-block mr-3 mb-2">
                <img
                  src={getFileUrl(it.url)}
                  alt={it.label}
                  className="w-24 h-24 object-cover rounded-lg border cursor-pointer hover:shadow-lg"
                  onClick={() => onImageClick?.({ src: getFileUrl(it.url), alt: it.label })}
                  title="Click to preview"
                />
                <div className="truncate text-xs mt-1 text-center">{it.label}</div>
              </div>
            );
          }
          // Office doc preview
          if (type === "doc" && isOfficeDoc(it.label)) {
            return (
              <div key={i} className="space-y-1">
                <a
                  href={getFileUrl(it.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-700 hover:text-blue-900"
                >
                  <Eye className="w-4 h-4" />
                  <span className="truncate">{it.label}</span>
                </a>
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(getFileUrl(it.url))}`}
                  className="w-full h-56 rounded-xl border mt-1"
                  title={it.label}
                  loading="lazy"
                />
              </div>
            );
          }
          // YouTube preview
          if (type === "youtube") {
            const ytId = getYouTubeId(it.url);
            if (ytId) {
              return (
                <div key={i}>
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-red-700 hover:text-red-900"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="truncate">{it.label}</span>
                  </a>
                  <iframe
                    width="100%"
                    height="180"
                    src={`https://www.youtube.com/embed/${ytId}`}
                    title="YouTube video preview"
                    className="rounded-xl border mt-1"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            }
            return (
              <div key={i} className="text-xs text-red-500">
                Invalid or private YouTube link: {it.url}
              </div>
            );
          }
          // Default (link or non-image file)
          return (
            <a
              key={i}
              href={getFileUrl(it.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
            >
              <Eye className="w-4 h-4" />
              <span className="truncate">{it.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
