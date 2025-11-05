"use client";

import React, { useState, useEffect } from "react";

import {
    X, Users, Calendar, Award, FileText, ImageIcon, Youtube,
    Link as LinkIcon, Upload, Plus, Trash2, Settings, Clock,
    UserPlus, Eye, Play, ExternalLink, BookOpen, Save,
    AlertCircle, Check, ChevronDown, ChevronUp, Globe
} from "lucide-react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import TiptapEditor from "./groupAssignment_rtecomponent";

interface User { _id: string; username: string; }
interface Topic { _id: string; title: string; }
interface ExistingFile { url: string; originalname: string; }

interface Group {
    id: string;
    members: string[];
    task: string;
    name?: string;
    title?: string;
    content?: string;
    topic?: string;
    points: number;
    dueDate: string;
    mediaFiles: File[];         // new files
    docFiles: File[];           // new files
    ytLinks: string[];
    links: string[];
    existingMedia?: ExistingFile[];   // fetched from backend
    existingDocs?: ExistingFile[];    // fetched from backend
    existingYtLinks?: string[];       // fetched from backend (if split needed)
    existingLinks?: string[];         // fetched from backend (if split needed)
}

interface Props {
    groupAssignmentId: string;
    courseInstanceId: string;
    courseName: string;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}
function getFilePreviewUrl(file: any) {
    if (file instanceof File) {
        return URL.createObjectURL(file);
    }
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";
    return file.url.startsWith("http")
        ? file.url
        : `${backend}${file.url.startsWith("/") ? "" : "/"}${file.url}`;
}
export default function EditGroupAssignmentForm({
    open,
    groupAssignmentId,
    courseInstanceId,
    courseName,
    onClose,
    onSuccess
}: Props) {
    // Global fields
    const [globalTitle, setGlobalTitle] = useState("");
    const [globalContent, setGlobalContent] = useState("");
    const [globalPoints, setGlobalPoints] = useState(100);
    const [globalDueDate, setGlobalDueDate] = useState("");
    const [globalMedia, setGlobalMedia] = useState<File[]>([]);
    const [globalDocs, setGlobalDocs] = useState<File[]>([]);
    const [existingGlobalMedia, setExistingGlobalMedia] = useState<ExistingFile[]>([]);
    const [existingGlobalDocs, setExistingGlobalDocs] = useState<ExistingFile[]>([]);
    const [globalYt, setGlobalYt] = useState<string[]>([]);
    const [existingGlobalYt, setExistingGlobalYt] = useState<string[]>([]);
    const [globalLinks, setGlobalLinks] = useState<string[]>([]);
    const [existingGlobalLinks, setExistingGlobalLinks] = useState<string[]>([]);
    const [globalTopic, setGlobalTopic] = useState<string>("");

    const [students, setStudents] = useState<User[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [useGlobal, setUseGlobal] = useState<Record<string, boolean>>({});
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Preview states
    const [mediaPreview, setMediaPreview] = useState<File | null>(null);
    const [videoPreview, setVideoPreview] = useState<string>("");
    const [docPreviewFile, setDocPreviewFile] = useState<File | null>(null);
    const [docPreviewMode, setDocPreviewMode] = useState<"pdf" | "download" | null>(null);
    const [deleteIndex, setDeleteIndex] = useState<number | null>(null);


    useEffect(() => {
        const token = localStorage.getItem("token_teacher")
            || sessionStorage.getItem("token_teacher")
            || "";
        async function fetchAssignment() {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/group-assignment/${groupAssignmentId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!data.success) return toast.error(data.message || "Failed to fetch assignment.");

            const a = data.assignment;
            setGlobalTitle(a.title || "");
            setGlobalContent(a.content || "");
            setGlobalPoints(a.points ?? 100);
            setGlobalDueDate(a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 16) : "");
            setGlobalTopic(a.topic?._id || "");

            // Existing files
            setExistingGlobalMedia(a.media || []);
            setExistingGlobalDocs(a.documents || []);
            setExistingGlobalYt(a.youtubeLinks || []);
            setExistingGlobalLinks(a.links || []);

            // Groups
            setGroups((a.groups || []).map((g: any, i: number) => ({
                id: g._id || `grp-${i}`,
                members: (g.members || []).map((u: any) => (typeof u === "string" ? u : u._id)),
                task: g.task || "",
                name: g.name || "",
                points: g.points ?? 100,
                dueDate: g.dueDate ? new Date(g.dueDate).toISOString().slice(0, 16) : "",
                title: g.title ?? "",
                content: g.content ?? "",
                topic: g.topic?._id ?? "",
                mediaFiles: [],
                docFiles: [],
                ytLinks: [],
                links: [],
                existingMedia: g.media || [],
                existingDocs: g.documents || [],
                existingYtLinks: g.youtubeLinks || [],
                existingLinks: g.links || [],
            })));
        }

        fetchAssignment();
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${courseInstanceId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(d => setStudents(d.instance?.students || []))
            .catch(console.error);

        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/topic-api/course/${courseInstanceId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(d => setTopics(d.topics || []))
            .catch(() => setTopics([]));
    }, [courseInstanceId]);
    // Helper functions
    const generateId = () => Math.random().toString(36).substr(2, 9);
    const addGroup = () => {
        const newId = generateId();
        setGroups(gs => [
            ...gs,
            {
                id: newId,
                members: [],
                task: "",
                name: "",
                points: 100,
                dueDate: "",
                mediaFiles: [],
                docFiles: [],
                ytLinks: [],
                links: []
            }
        ]);
        setExpandedGroups(prev => new Set(prev).add(newId));
    };

    const updateGroup = (idx: number, field: keyof Group, val: any) => {
        setGroups(gs => {
            const copy = [...gs];
            (copy[idx] as any)[field] = val;
            return copy;
        });
    };

    const removeGroup = (idx: number) => {
        setGroups(gs => gs.filter((_, i) => i !== idx));
    };
    function removeExistingGlobalMedia(idx: number) {
        setExistingGlobalMedia(prev => prev.filter((_, i) => i !== idx));
    }
    function removeExistingGlobalDocs(idx: number) {
        setExistingGlobalDocs(prev => prev.filter((_, i) => i !== idx));
    }
    const toggleGroupExpansion = (id: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const appendFiles = (existing: File[], incoming: FileList | null) =>
        incoming ? [...existing, ...Array.from(incoming)] : existing;

    const getYouTubeVideoId = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
        ];
        for (const pattern of patterns) {
            const m = url.match(pattern);
            if (m) return m[1];
        }
        return null;
    };

    // Optional—if you want to accept arbitrary URLs
    const normalizeUrl = (raw: string) => {
        try { return new URL(raw).href; }
        catch { return raw; }
    };

    // 2) addYouTubeLink now always produces a full embed URL:
    function addYouTubeLink(
        raw: string,
        isGlobal: boolean,
        groupIdx?: number
    ) {
        const trimmed = raw.trim();
        if (!trimmed) return;

        const id = getYouTubeVideoId(trimmed);
        const embedUrl = id
            ? `https://www.youtube.com/embed/${id}`
            : normalizeUrl(trimmed);

        if (isGlobal) {
            setGlobalYt(prev => [...prev, embedUrl]);
        } else if (groupIdx !== undefined) {
            updateGroup(groupIdx, "ytLinks", [
                ...groups[groupIdx].ytLinks,
                embedUrl
            ]);
        }
    }

    const addExternalLink = (url: string, isGlobal: boolean, groupIdx?: number) => {
        if (!url.trim()) return;
        if (isGlobal) {
            setGlobalLinks(prev => [...prev, url.trim()]);
        } else if (groupIdx !== undefined) {
            updateGroup(groupIdx, "links", [...groups[groupIdx].links, url.trim()]);
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        const token =
            localStorage.getItem('token_teacher') ||
            sessionStorage.getItem('token_teacher') ||
            '';

        // 1) Build groupsPayload
        const groupsPayload = groups.map(g => {
            const isGlobal = !!useGlobal[g.id];
            const youtubeLinks = isGlobal
                ? [...globalYt, ...g.ytLinks]
                : g.ytLinks;
            const links = isGlobal
                ? [...globalLinks, ...g.links]
                : g.links;

            return {
                members: g.members,
                task: g.task,
                name: g.name,
                points: isGlobal ? globalPoints : g.points,
                dueDate: isGlobal ? globalDueDate : g.dueDate,
                youtubeLinks,
                links,
                media: isGlobal ? globalMedia.map(f => ({ url: "", originalname: f.name })) : g.mediaFiles.map(f => ({ url: "", originalname: f.name })),
                documents: isGlobal ? globalDocs.map(f => ({ url: "", originalname: f.name })) : g.docFiles.map(f => ({ url: "", originalname: f.name })),
                title: isGlobal ? globalTitle : g.title,
                content: isGlobal ? globalContent : g.content,
                topic: isGlobal ? globalTopic : g.topic,
            };
        });

        // 2) Build FormData payload
        const form = new FormData();
        form.append("courseInstance", courseInstanceId);
        if (globalTitle.trim()) form.append("title", globalTitle);
        if (globalContent.trim()) form.append("content", globalContent);
        if (globalTopic) form.append("topic", globalTopic);
        if (globalPoints != null) form.append("points", String(globalPoints));
        if (globalDueDate) form.append("dueDate", globalDueDate);

        // media/docs: only append if non‑empty
        globalMedia.forEach(f => form.append("media", f));
        globalDocs.forEach(f => form.append("documents", f));

        // per-group files (media-0, documents-0, etc)
        groups.forEach((g, i) => {
            g.mediaFiles?.forEach(f => form.append(`media-${i}`, f));
            g.docFiles?.forEach(f => form.append(`documents-${i}`, f));
        });

        // Links & youtube arrays
        if (globalYt.length) form.append("youtubeLinks", JSON.stringify(globalYt));
        if (globalLinks.length) form.append("links", JSON.stringify(globalLinks));

        // always append the JSON payload for groups
        form.append("groups", JSON.stringify(groupsPayload));

        let json: any;
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/group-assignment/${groupAssignmentId}`, // PATCH URL!
                {
                    method: 'PATCH', // Use PATCH for update!
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: form,
                }
            );

            json = await res.json();
            setIsSubmitting(false);

            if (res.ok) {
                toast.success('Assignment updated!');
                onSuccess();
                return;
            }
        } catch (err) {
            setIsSubmitting(false);
            toast.error('Network error. Please try again.');
            return;
        }

        // If we reach here, res.ok was false and `json` contains the error payload
        if (Array.isArray(json.errors)) {
            json.errors.forEach((error: { msg: string; path?: string }) => {
                const label = error.path ? `${error.path}: ` : '';
                toast.error(label + error.msg);
            });
        } else if (typeof json.error === 'string') {
            toast.error(json.error);
        } else {
            toast.error('Something went wrong. Please check your inputs.');
        }
    }

    //yt 

    // do we have a valid global title?
    const hasGlobalTitle = globalTitle.trim().length > 0;

    // do _all_ groups that are *not* using global have their own title?
    const allGroupsHaveTitles = groups.every(g => {
        const useG = useGlobal[g.id];
        return useG || (typeof g.title === "string" && g.title.trim().length > 0);
    });

    const canSubmit =
        groups.length > 0       // at least one group
        && (hasGlobalTitle || allGroupsHaveTitles);

    const renderMediaThumb = (file: File, idx: number, onRemove: () => void) => {
        const url = URL.createObjectURL(file);
        if (file.type.startsWith("image/")) {
            return (
                <div key={idx} className="relative group">
                    <img
                        src={url}
                        className="w-16 h-16 object-cover rounded-lg cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-colors"
                        onClick={() => setMediaPreview(file)}
                        alt={file.name}
                    />
                    <button
                        onClick={onRemove}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        ×
                    </button>
                </div>
            );
        } else {
            return (
                <div key={idx} className="relative group">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-colors flex items-center justify-center">
                        <Play className="w-6 h-6 text-gray-600" />
                    </div>
                    <button
                        onClick={onRemove}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        ×
                    </button>
                </div>
            );
        }
    };
    function renderDocThumb(file: File, idx: number, onRemove: () => void) {
        const url = URL.createObjectURL(file);
        // Derive the extension (pdf, docx, pptx, etc.)
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        // Map to a human‑friendly label
        const label = ext === 'pdf'
            ? 'PDF'
            : ext === 'doc' || ext === 'docx'
                ? 'DOC'
                : ext === 'ppt' || ext === 'pptx'
                    ? 'PPT'
                    : ext.toUpperCase();

        return (
            <div key={idx} className="relative group">
                <div
                    className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200
                   flex flex-col items-center justify-center cursor-pointer
                   hover:border-blue-400 transition-colors"
                    onClick={() => {
                        const isPDF = ext === 'pdf';
                        setDocPreviewFile(file);
                        setDocPreviewMode(isPDF ? 'pdf' : 'download');
                    }}
                >
                    {/* keep your icon */}
                    <FileText className="w-6 h-6 text-gray-600 mb-1" />
                    {/* render a tiny extension badge */}
                    <span className="text-[10px] font-medium text-gray-700">{label}</span>
                </div>
                <button
                    onClick={onRemove}
                    className="absolute -top-2 -right-2 bg-red-500 text-white
                   rounded-full w-5 h-5 flex items-center justify-center text-xs
                   opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    ×
                </button>
            </div>
        );
    }

    if (!open) return null;

    return (
        <>
            {/* Media Preview Modal */}
      {/* Image Modal */}
{mediaPreview && (
  <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60">
    <div className="bg-white p-6 rounded-xl relative">
      <button
        className="absolute top-3 right-3 bg-gray-200 rounded-full p-2"
        onClick={() => setMediaPreview(null)}
      >
        <X size={20} />
      </button>
      <img
        src={getFilePreviewUrl(mediaPreview)}
        className="max-w-[80vw] max-h-[80vh] object-contain"
alt={(mediaPreview as any).originalname || mediaPreview.name}
      />
      <div className="mt-2 text-sm text-center">{(mediaPreview as any).originalname || mediaPreview.name}
</div>
    </div>
  </div>
)}

{/* Document Modal */}
{docPreviewFile && (
  <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60">
    <div className="bg-white p-6 rounded-xl relative max-w-3xl w-full">
      <button
        className="absolute top-3 right-3 bg-gray-200 rounded-full p-2"
        onClick={() => { setDocPreviewFile(null); setDocPreviewMode(null); }}
      >
        <X size={20} />
      </button>
      {docPreviewMode === "pdf" ? (
        <iframe
          src={getFilePreviewUrl(docPreviewFile)}
          className="w-full h-[70vh]"
          frameBorder="0"
        />
      ) : (
        <div className="p-6 text-center">
          <p className="mb-4">Cannot preview this file in‑browser.</p>
          <a
            href={getFilePreviewUrl(docPreviewFile)}
download={(docPreviewFile as any).originalname || docPreviewFile.name}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
download={(docPreviewFile as any).originalname || docPreviewFile.name}
          </a>
        </div>
      )}
    </div>
  </div>
)}

            {/* Video Preview Modal */}
            {videoPreview && (
                <div className="fixed inset-0 z-70 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl relative">
                        <div className="absolute top-4 right-4 z-10">
                            <button
                                className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                                onClick={() => setVideoPreview("")}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="aspect-video">
                            <iframe
                                width="100%"
                                height="100%"
                                src={videoPreview.replace("watch?v=", "embed/")}
                                frameBorder="0"
                                allowFullScreen
                                className="rounded-xl"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Main Modal */}
            <div className="fixed inset-0 z-60 bg-white/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    Edit Group Assignment
                                </h2>
                                <p className="text-blue-100 mt-2">Course: {courseName}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto">
                        <form onSubmit={handleSubmit} className="p-6 space-y-8">
                            {/* Global Settings */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Globe className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-900">Global Assignment Settings</h3>
                                        <p className="text-sm text-gray-600">These settings can be applied to all groups</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Group Assignment Title</label>
                                            <input
                                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                value={globalTitle}
                                                onChange={e => setGlobalTitle(e.target.value)}
                                                placeholder="Enter assignment title..."
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                                            <select
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                                value={globalTopic}
                                                onChange={e => setGlobalTopic(e.target.value)}
                                            >
                                                <option value="">— select topic —</option>
                                                {topics.map(t => (
                                                    <option key={t._id} value={t._id}>{t.title}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    <Award className="w-4 h-4 inline mr-1" />
                                                    Points
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    value={globalPoints}
                                                    onChange={e => setGlobalPoints(+e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    <Calendar className="w-4 h-4 inline mr-1" />
                                                    Due Date
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    value={globalDueDate}
                                                    onChange={e => setGlobalDueDate(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                                        <TiptapEditor
                                            content={globalContent}
                                            onChange={setGlobalContent}
                                            placeholder="Enter assignment instructions…"
                                            className="min-h-[150px]"
                                        />
                                    </div>
                                </div>

                                {/* Global Resources */}
                                <div className="mt-6 pt-6 border-t border-blue-200">
                                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                        <Settings className="w-5 h-5" />
                                        Global Resources
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {/* Media Upload */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                <ImageIcon className="w-4 h-4" />
                                                Media Files
                                            </label>
                                            <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors bg-white/50">
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*,video/*"
                                                    onChange={e => setGlobalMedia(appendFiles(globalMedia, e.target.files))}
                                                    className="hidden"
                                                    id="global-media"
                                                />
                                                <label htmlFor="global-media" className="cursor-pointer">
                                                    <Upload className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                                                    <span className="text-sm text-gray-600">Click to upload</span>
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {/* GLOBAL MEDIA THUMBNAILS */}
                                                <div className="grid grid-cols-3 gap-2 mt-2">
                                                    {existingGlobalMedia.map((file, idx) => (
                                                        <div key={file.url} className="relative group">
                                                            <img
                                                                src={getFilePreviewUrl(file)}
                                                                className="w-16 h-16 object-cover rounded-lg cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-colors"
                                                                alt={file.originalname}
                                                                onClick={() => setMediaPreview(file as any)}
                                                            />
                                                            <button
                                                                onClick={() => removeExistingGlobalMedia(idx)}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {globalMedia.map((file, idx) => (
                                                        <div key={idx} className="relative group">
                                                            <img
                                                                src={getFilePreviewUrl(file)}
                                                                className="w-16 h-16 object-cover rounded-lg cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-colors"
                                                                alt={file.name}
                                                                onClick={() => setMediaPreview(file)}
                                                            />
                                                            <button
                                                                onClick={() => setGlobalMedia(prev => prev.filter((_, i) => i !== idx))}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Existing Media Files (Global) */}
                                                <div className="grid grid-cols-3 gap-2 mt-2">
                                                    {existingGlobalMedia.map((file, idx) => {
                                                        // This block (curly braces) is a function body
                                                        const backend = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";
                                                        const fileUrl = file.url.startsWith("http")
                                                            ? file.url
                                                            : `${backend}${file.url.startsWith("/") ? "" : "/"}${file.url}`;
                                                        return (
                                                            <div key={file.url} className="relative group">
                                                                <img
                                                                    src={fileUrl}
                                                                    className="w-16 h-16 object-cover rounded-lg cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-colors"
                                                                    alt={file.originalname}
                                                                    onClick={() => setMediaPreview(file as any)}
                                                                />
                                                                <button
                                                                    onClick={() => removeExistingGlobalMedia(idx)}
                                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>


                                            </div>
                                        </div>

                                        {/* Documents */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                <FileText className="w-4 h-4" />
                                                Documents
                                            </label>
                                            <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors bg-white/50">
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                                                    onChange={e => setGlobalDocs(appendFiles(globalDocs, e.target.files))}
                                                    className="hidden"
                                                    id="global-docs"
                                                />
                                                <label htmlFor="global-docs" className="cursor-pointer">
                                                    <Upload className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                                                    <span className="text-sm text-gray-600">Click to upload</span>
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {globalDocs.map((file, idx) => renderDocThumb(file, idx, () => {
                                                    setGlobalDocs(prev => prev.filter((_, i) => i !== idx));
                                                }))}
                                            </div>
                                            {/* Existing Documents (Global) */}
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                                <div className="grid grid-cols-3 gap-2 mt-2">
                                                    {existingGlobalDocs.map((file, idx) => (
                                                        <div key={file.url} className="relative group">
                                                            <div
                                                                className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors"
                                                                onClick={() => {
                                                                    const ext = file.originalname.split('.').pop()?.toLowerCase();
                                                                    setDocPreviewFile(file as any);
                                                                    setDocPreviewMode(ext === 'pdf' ? 'pdf' : 'download');
                                                                }}
                                                            >
                                                                <FileText className="w-6 h-6 text-gray-600 mb-1" />
                                                                <span className="text-[10px] font-medium text-gray-700">
                                                                    {file.originalname.split('.').pop()?.toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => removeExistingGlobalDocs(idx)}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {globalDocs.map((file, idx) => (
                                                        <div key={idx} className="relative group">
                                                            <div
                                                                className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors"
                                                                onClick={() => {
                                                                    const ext = file.name.split('.').pop()?.toLowerCase();
                                                                    setDocPreviewFile(file);
                                                                    setDocPreviewMode(ext === 'pdf' ? 'pdf' : 'download');
                                                                }}
                                                            >
                                                                <FileText className="w-6 h-6 text-gray-600 mb-1" />
                                                                <span className="text-[10px] font-medium text-gray-700">
                                                                    {file.name.split('.').pop()?.toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => setGlobalDocs(prev => prev.filter((_, i) => i !== idx))}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                            </div>


                                        </div>

                                        {/* YouTube Links */}

                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                <Youtube className="w-4 h-4" />
                                                YouTube Videos
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Paste YouTube URL…"
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addYouTubeLink(e.currentTarget.value, true);
                                                        e.currentTarget.value = "";
                                                    }
                                                }}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="space-y-2">
                                                {globalYt.map((embedUrl, i) => (
                                                    <div key={i} onClick={() => setVideoPreview(embedUrl)}>
                                                        <iframe
                                                            src={embedUrl}
                                                            width="100%"
                                                            height="100%"
                                                            frameBorder="0"
                                                            className="pointer-events-none rounded-lg"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Existing YouTube Videos (Global) */}
                                            <div className="space-y-2 mt-2">
                                                {existingGlobalYt.map((yt, i) => (
                                                    <div key={yt + i} onClick={() => setVideoPreview(yt)}>
                                                        <iframe
                                                            src={yt}
                                                            width="100%"
                                                            height="100%"
                                                            frameBorder="0"
                                                            className="pointer-events-none rounded-lg"
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                        </div>


                                        {/* External Links */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                <LinkIcon className="w-4 h-4" />
                                                External Links
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Paste URL..."
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addExternalLink(e.currentTarget.value, true);
                                                        e.currentTarget.value = "";
                                                    }
                                                }}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            />
                                            <div className="space-y-2">
                                                {globalLinks.map((link, i) => (
                                                    <div key={i} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg group bg-white/50">
                                                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                        <a
                                                            href={link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm text-blue-600 hover:text-blue-800 truncate flex-1"
                                                        >
                                                            {link}
                                                        </a>
                                                        <button
                                                            onClick={() => setGlobalLinks(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Existing Links (Global) */}
                                            <div className="space-y-2 mt-2">
                                                {existingGlobalLinks.map((link, i) => (
                                                    <div key={link + i} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg group bg-white/50">
                                                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                        <a
                                                            href={link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm text-blue-600 hover:text-blue-800 truncate flex-1"
                                                        >
                                                            {link}
                                                        </a>
                                                        <button
                                                            onClick={() => setExistingGlobalLinks(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Groups Section */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                                <div className="p-6 border-b border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                                <Users className="w-5 h-5 text-gray-600" />
                                                Groups ({groups.length})
                                            </h3>
                                            <p className="text-sm text-gray-600 mt-1">Create and configure groups for this assignment</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addGroup}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Group
                                        </button>
                                    </div>
                                </div>

                                {groups.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Users className="w-10 h-10 text-gray-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No groups created yet</h3>
                                        <p className="text-gray-600 mb-6">Start by creating your first group to organize students for this assignment.</p>
                                        <button
                                            type="button"
                                            onClick={addGroup}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm mx-auto"
                                        >
                                            <Plus className="w-5 h-5" />
                                            Create First Group
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-6 space-y-4">
                                        {groups.map((group, groupIndex) => {
                                            const isExpanded = expandedGroups.has(group.id);
                                            const isUsingGlobal = useGlobal[group.id] || false;

                                            return (
                                                <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                                    {/* Group Header */}
                                                    <div className="bg-gray-50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleGroupExpansion(group.id)}
                                                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                                >
                                                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                                </button>
                                                                <div>
                                                                    <h4 className="font-medium text-gray-900">
                                                                        {group.name || `Group ${groupIndex + 1}`}
                                                                    </h4>
                                                                    <p className="text-sm text-gray-600">
                                                                        {group.members.length} members • {group.points} points
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {isUsingGlobal && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                                                        <Globe className="w-3 h-3" />
                                                                        Global
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDeleteIndex(groupIndex)}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                                {deleteIndex !== null && (
                                                                    <div className="fixed inset-0 z-100 bg-black/40 flex items-center justify-center">
                                                                        <div className="bg-white p-6 rounded-xl shadow-xl min-w-[320px] max-w-[90vw]">
                                                                            <h3 className="font-semibold mb-2 text-lg">Delete Group?</h3>
                                                                            <p className="mb-4 text-gray-600">Are you sure you want to delete this group? This cannot be undone.</p>
                                                                            <div className="flex gap-3 justify-end">
                                                                                <button
                                                                                    className="px-4 py-2 rounded bg-gray-100 text-gray-800"
                                                                                    onClick={() => setDeleteIndex(null)}
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                                <button
                                                                                    className="px-4 py-2 rounded bg-red-600 text-white"
                                                                                    onClick={() => {
                                                                                        removeGroup(deleteIndex);
                                                                                        setDeleteIndex(null);
                                                                                    }}
                                                                                >
                                                                                    Delete
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Group Content */}
                                                    {isExpanded && (
                                                        <div className="p-6 space-y-6">
                                                            {/* Use Global Toggle */}
                                                            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`global-${group.id}`}
                                                                    checked={isUsingGlobal}
                                                                    onChange={e => setUseGlobal(prev => ({ ...prev, [group.id]: e.target.checked }))}
                                                                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <div className="flex-1">
                                                                    <label htmlFor={`global-${group.id}`} className="font-medium text-blue-900 cursor-pointer">
                                                                        Use Global Settings
                                                                    </label>
                                                                    <p className="text-sm text-blue-700 mt-1">
                                                                        Apply global title, topic,content, points, due date, and resources to this group
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                {/* Left Column - Group Settings */}
                                                                <div className="space-y-4">
                                                                    {!isUsingGlobal && (
                                                                        <>
                                                                            <div>
                                                                                <label className="block text-sm font-medium text-gray-700 mb-2">Group Assignment Title</label>
                                                                                <input
                                                                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                                                    value={group.title ?? ""}
                                                                                    onChange={e => updateGroup(groupIndex, "title", e.target.value)}
                                                                                    placeholder="Enter group title..."
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                                                                                <select
                                                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                                                                    value={group.topic ?? ""}
                                                                                    onChange={e => updateGroup(groupIndex, "topic", e.target.value)}
                                                                                >
                                                                                    <option value="">— inherit global —</option>
                                                                                    {topics.map(t => (
                                                                                        <option key={t._id} value={t._id}>{t.title}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>

                                                                            {!useGlobal[group.id] && (
                                                                                <div>
                                                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                                        Group Instructions
                                                                                    </label>
                                                                                    <TiptapEditor
                                                                                        content={group.content ?? ""}
                                                                                        onChange={html => updateGroup(groupIndex, "content", html)}
                                                                                        placeholder="Enter group‑specific instructions…"
                                                                                        className="min-h-[120px] prose prose-sm max-w-none"
                                                                                    />
                                                                                </div>
                                                                            )}




                                                                            <div className="grid grid-cols-2 gap-4">
                                                                                <div>
                                                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        min={0}
                                                                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                                                        value={group.points ?? ""}
                                                                                        onChange={e => updateGroup(groupIndex, "points", +e.target.value)}
                                                                                    />
                                                                                </div>
                                                                                <div>
                                                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                                                                                    <input
                                                                                        type="datetime-local"
                                                                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                                                        value={group.dueDate ?? ""}
                                                                                        onChange={e => updateGroup(groupIndex, "dueDate", e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                            Task (Required)
                                                                        </label>
                                                                        <input
                                                                            required
                                                                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                                            value={group.task ?? ""}
                                                                            onChange={e => updateGroup(groupIndex, "task", e.target.value)}
                                                                            placeholder="Describe the specific task for this group..."
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                            Group Name (Required)
                                                                        </label>
                                                                        <input
                                                                            required
                                                                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                                            value={group.name ?? ""}
                                                                            onChange={e => updateGroup(groupIndex, "name", e.target.value)}
                                                                            placeholder="Describe the specific task for this group..."
                                                                        />
                                                                    </div>


                                                                    {isUsingGlobal && (
                                                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <Globe className="w-4 h-4 text-gray-600" />
                                                                                <span className="text-sm font-medium text-gray-700">Using Global Settings</span>
                                                                            </div>
                                                                            <div className="space-y-2 text-sm text-gray-600">
                                                                                <p><strong>Title:</strong> {globalTitle || "Not set"}</p>
                                                                                <p><strong>Topic:</strong>{globalTopic || "not set"}</p>
                                                                                <p><strong>Points:</strong> {globalPoints}</p>
                                                                                <p><strong>Due Date:</strong> {globalDueDate ? new Date(globalDueDate).toLocaleString() : "Not set"}</p>
                                                                                <p><strong>Instructions:</strong> {globalContent ? "Set" : "Not set"}</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Right Column - Members */}
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Group Members</label>
                                                                        <div className="min-h-[120px] border border-gray-300 rounded-lg p-3 bg-gray-50">
                                                                            {group.members.length === 0 ? (
                                                                                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                                                                    No students assigned yet
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {group.members.map(memberId => {
                                                                                        const student = students.find(s => s._id === memberId);
                                                                                        return (
                                                                                            <div
                                                                                                key={memberId}
                                                                                                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                                                                                            >
                                                                                                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                                                                                                    {student?.username.charAt(0).toUpperCase()}
                                                                                                </div>
                                                                                                <span>{student?.username}</span>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        const newMembers = group.members.filter(id => id !== memberId);
                                                                                                        updateGroup(groupIndex, "members", newMembers);
                                                                                                    }}
                                                                                                    className="text-gray-400 hover:text-red-500 ml-1"
                                                                                                >
                                                                                                    <X className="w-3 h-3" />
                                                                                                </button>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Add Students</label>
                                                                        <select
                                                                            multiple
                                                                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-32"
                                                                            value={group.members}
                                                                            onChange={e => {
                                                                                const selectedOptions = Array.from(e.target.selectedOptions, o => o.value);
                                                                                updateGroup(groupIndex, "members", selectedOptions);
                                                                            }}
                                                                        >
                                                                            {students.map(student => (
                                                                                <option key={student._id} value={student._id}>
                                                                                    {student.username}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        <p className="text-xs text-gray-500 mt-1">
                                                                            Hold Ctrl/Cmd to select multiple students
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Group Resources */}
                                                            {!isUsingGlobal && (
                                                                <div className="pt-6 border-t border-gray-200">
                                                                    <h5 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                                                        <Settings className="w-5 h-5" />
                                                                        Group Resources
                                                                    </h5>

                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">


                                                                        {/* Group Media */}
                                                                        <div className="space-y-3">
                                                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                                                <ImageIcon className="w-4 h-4" />
                                                                                Media
                                                                            </label>
                                                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition-colors">
                                                                                <input
                                                                                    type="file"
                                                                                    multiple
                                                                                    accept="image/*,video/*"
                                                                                    onChange={e => updateGroup(groupIndex, "mediaFiles", appendFiles(group.mediaFiles, e.target.files))}
                                                                                    className="hidden"
                                                                                    id={`group-media-${group.id}`}
                                                                                />
                                                                                <label htmlFor={`group-media-${group.id}`} className="cursor-pointer">
                                                                                    <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                                                                    <span className="text-xs text-gray-600">Upload</span>
                                                                                </label>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                {/* {group.mediaFiles.map((file, idx) => renderMediaThumb(file, idx, () => {
                                                                                    const newMedia = group.mediaFiles.filter((_, i) => i !== idx);
                                                                                    updateGroup(groupIndex, "mediaFiles", newMedia);
                                                                                }))} */}
                                                                                {/* Existing Media (already uploaded) */}
                                                                                <div className="grid grid-cols-2 gap-2">
                                                                                    {/* Group existing media */}
                                                                                    {(group.existingMedia ?? []).map((file, idx) => (
                                                                                        <div key={file.url} className="relative group">
                                                                                            <img
                                                                                                src={getFilePreviewUrl(file)}
                                                                                                className="w-16 h-16 object-cover rounded-lg cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-colors"
                                                                                                alt={file.originalname}
                                                                                                onClick={() => setMediaPreview(file as any)}
                                                                                            />
                                                                                            <button
                                                                                                onClick={() =>
                                                                                                    updateGroup(groupIndex, "existingMedia", (group.existingMedia ?? []).filter((_, i) => i !== idx))
                                                                                                }
                                                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                            >
                                                                                                ×
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                    {/* Group new media */}
                                                                                    {group.mediaFiles.map((file, idx) =>
                                                                                        <div key={idx} className="relative group">
                                                                                            <img
                                                                                                src={getFilePreviewUrl(file)}
                                                                                                className="w-16 h-16 object-cover rounded-lg cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-colors"
                                                                                                alt={file.name}
                                                                                                onClick={() => setMediaPreview(file)}
                                                                                            />
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const newMedia = group.mediaFiles.filter((_, i) => i !== idx);
                                                                                                    updateGroup(groupIndex, "mediaFiles", newMedia);
                                                                                                }}
                                                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                                                                            >
                                                                                                ×
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>



                                                                            </div>

                                                                        </div>

                                                                        {/* Group Documents */}
                                                                        <div className="space-y-3">
                                                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                                                <FileText className="w-4 h-4" />
                                                                                Docs
                                                                            </label>
                                                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition-colors">
                                                                                <input
                                                                                    type="file"
                                                                                    multiple
                                                                                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                                                                                    onChange={e => updateGroup(groupIndex, "docFiles", appendFiles(group.docFiles, e.target.files))}
                                                                                    className="hidden"
                                                                                    id={`group-docs-${group.id}`}
                                                                                />
                                                                                <label htmlFor={`group-docs-${group.id}`} className="cursor-pointer">
                                                                                    <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                                                                    <span className="text-xs text-gray-600">Upload</span>
                                                                                </label>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                {/* {group.docFiles.map((file, idx) => renderDocThumb(file, idx, () => {
                                                                                    const newDocs = group.docFiles.filter((_, i) => i !== idx);
                                                                                    updateGroup(groupIndex, "docFiles", newDocs);
                                                                                }))} */}
                                                                                {/* Existing Docs (already uploaded) */}
                                                                                <div className="grid grid-cols-2 gap-2">
                                                                                    {/* Existing Docs */}
                                                                                    {(group.existingDocs ?? []).map((file, idx) => {
                                                                                        const fileUrl = getFilePreviewUrl(file);
                                                                                        const ext = file.originalname.split('.').pop()?.toLowerCase();

                                                                                        return (
                                                                                            <div key={file.url} className="relative group">
                                                                                                <div
                                                                                                    className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors"
                                                                                                    onClick={() => {
                                                                                                        setDocPreviewFile({ ...file, url: fileUrl } as any);
                                                                                                        setDocPreviewMode(ext === "pdf" ? "pdf" : "download");
                                                                                                    }}
                                                                                                >
                                                                                                    <FileText className="w-6 h-6 text-gray-600 mb-1" />
                                                                                                    <span className="text-[10px] font-medium text-gray-700">
                                                                                                        {ext?.toUpperCase()}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <button
                                                                                                    onClick={() =>
                                                                                                        updateGroup(
                                                                                                            groupIndex,
                                                                                                            "existingDocs",
                                                                                                            (group.existingDocs ?? []).filter((_, i) => i !== idx)
                                                                                                        )
                                                                                                    }
                                                                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                                >
                                                                                                    ×
                                                                                                </button>
                                                                                            </div>
                                                                                        );
                                                                                    })}

                                                                                    {/* New Docs */}
                                                                                    {group.docFiles.map((file, idx) =>
                                                                                        renderDocThumb(file, idx, () => {
                                                                                            const newDocs = group.docFiles.filter((_, i) => i !== idx);
                                                                                            updateGroup(groupIndex, "docFiles", newDocs);
                                                                                        })
                                                                                    )}
                                                                                </div>



                                                                            </div>
                                                                        </div>

                                                                        {/* Group YouTube */}
                                                                        <div className="space-y-3">
                                                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                                                <Youtube className="w-4 h-4" />
                                                                                Videos
                                                                            </label>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="YouTube URL..."
                                                                                onKeyDown={e => {
                                                                                    if (e.key === "Enter") {
                                                                                        e.preventDefault();
                                                                                        addYouTubeLink(e.currentTarget.value, false, groupIndex);
                                                                                        e.currentTarget.value = "";
                                                                                    }
                                                                                }}
                                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                                            />
                                                                            <div className="space-y-2">
                                                                                {/* {group.ytLinks.map((url, i) => (
                                                                                    <div key={i} className="relative group">
                                                                                        <div
                                                                                            className="aspect-video bg-gray-100 rounded cursor-pointer overflow-hidden border"
                                                                                            onClick={() => setVideoPreview(url)}
                                                                                        >
                                                                                            <iframe
                                                                                                width="100%"
                                                                                                height="100%"
                                                                                                src={url.replace("watch?v=", "embed/")}
                                                                                                frameBorder="0"
                                                                                                className="pointer-events-none"
                                                                                            />
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const newLinks = group.ytLinks.filter((_, idx) => idx !== i);
                                                                                                updateGroup(groupIndex, "ytLinks", newLinks);
                                                                                            }}
                                                                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        >
                                                                                            ×
                                                                                        </button>
                                                                                    </div>
                                                                                ))} */}
                                                                                {/* Existing YouTube Links */}
                                                                                <div className="space-y-2">
                                                                                    {/* Existing YouTube */}
                                                                                    {(group.existingYtLinks ?? []).map((url, idx) => (
                                                                                        <div key={idx} className="relative group">
                                                                                            <div
                                                                                                className="aspect-video bg-gray-100 rounded cursor-pointer overflow-hidden border"
                                                                                                onClick={() => setVideoPreview(url)}
                                                                                            >
                                                                                                <iframe
                                                                                                    width="100%"
                                                                                                    height="100%"
                                                                                                    src={url}
                                                                                                    frameBorder="0"
                                                                                                    className="pointer-events-none rounded-lg"
                                                                                                />
                                                                                            </div>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    updateGroup(groupIndex, "existingYtLinks", (group.existingYtLinks ?? []).filter((_, i) => i !== idx))
                                                                                                }
                                                                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                            >
                                                                                                ×
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                    {/* New YouTube */}
                                                                                    {group.ytLinks.map((url, i) => (
                                                                                        <div key={i} className="relative group">
                                                                                            <div
                                                                                                className="aspect-video bg-gray-100 rounded cursor-pointer overflow-hidden border"
                                                                                                onClick={() => setVideoPreview(url)}
                                                                                            >
                                                                                                <iframe
                                                                                                    width="100%"
                                                                                                    height="100%"
                                                                                                    src={url}
                                                                                                    frameBorder="0"
                                                                                                    className="pointer-events-none rounded-lg"
                                                                                                />
                                                                                            </div>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const newLinks = group.ytLinks.filter((_, idx) => idx !== i);
                                                                                                    updateGroup(groupIndex, "ytLinks", newLinks);
                                                                                                }}
                                                                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                            >
                                                                                                ×
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>


                                                                            </div>
                                                                        </div>

                                                                        {/* Group Links */}
                                                                        <div className="space-y-3">
                                                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                                                <LinkIcon className="w-4 h-4" />
                                                                                Links
                                                                            </label>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="URL..."
                                                                                onKeyDown={e => {
                                                                                    if (e.key === "Enter") {
                                                                                        e.preventDefault();
                                                                                        addExternalLink(e.currentTarget.value, false, groupIndex);
                                                                                        e.currentTarget.value = "";
                                                                                    }
                                                                                }}
                                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                                            />
                                                                            <div className="space-y-2">
                                                                                {/* {group.links.map((link, i) => (
                                                                                    <div key={i} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg group text-sm">
                                                                                        <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                                        <a
                                                                                            href={link}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-blue-600 hover:text-blue-800 truncate flex-1"
                                                                                        >
                                                                                            {link}
                                                                                        </a>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const newLinks = group.links.filter((_, idx) => idx !== i);
                                                                                                updateGroup(groupIndex, "links", newLinks);
                                                                                            }}
                                                                                            className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </button>
                                                                                    </div>
                                                                                ))} */}
                                                                                {/* Existing Links */}
                                                                                <div className="space-y-2">
                                                                                    {/* Existing Links */}
                                                                                    {(group.existingLinks ?? []).map((link, i) => (
                                                                                        <div key={i} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg group text-sm">
                                                                                            <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                                            <a
                                                                                                href={link}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-blue-600 hover:text-blue-800 truncate flex-1"
                                                                                            >
                                                                                                {link}
                                                                                            </a>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    updateGroup(groupIndex, "existingLinks", (group.existingLinks ?? []).filter((_, idx) => idx !== i))
                                                                                                }
                                                                                                className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                            >
                                                                                                <X className="w-3 h-3" />
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                    {/* New Links */}
                                                                                    {group.links.map((link, i) => (
                                                                                        <div key={i} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg group text-sm">
                                                                                            <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                                            <a
                                                                                                href={link}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-blue-600 hover:text-blue-800 truncate flex-1"
                                                                                            >
                                                                                                {link}
                                                                                            </a>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const newLinks = group.links.filter((_, idx) => idx !== i);
                                                                                                    updateGroup(groupIndex, "links", newLinks);
                                                                                                }}
                                                                                                className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                            >
                                                                                                <X className="w-3 h-3" />
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>


                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Summary & Validation */}
                            {groups.length > 0 && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <Check className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-green-900 mb-2">Assignment Summary</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <span className="text-green-700 font-medium">Groups Created:</span>
                                                    <p className="text-green-600">{groups.length} groups</p>
                                                </div>
                                                <div>
                                                    <span className="text-green-700 font-medium">Total Students:</span>
                                                    <p className="text-green-600">
                                                        {new Set(groups.flatMap(g => g.members)).size} assigned
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-green-700 font-medium">Using Global:</span>
                                                    <p className="text-green-600">
                                                        {Object.values(useGlobal).filter(Boolean).length} groups
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Validation Warnings */}
                            {groups.some(g => g.members.length === 0) && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-medium text-orange-900 mb-1">Warning: Empty Groups</h4>
                                            <p className="text-sm text-orange-800">
                                                Some groups don't have any students assigned. Make sure to add students to all groups before submitting.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 border-t border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span>{groups.length} Groups</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span>{new Set(groups.flatMap(g => g.members)).size} Students Assigned</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span>{Object.values(useGlobal).filter(Boolean).length} Using Global Settings</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                {!hasGlobalTitle && !allGroupsHaveTitles && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                        <p className="text-red-800">
                                            Either set a global Title, or make sure each group has its own Title.
                                        </p>
                                    </div>
                                )}

                                <button
                                    type="submit"

                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !canSubmit}
                                    className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-all shadow-sm ${isSubmitting || !canSubmit
                                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                        : "bg-green-600 hover:bg-green-700 text-white shadow-green-200"
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            updating Assignment...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            update Assignment
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}