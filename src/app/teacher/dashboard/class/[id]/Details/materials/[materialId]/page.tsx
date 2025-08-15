"use client";
import React, { useState, useRef, useEffect } from "react";
import {
    Bookmark, Calendar, User, FileText, Eye, X, Send, PlayCircle,
    Download, ExternalLink, ArrowLeft, MessageCircle,
    Heart, Clock, File, Image, Video, Link2, ChevronDown, Star,
    MoreVertical,
    Edit2,
    Trash2
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import TiptapEditor from "@/app/student/dashboard/class/course-instance/[courseInstanceId]/components/rtecomponet";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/app/teacher/dashboard/teacherContext";

type FileObj = { url: string; originalname?: string };
type Material = {
    _id: string;
    title: string;
    content?: string;
    postedBy?: { username?: string; role?: string };
    createdAt?: string;
    updatedAt?: string;
    documents?: FileObj[];
    media?: FileObj[];
    youtubeLinks?: string[];
    links?: string[];
};

type PreviewModal =
    | { type: "doc"; file: FileObj }
    | { type: "yt"; ytUrl: string }
    | { type: "img"; img: FileObj }
    | null;

// --- UTILS ---
function getFileType(url: string) {
    const ext = url.split(".").pop()?.toLowerCase() || "";
    if (["pdf"].includes(ext)) return "pdf";
    if (["doc", "docx"].includes(ext)) return "word";
    if (["ppt", "pptx"].includes(ext)) return "ppt";
    if (["xls", "xlsx"].includes(ext)) return "xls";
    if (["zip", "rar"].includes(ext)) return "archive";
    return "file";
}
function getFileIcon(url: string) {
    const type = getFileType(url);
    switch (type) {
        case "pdf": return "📄";
        case "word": return "📝";
        case "ppt": return "📊";
        case "xls": return "📋";
        case "archive": return "🗜️";
        default: return "📁";
    }
}
// Returns full URL for files/images, works for relative or absolute
function getAbsoluteUrl(url: string) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return (process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "") + url;
}

export default function MaterialDetail() {
    const params = useParams();
    const router = useRouter();
    const materialId = params.materialId as string;
    const courseInstanceId = params.id as string;
    const [material, setMaterial] = useState<Material | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewModal, setPreviewModal] = useState<PreviewModal>(null);
    const [liked, setLiked] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const [comment, setComment] = useState("");
    const [showAllLinks, setShowAllLinks] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);
    //coments hooks 
    const [comments, setComments] = useState<any[]>([]);
    const [posting, setPosting] = useState(false);
    const { user } = useUser();
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [editId, setEditId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState<string>("");
    const [editPosting, setEditPosting] = useState(false);
    const searchParams = useSearchParams();
    const highlightCommentId = searchParams.get("commentId");
useEffect(() => {
    if (highlightCommentId && comments.length > 0) {
        setTimeout(() => {
            const el = document.getElementById(`comment-${highlightCommentId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-blue-500", "bg-blue-50", "transition");
                setTimeout(() => {
                    el.classList.remove("ring-2", "ring-blue-500", "bg-blue-50", "transition");
                }, 2000);
            }
        }, 300);
    }
}, [comments, highlightCommentId]);
    useEffect(() => {
        if (!materialId) return;
        setLoading(true);
        setError(null);

        fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/course-materials/material/${materialId}`,
            {
                headers: {
                    Authorization:
                        "Bearer " +
                        (localStorage.getItem("token_teacher") ||
                            sessionStorage.getItem("token_teacher") ||
                            ""),
                },
            }
        )
            .then((r) => {
                if (!r.ok) throw new Error("Material not found or access denied");
                return r.json();
            })
            .then(({ material }) => setMaterial(material))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [materialId]);

    const filename = (url: string) => url.split("/").pop() || "Unknown file";
    useEffect(() => {
        if (!materialId) return;
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/comment/material-comments/${materialId}`)
            .then((r) => r.json())
            .then(setComments)
            .catch(() => setComments([]));
    }, [materialId]);

    // --- POST COMMENT LOGIC ---
    async function handlePostComment() {
        if (!comment.replace(/<[^>]+>/g, "").trim()) return;
        setPosting(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/comment/material-comments/${materialId}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization:
                            "Bearer " +
                            (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher") || ""),
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
    async function handleDelete(commentId: string) {
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/comment/material-comments/${commentId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization:
                            "Bearer " +
                            (localStorage.getItem("token_teacher") ||
                                sessionStorage.getItem("token_teacher") ||
                                ""),
                    },
                }
            );
            if (!res.ok) throw new Error("Failed to delete comment");

            // Remove from UI
            setComments((prev) => prev.filter((c) => c._id !== commentId));
            // Optionally, show toast:
            // toast.success("Comment deleted!");
        } catch (err) {
            alert("Failed to delete comment.");
        }
    }

    async function handleEditSave(commentId: string) {
        setEditPosting(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/comment/material-comments/${commentId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization:
                            "Bearer " +
                            (localStorage.getItem("token_teacher") ||
                                sessionStorage.getItem("token_teacher") ||
                                ""),
                    },
                    body: JSON.stringify({ content: editContent }),
                }
            );
            if (!res.ok) throw new Error("Failed to update comment");
            const data = await res.json();
            setComments((prev) =>
                prev.map((c) => (c._id === commentId ? { ...c, content: data.comment.content } : c))
            );
            setEditId(null);
            setEditContent("");
        } catch (err) {
            alert("Failed to update comment.");
        } finally {
            setEditPosting(false);
        }
    }

    // Modal logic
    const renderModal = () => {
        if (!previewModal) return null;

        // IMAGE MODAL
        if (previewModal.type === "img") {
            const img = previewModal.img;
            const absUrl = getAbsoluteUrl(img.url);
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="relative max-w-7xl max-h-[95vh] mx-4">
                        <button
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
                            onClick={() => setPreviewModal(null)}
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <button
                            className="absolute -top-12 right-12 text-white hover:text-gray-300 transition-colors"
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = absUrl;
                                link.download = img.originalname || filename(img.url);
                                link.click();
                            }}
                        >
                            <Download className="w-6 h-6" />
                        </button>
                        <img
                            ref={imageRef}
                            src={absUrl}
                            alt={img.originalname || "Material"}
                            className="max-w-full max-h-[95vh] rounded-lg shadow-2xl"
                        />
                        <div className="absolute -bottom-8 left-0 right-0 text-center text-white text-sm">
                            {img.originalname || filename(img.url)}
                        </div>
                    </div>
                </div>
            );
        }

        // DOCUMENT MODAL (Microsoft Office Viewer / Google Docs Viewer)
        // --- Inside renderModal ---
        if (previewModal.type === "doc") {
            const file = previewModal.file;
            const absUrl = getAbsoluteUrl(file.url);
            const fileType = getFileType(file.url);

            // Use Microsoft Office Online Viewer for Office docs
            const msViewerUrl =
                fileType === "word" || fileType === "ppt" || fileType === "xls"
                    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absUrl)}`
                    : null;

            // Use browser-native for PDFs (just open in iframe)
            const isPdf = fileType === "pdf";

            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] mx-4 flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{getFileIcon(file.url)}</span>
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        {file.originalname || filename(file.url)}
                                    </h3>
                                    <p className="text-sm text-gray-500">Document Preview</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = absUrl;
                                        link.download = file.originalname || filename(file.url);
                                        link.click();
                                    }}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setPreviewModal(null)}
                                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 flex items-center justify-center">
                            {msViewerUrl ? (
                                <iframe
                                    src={msViewerUrl}
                                    style={{ width: "100%", height: "60vh", border: "none" }}
                                    title="Office Online Preview"
                                    allowFullScreen
                                />
                            ) : isPdf ? (
                                <iframe
                                    src={absUrl}
                                    style={{ width: "100%", height: "60vh", border: "none" }}
                                    title="PDF Preview"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="text-center text-gray-500">
                                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-semibold mb-2">No Preview Available</p>
                                    <p>Click download to view the full document</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }


        // YOUTUBE MODAL
        if (previewModal.type === "yt") {
            const yt = previewModal.ytUrl;
            const match = yt.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
            const embedUrl = match ? `https://www.youtube.com/embed/${match[1]}` : yt;

            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl mx-4">
                        <button
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
                            onClick={() => setPreviewModal(null)}
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <div className="bg-black rounded-2xl overflow-hidden shadow-2xl">
                            <iframe
                                width="100%"
                                height="500"
                                src={embedUrl}
                                title="YouTube video"
                                allowFullScreen
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    if (loading)
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <FileText className="animate-spin w-7 h-7 mb-2" />
                Loading material details...
            </div>
        );

    if (error)
        return (
            <div className="flex items-center gap-2 p-4 bg-red-50 rounded text-red-600">
                <X className="w-5 h-5" />
                {error}
            </div>
        );

    if (!material)
        return (
            <div className="py-10 text-center text-gray-400">Material not found.</div>
        );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {renderModal()}

                {/* Back Navigation */}
                <button
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors group"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>Back to Materials</span>
                </button>

                {/* Main Content Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-8 text-white">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                        <Bookmark className="w-6 h-6" />
                                    </div>
                                    <div className="flex items-center gap-2 text-blue-100">
                                        <Clock className="w-4 h-4" />
                                        <span className="text-sm">Material Details</span>
                                    </div>
                                </div>
                                <h1 className="text-3xl font-bold mb-4 leading-tight">
                                    {material.title}
                                </h1>
                                <div className="flex items-center gap-6 text-blue-100">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-sm">
                                            {new Date(material.updatedAt ?? material.createdAt ?? "").toLocaleDateString("en-US", {
                                                month: "long",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                    </div>
                                    {material.postedBy?.username && (
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4" />
                                            <span className="text-sm font-medium">{material.postedBy.username}</span>
                                            {material.postedBy.role && (
                                                <span className="px-2 py-1 bg-white/20 rounded-full text-xs">
                                                    {material.postedBy.role}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        {material.content && (
                            <div
                                className="prose prose-lg max-w-none text-gray-700 leading-relaxed announcement-content"
                                dangerouslySetInnerHTML={{ __html: material.content }}
                            />
                        )}

                        {/* Resources Section */}
                        <div className="mt-12 space-y-8">
                            {/* Documents */}
                            {material.documents && material.documents.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <File className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-gray-900">Documents & Files</h3>
                                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                                            {material.documents.length} files
                                        </span>
                                    </div>
                                    <div className="grid gap-4">
                                        {material.documents.map((file, idx) => {
                                            const absUrl = getAbsoluteUrl(file.url);
                                            return (
                                                <div
                                                    key={idx}
                                                    className="group flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 hover:border-gray-300 transition-all cursor-pointer"
                                                    onClick={() => setPreviewModal({ type: "doc", file })}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-3xl">{getFileIcon(file.url)}</div>
                                                        <div>
                                                            <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                                                {file.originalname || filename(file.url)}
                                                            </div>
                                                            <div className="text-sm text-gray-500 capitalize">
                                                                {getFileType(file.url)} document
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                setPreviewModal({ type: "doc", file });
                                                            }}
                                                            className="p-2 bg-white rounded-lg hover:bg-blue-50 border border-gray-200"
                                                        >
                                                            <Eye className="w-4 h-4 text-gray-600" />
                                                        </button>
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                const link = document.createElement('a');
                                                                link.href = absUrl;
                                                                link.download = file.originalname || filename(file.url);
                                                                link.click();
                                                            }}
                                                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Images */}
                            {material.media && material.media.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <Image className="w-5 h-5 text-green-600" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-gray-900">Images & Diagrams</h3>
                                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                                            {material.media.length} images
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {material.media.map((img, idx) => {
                                            const absUrl = getAbsoluteUrl(img.url);
                                            return (
                                                <div
                                                    key={idx}
                                                    className="group relative rounded-xl overflow-hidden cursor-pointer bg-gray-100 aspect-video"
                                                    onClick={() => setPreviewModal({ type: "img", img })}
                                                >
                                                    <img
                                                        src={absUrl}
                                                        alt={img.originalname || "Material"}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Eye className="w-8 h-8 text-white drop-shadow-lg" />
                                                        </div>
                                                    </div>
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                                                        <p className="text-white text-sm font-medium truncate">
                                                            {img.originalname || filename(img.url)}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Videos */}
                            {material.youtubeLinks && material.youtubeLinks.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-red-100 rounded-lg">
                                            <Video className="w-5 h-5 text-red-600" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-gray-900">Video Content</h3>
                                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                                            {material.youtubeLinks.length} videos
                                        </span>
                                    </div>
                                    <div className="grid gap-6">
                                        {material.youtubeLinks.map((yt, idx) => {
                                            const match = yt.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
                                            const videoId = match?.[1];
                                            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

                                            return (
                                                <div
                                                    key={idx}
                                                    className="group relative rounded-xl overflow-hidden cursor-pointer bg-gray-900 aspect-video"
                                                    onClick={() => setPreviewModal({ type: "yt", ytUrl: yt })}
                                                >
                                                    <img
                                                        src={thumbnailUrl}
                                                        alt="Video thumbnail"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center">
                                                        <div className="bg-red-600 hover:bg-red-700 rounded-full p-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                                                            <PlayCircle className="w-12 h-12 text-white fill-current" />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* External Links */}
                            {material.links && material.links.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-purple-100 rounded-lg">
                                            <Link2 className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-gray-900">External Resources</h3>
                                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                                            {material.links.length} links
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {material.links.slice(0, showAllLinks ? undefined : 3).map((link, idx) => (
                                            <a
                                                key={idx}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-all"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 bg-white rounded-lg border border-gray-200 group-hover:border-blue-300 transition-colors">
                                                        <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                                            {new URL(link).hostname}
                                                        </div>
                                                        <div className="text-sm text-gray-500 truncate max-w-md">
                                                            {link}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </a>
                                        ))}
                                        {material.links.length > 3 && (
                                            <button
                                                onClick={() => setShowAllLinks(!showAllLinks)}
                                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                            >
                                                <span>{showAllLinks ? "Show less" : `Show ${material.links.length - 3} more links`}</span>
                                                <ChevronDown className={`w-4 h-4 transition-transform ${showAllLinks ? "rotate-180" : ""}`} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Comments Section */}
                <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <MessageCircle className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">Class Discussion</h3>
                    </div>
                    {/* List of comments */}
                    <div className="space-y-6 mb-8">
                        {comments.length === 0 && (
                            <div className="text-gray-400 text-sm">No comments yet. Start the discussion!</div>
                        )}
                        {comments.map((c, i) => {
                            // ... your existing stuff
                            const commentUserId = c.postedBy?._id || c.postedBy?.id;
                            const myUserId = user?.id;
                            const isEditing = editId === c._id;

                            return (
                                <div
                                    key={c._id || i}
                                    id={`comment-${c._id}`}  // <- Add this line
                                    className="border-b last:border-0 pb-4 relative group"
                                >
                                    <div className="flex gap-2 items-center text-sm mb-1">
                                        <span className="font-semibold text-blue-700">{c.postedBy?.username || "Unknown"}</span>
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
                                                            setEditContent(c.content); // Pre-fill with current content
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
                        })}

                    </div>

                    {/* Comment box */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <TiptapEditor
                                content={comment}
                                onChange={setComment}
                                placeholder="Share your thoughts or ask questions about this material..."
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
                </div>
            </div>
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
                        <h2 className="text-xl font-semibold mb-4">Delete Comment?</h2>
                        <p className="mb-6 text-gray-600">Are you sure you want to permanently delete this comment? This cannot be undone.</p>
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
            {/* editing form */}

        </div>
    );
}
