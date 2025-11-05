"use client";
import React, { useEffect, useState } from "react";
import {
    Loader2, AlertCircle, User, FileText, ExternalLink as LinkIcon, Image as ImageIcon, Youtube,
    Users, MessageCircle, Send, Calendar, BookOpen, Clock, Award, MessageSquare, Eye, ChevronDown, ChevronUp, X
} from "lucide-react";
import { useParams } from "next/navigation";
import { useUser } from "@/app/student/dashboard/studentContext";
import GroupSubmissionPanel from "./submission";
import PlagiarismModal from "./plagResult";

// ---------- Types ----------
type UserObj = { _id?: string; id?: string; username?: string; email?: string };
type FileObj = { url: string; originalname: string };
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
    submissions?: Submission[]; // <-- group submissions here!
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
    // add these fields to Assignment
acceptingSubmissions?: boolean;   // NEW
closeAt?: string | null;          // NEW

    points?: number;
    createdAt?: string;
};


// ----------- Helper functions -----------
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export function getFileUrl(url: string) {
  if (!url) return "";

  // If it's already a full URL, just return it
  if (url.startsWith("http")) return url;

  // Normalize slashes so we don't get // or miss /
  const base = BACKEND_URL.endsWith("/") ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  const path = url.startsWith("/") ? url : `/${url}`;

  return `${base}${path}`;
}

const isOfficeDoc = (filename: string) => /\.(docx?|pptx?|xlsx?)$/i.test(filename);
const getYouTubeId = (url: string) => {
    const m = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return m ? m[1] : null;
};
const isImage = (filename: string) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(filename);

// ----------- Image Modal -----------
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

// ----------- Main Component -----------
export default function GroupAssignmentDetail() {
    const params = useParams();
    const groupAssignmentId = params?.groupId as string;
    const { user } = useUser() || {};
    const myUserId = user?.id || user?._id || "";
    const [submitting, setSubmitting] = useState(false);

    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [newMsg, setNewMsg] = useState<Record<string, string>>({});
    const [posting, setPosting] = useState<Record<string, boolean>>({});
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [imgModal, setImgModal] = useState<{ src: string, alt?: string } | null>(null);
    const [groupUndoState, setGroupUndoState] = useState<Record<string, { loading: boolean; error: string | null }>>({});
    const setLoadingUndo = (groupId: string, loading: boolean) =>
        setGroupUndoState((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), loading } }));
    const setUndoError = (groupId: string, error: string | null) =>
        setGroupUndoState((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), error } }));
    const [plagResults, setPlagResults] = useState<Record<string, any>>({});
    const [activeGroupForModal, setActiveGroupForModal] = useState<string | null>(null);
const [groupSubmissions, setGroupSubmissions] = useState<Record<string, Submission | null>>({});

    function onGroupPlagCheck(groupId: string, result: any) {
        setPlagResults(r => ({ ...r, [groupId]: result }));
        setActiveGroupForModal(groupId);
    }
    
    // --- Fetch assignment from real API ---
    const fetchAssignment = () => {
        if (!groupAssignmentId) return;
        setLoading(true);
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/group-assignment/${groupAssignmentId}`, {
            headers: {
                Authorization: "Bearer " + (localStorage.getItem("token_student") || sessionStorage.getItem("token_student") || ""),
            },
        })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Failed to fetch");
                setAssignment(data.assignment);
                // Expand user's group(s)
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
                  (localStorage.getItem("token_student") ||
                    sessionStorage.getItem("token_student") ||
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
}, [assignment, myUserId]);
// ADD
const now = new Date();
const accepting = assignment?.acceptingSubmissions !== false;
const closeAt = assignment?.closeAt ? new Date(assignment.closeAt) : null;
const isPastClose = closeAt ? now > closeAt : false;
const canSubmit = accepting && !isPastClose;


const myGroups = assignment?.groups?.filter(
  (g) => myUserId && g.members.some((m) => (m._id || m.id) === myUserId)
) || [];

    // --- Post to discussion ---
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
                        Authorization: "Bearer " + (localStorage.getItem("token_student") || sessionStorage.getItem("token_student") || ""),
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

    const toggleGroup = (groupId: string) => setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

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
    // const myGroups = assignment.groups?.filter(
    //     (g) => myUserId && g.members.some((m) => (m._id || m.id) === myUserId)
    // ) || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {imgModal?.src && (
                <ImageModal src={imgModal.src} alt={imgModal.alt} onClose={() => setImgModal(null)} />
            )}
            <div className="max-w-6xl mx-auto py-8 px-4">
                {/* Header */}
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 mb-8 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                                    <BookOpen className="w-8 h-8" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold">{assignment.title || "Untitled Group Assignment"}</h1>
                                    <div className="flex items-center gap-4 text-white/80 mt-2">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4" />
                                            <span>{assignment.postedBy?.username || assignment.postedBy?.email || "Unknown Teacher"}</span>
                                        </div>
                                        <span>•</span>
                                        <span>{assignment.courseInstance?.course} ({assignment.courseInstance?.batch})</span>
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
                                                <div className={`text-sm font-medium mt-1 ${daysUntilDue < 3 ? 'text-red-200' : daysUntilDue < 7 ? 'text-yellow-200' : 'text-green-200'}`}>
                                                    {daysUntilDue > 0 ? `${daysUntilDue} days remaining` : daysUntilDue === 0 ? 'Due today!' : 'Overdue'}
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
                                className="prose prose-lg max-w-none mb-6 text-gray-700 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: assignment.content }}
                            />
                        )}
                        {/* Global Resources */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            {assignment.media?.length
                                ? <ResourceCard icon={<ImageIcon className="w-5 h-5 text-purple-600" />} title="Media Files"
                                    items={assignment.media.map((f) => ({ url: getFileUrl(f.url), label: f.originalname }))}
                                    type="media"
                                    onImageClick={setImgModal}
                                />
                                : null}
                            {assignment.documents?.length
                                ? <ResourceCard icon={<FileText className="w-5 h-5 text-blue-600" />} title="Documents"
                                    items={assignment.documents.map((f) => ({ url: getFileUrl(f.url), label: f.originalname }))}
                                    type="doc"
                                />
                                : null}
                            {assignment.links?.length
                                ? <ResourceCard icon={<LinkIcon className="w-5 h-5 text-green-600" />} title="Links"
                                    items={assignment.links.map((l) => ({ url: l, label: l }))}
                                />
                                : null}
                            {assignment.youtubeLinks?.length
                                ? <ResourceCard icon={<Youtube className="w-5 h-5 text-red-600" />} title="YouTube Links"
                                    items={assignment.youtubeLinks.map((l, i) => ({ url: l, label: `Video ${i + 1}` }))}
                                    type="youtube"
                                />
                                : null}
                        </div>
                    </div>
                </div>

                {/* Groups Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full p-3">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Your Project Group(s)</h2>
                    </div>
                    {myGroups.length === 0 ? (
                        <div className="text-gray-500 bg-white border border-dashed rounded-xl px-8 py-8 text-center">
                            You are not a member of any group for this assignment.
                        </div>
                    ) : null}
                    {myGroups.map((group, i) => {
                        const isExpanded = expandedGroups[group._id];
                        const isUserInGroup = group.members.some((m) => (m._id || m.id) === myUserId);
                        return (
                            <div key={group._id || i} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                <div className={`p-6 ${isUserInGroup ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white' : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                                                <Users className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold">{group.name}</h3>
                                                <p className="text-white/80">{group.task}</p>
                                                {group.title && (
                                                    <p className="text-sm text-white/70 mt-1">{group.title}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {group.points && (
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold">{group.points}</div>
                                                    <div className="text-sm text-white/80">points</div>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => toggleGroup(group._id)}
                                                className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
                                            >
                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="p-6">
                                        {group.content && (
                                            <div
                                                className="prose prose-sm max-w-none mb-6 text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: group.content }}
                                            />
                                        )}
                                        {/* Members */}
                                        <div className="mb-6">
                                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                Team Members ({group.members.length})
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {group.members.map((member, idx) => (
                                                    <div key={member._id || member.id || idx} className={`px-3 py-2 rounded-full text-sm font-medium ${(member._id || member.id) === myUserId
                                                        ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
                                                        : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {member.username || member.email || member._id || member.id}
                                                        {(member._id || member.id) === myUserId && <span className="ml-1">(You)</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Group Resources */}
                                        {/* Group Resources */}
                                        {(group.media?.length || 0) > 0 ||
                                            (group.documents?.length || 0) > 0 ||
                                            (group.youtubeLinks?.length || 0) > 0 ||
                                            (group.links?.length || 0) > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                {group.media?.length
                                                    ? <ResourceCard
                                                        icon={<ImageIcon className="w-4 h-4" />}
                                                        title="Group Media"
                                                        items={group.media.map(f => ({ url: getFileUrl(f.url), label: f.originalname }))}
                                                        type="media"
                                                        onImageClick={setImgModal}
                                                    />
                                                    : null}
                                                {group.documents?.length
                                                    ? <ResourceCard
                                                        icon={<FileText className="w-4 h-4" />}
                                                        title="Group Documents"
                                                        items={group.documents.map(f => ({ url: getFileUrl(f.url), label: f.originalname }))}
                                                        type="doc"
                                                    />
                                                    : null}
                                                {group.youtubeLinks?.length
                                                    ? <ResourceCard
                                                        icon={<Youtube className="w-4 h-4 text-red-600" />}
                                                        title="Group YouTube Links"
                                                        items={group.youtubeLinks.map((l, i) => ({ url: l, label: `Video ${i + 1}` }))}
                                                        type="youtube"
                                                    />
                                                    : null}
                                                {group.links?.length
                                                    ? <ResourceCard
                                                        icon={<LinkIcon className="w-4 h-4 text-green-600" />}
                                                        title="Group Links"
                                                        items={group.links.map((l) => ({ url: l, label: l }))}
                                                    />
                                                    : null}
                                            </div>
                                        ) : null}
                              {isUserInGroup && (
  <div className="mb-8">
    <GroupSubmissionPanel
      submission={groupSubmissions[group._id] || null}  // <<--- USE THIS!
      groupAssignmentId={assignment._id}
      groupId={group._id}
      loadingUndo={!!groupUndoState[group._id]?.loading}
      setLoadingUndo={(loading) => setLoadingUndo(group._id, loading)}
      error={groupUndoState[group._id]?.error || null}
      setError={(error) => setUndoError(group._id, error)}
      submitting={submitting}
      setSubmitting={setSubmitting}
      refreshSubmission={fetchAssignment}
      getFileUrl={getFileUrl}
      getFileIcon={(name) => <FileText className="w-5 h-5" />}
      isImage={isImage}
      isOfficeDoc={isOfficeDoc}
      isPDF={(name) => /\.pdf$/i.test(name)}
      setMediaPreview={setImgModal}
      onPlagiarismCheck={result => onGroupPlagCheck(group._id, result)}
       canSubmit={canSubmit}          // ← ADD THIS
    />
  </div>
)}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Discussion Section */}
                                            <div className="bg-gray-50 rounded-xl p-4">
                                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                                    <MessageCircle className="w-4 h-4" />
                                                    Discussion ({(group.discussion ?? []).length} messages)
                                                </h4>
                                                <div className="bg-white border rounded-lg p-3 max-h-60 overflow-y-auto space-y-3 mb-3">
                                                    {(group.discussion ?? []).length === 0 && (
                                                        <div className="text-gray-400 text-sm text-center py-4">No messages yet. Start the conversation!</div>
                                                    )}
                                                    {(group.discussion ?? []).map((d, k) => (
                                                        <div key={k} className="flex gap-3">
                                                            <div className="bg-indigo-100 rounded-full p-2 flex-shrink-0">
                                                                <User className="w-3 h-3 text-indigo-600" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-semibold text-indigo-700 text-sm">
                                                                        {d.user?.username || d.user?.email || d.user?._id || d.user?.id || "Unknown"}
                                                                    </span>
                                                                    <span className="text-gray-400 text-xs">
                                                                        {new Date(d.createdAt).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <p className="text-gray-700 text-sm leading-relaxed">{d.message}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {isUserInGroup && (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newMsg[group._id] || ""}
                                                            onChange={e => setNewMsg(n => ({ ...n, [group._id]: e.target.value }))}
                                                            placeholder="Write a message..."
                                                            className="flex-1 border border-gray-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                                            onKeyPress={e => e.key === 'Enter' && handlePost(i, group)}
                                                        />
                                                        <button
                                                            onClick={() => handlePost(i, group)}
                                                            disabled={posting[group._id] || !newMsg[group._id]?.trim()}
                                                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                                        >
                                                            {posting[group._id] ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Send className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Participation Section */}
                                            <div className="bg-gray-50 rounded-xl p-4">
                                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                                    <Clock className="w-4 h-4" />
                                                    Participation Metrics
                                                </h4>
                                                <div className="space-y-3">
                                                    {(group.participation ?? []).map((p, idx) => (
                                                        <div key={p.user?._id || p.user?.id || idx} className="bg-white rounded-lg p-3 border">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-semibold text-gray-800">
                                                                    {p.user?.username || p.user?.email || p.user?._id || p.user?.id}
                                                                </span>
                                                                {p.contribution && (
                                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                                                        {p.contribution}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <MessageSquare className="w-3 h-3 text-gray-500" />
                                                                    <span className="text-gray-600">Messages: {p.messageCount || 0}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Clock className="w-3 h-3 text-gray-500" />
                                                                    <span className="text-gray-600">Time: {p.discussionMinutes || 0}m</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {activeGroupForModal && (
                        <PlagiarismModal
                            result={plagResults[activeGroupForModal]!}
                            onClose={() => setActiveGroupForModal(null)}
                        />
                    )}
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

// ----------- Resource Card (TypeScript, with image click) -----------
type ResourceCardProps = {
    icon: React.ReactNode;
    title: string;
    items: { url: string; label: string }[];
    type?: "doc" | "youtube" | "media";
    onImageClick?: (info: { src: string, alt?: string }) => void;
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
                    // IMAGE PREVIEW
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
                    // DOC PREVIEW
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
                                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                                        getFileUrl(it.url)
                                    )}`}
                                    className="w-full h-56 rounded-xl border mt-1"
                                    title={it.label}
                                    loading="lazy"
                                ></iframe>
                            </div>
                        );
                    }
                    // YOUTUBE PREVIEW
                    if (type === "youtube") {
                        const ytId = getYouTubeId(it.url);
                        // Debug print
                        // console.log('YT:', it.url, ytId);
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
                                    ></iframe>
                                </div>
                            );
                        } else {
                            // Invalid URL fallback
                            return (
                                <div key={i} className="text-xs text-red-500">
                                    Invalid or private YouTube link: {it.url}
                                </div>
                            );
                        }
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

