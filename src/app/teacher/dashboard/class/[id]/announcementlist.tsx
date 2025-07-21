"use client";

import { useEffect, useState, useRef } from "react";
import {
    FileTextIcon, FileImageIcon, FileSpreadsheetIcon, FileJsonIcon,
    FileArchiveIcon, FileAudioIcon, FileVideoIcon, FileCodeIcon, FileIcon,
    Download, Eye, Calendar, MoreVertical
} from "lucide-react";
import { FaFilePowerpoint } from "react-icons/fa";
import Image from "next/image";
import { useUser } from "../../teacherContext";
import EditAnnouncementModal from "./announcementeditform";

interface User {
    _id?: string;
    username?: string;
    email?: string;
    role?: string;
}

// Helper for avatar initials
function getInitials(nameOrEmail: string) {
    if (!nameOrEmail) return "?";
    if (nameOrEmail.includes("@")) return nameOrEmail[0].toUpperCase();
    const parts = nameOrEmail.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

const getOriginalFileName = (path: string) => {
    const filename = path.split("/").pop() || "";
    const match = filename.match(/^(?:[\d-]+-)+(.*)$/);
    return match ? match[1] : filename;
};

const fileTypeFromUrl = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.match(/\.(jpg|jpeg|png|gif)$/)) return "image";
    if (lower.endsWith(".pdf")) return "pdf";
    if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "ppt";
    if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
    if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "excel";
    if (lower.endsWith(".txt")) return "txt";
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".zip") || lower.endsWith(".rar")) return "zip";
    if (lower.endsWith(".mp3") || lower.endsWith(".wav")) return "audio";
    if (lower.endsWith(".mp4") || lower.endsWith(".avi") || lower.endsWith(".mov")) return "video";
    if (lower.endsWith(".js") || lower.endsWith(".ts")) return "code";
    return "other";
};

const getFileIcon = (type: string) => {
    switch (type) {
        case "pdf":
            return <FileTextIcon className="text-red-500" />;
        case "word":
            return <Image src={"/wordicon.svg"} alt="word icon" height={24} width={24} className="text-blue-700" />;
        case "excel":
            return <FileSpreadsheetIcon className="text-green-600" />;
        case "ppt":
            return <FaFilePowerpoint className="text-orange-500" />;
        case "image":
            return <FileImageIcon className="text-yellow-400" />;
        case "txt":
            return <FileTextIcon className="text-gray-600" />;
        case "json":
            return <FileJsonIcon className="text-green-700" />;
        case "zip":
            return <FileArchiveIcon className="text-orange-700" />;
        case "audio":
            return <FileAudioIcon className="text-purple-700" />;
        case "video":
            return <FileVideoIcon className="text-indigo-700" />;
        case "code":
            return <FileCodeIcon className="text-violet-700" />;
        default:
            return <FileIcon className="text-gray-400" />;
    }
};

function getOfficePreviewUrl(url: string) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

function TxtPreview({ url }: { url: string }) {
    const [text, setText] = useState("Loading...");
    useEffect(() => {
        fetch(url)
            .then(r => r.text())
            .then(setText)
            .catch(() => setText("Could not load file."));
    }, [url]);
    return <pre className="overflow-x-auto max-h-[350px] bg-gray-50 p-3">{text}</pre>;
}

function openFullscreen(elem: HTMLImageElement | HTMLIFrameElement | null) {
    if (!elem) return;
    if ((elem as any).requestFullscreen) (elem as any).requestFullscreen();
    else if ((elem as any).webkitRequestFullscreen) (elem as any).webkitRequestFullscreen();
    else if ((elem as any).msRequestFullscreen) (elem as any).msRequestFullscreen();
}

function LoadingSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {[1, 2].map((i) => (
                <div key={i} className="p-4 bg-white rounded-lg shadow">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4 mb-3"></div>
                    <div className="space-y-2">
                        <div className="h-2 bg-gray-200 rounded w-full"></div>
                        <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                    </div>
                </div>
            ))}
        </div>
    );
}

interface Announcement {
    _id: string;
    content: string;
    postedBy?: { _id?: string; username?: string; email?: string; };
    images?: string[];
    documents?: string[];
    links?: string[];
    youtubeLinks?: string[];
    createdAt?: string;
}

export default function AnnouncementsList({ courseInstanceId }: { courseInstanceId: string }) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewDoc, setPreviewDoc] = useState<{ url: string; type: string } | null>(null);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    const { user } = useUser();
    const imageRef = useRef<HTMLImageElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
    useEffect(() => {
        async function fetchAnnouncements() {
            setLoading(true);
            const token = localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/announcement-routes/course/${courseInstanceId}`,
                { headers: { Authorization: token ? `Bearer ${token}` : "" } }
            );
            const data = await res.json();
            setAnnouncements(data.announcements || []);
            setLoading(false);
        }
        fetchAnnouncements();
    }, [courseInstanceId]);

    useEffect(() => {
        if (!previewDoc) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setPreviewDoc(null);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [previewDoc]);

    const handleEdit = (announcement: Announcement) => {
        setSelectedAnnouncementId(announcement._id);
        setEditModalOpen(true);
    };

    const handleDelete = async (announcement: Announcement) => {
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;

        const token =
            localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/announcement-routes/${announcement._id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                }
            );
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to delete");
                return;
            }
            // Remove from state
            setAnnouncements((prev) => prev.filter((a) => a._id !== announcement._id));
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };


    if (loading) return <LoadingSkeleton />;
    if (announcements.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500">
                <div className="text-3xl mb-2">📢</div>
                <p>No announcements yet.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl ml-auto space-y-6">
            {announcements.map(a => {
                const posterId = a.postedBy?._id;
                const currentUserId = user?.id;
                // Only the posting user or admin can see Edit/Delete
                const canEdit = currentUserId && (currentUserId === posterId || user?.role === "admin");
                const displayName = a.postedBy?.username || a.postedBy?.email || "Unknown";
                return (
                    <div
                        key={a._id}
                        className="relative p-6 bg-white rounded-lg shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md"
                    >
                        {/* 3-dot menu for own post or admin */}
                        {canEdit && (
                            <div className="absolute right-6 top-7 z-10">
                                <button
                                    onClick={() => setMenuOpen(menuOpen === a._id ? null : a._id)}
                                    className="p-1 hover:bg-gray-100 rounded-full"
                                >
                                    <MoreVertical size={22} />
                                </button>
                                {menuOpen === a._id && (
                                    <div className="absolute right-0 mt-2 w-32 bg-white shadow-lg rounded-xl border border-gray-100 z-50">
                                        <button
                                            className="w-full px-4 py-2 text-left hover:bg-gray-50"
                                            onClick={() => { handleEdit(a); setMenuOpen(null); }}
                                        >
                                            Edit
                                        </button>

                                        <button
                                            className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                                            onClick={() => { setPendingDelete(a); setMenuOpen(null); }}
                                        >
                                            Delete
                                        </button>

                                    </div>
                                )}
                            </div>
                        )}

                        {/* Avatar, Name, Date */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold shadow">
                                {getInitials(displayName)}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-lg text-blue-800">{displayName}</span>
                                    {a.createdAt && (
                                        <span className="text-gray-500 text-base font-medium flex items-center gap-1">
                                            <Calendar size={18} className="mr-1" />
                                            {new Date(a.createdAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="mb-4 text-gray-800 prose prose-sm max-w-none announcement-content"
                            dangerouslySetInnerHTML={{ __html: a.content }} />

                        {/* Images */}
                        {a.images && a.images.length > 0 && (
                            <div className="flex gap-4 flex-wrap mt-2">
                                {a.images.map((url, idx) => {
                                    const src = url.startsWith("http")
                                        ? url
                                        : process.env.NEXT_PUBLIC_BACKEND_URL + url;
                                    return (
                                        <div key={idx} className="relative group">
                                            <img
                                                src={src}
                                                alt=""
                                                className="w-24 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                                onClick={() => setPreviewDoc({ url: src, type: "image" })}
                                                title="Click to view full image"
                                            />
                                            <a
                                                href={src}
                                                download
                                                className="absolute right-1 top-1 p-1 rounded-full bg-white shadow opacity-80 hover:opacity-100"
                                                title="Download Image"
                                            >
                                                <Download size={16} />
                                            </a>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Documents */}
                        {a.documents && a.documents.length > 0 && (
                            <div className="flex gap-4 flex-wrap mt-4">
                                {a.documents.map((url, idx) => {
                                    const fileUrl = url.startsWith("http")
                                        ? url
                                        : process.env.NEXT_PUBLIC_BACKEND_URL + url;
                                    const originalName = getOriginalFileName(url);
                                    const fileType = fileTypeFromUrl(fileUrl);
                                    const isPreviewable =
                                        ["pdf", "ppt", "word", "excel", "txt"].includes(fileType);

                                    return (
                                        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1 border">
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 font-medium text-blue-700 hover:underline"
                                                onClick={() =>
                                                    isPreviewable
                                                        ? setPreviewDoc({ url: fileUrl, type: fileType })
                                                        : window.open(fileUrl, "_blank")
                                                }
                                                title={`Preview ${originalName}`}
                                            >
                                                {getFileIcon(fileType)}
                                                <span className="text-xs truncate max-w-[110px]" title={originalName}>
                                                    {originalName}{isPreviewable ? " (Preview)" : ""}
                                                </span>
                                                <Eye className="ml-1" size={16} />
                                            </button>
                                            <a
                                                href={fileUrl}
                                                download={originalName}
                                                className="p-1 text-blue-700 hover:bg-blue-50 rounded-full"
                                                title={`Download ${originalName}`}
                                            >
                                                <Download size={16} />
                                            </a>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Preview Modal */}
                        {previewDoc && (
                            <div className="fixed inset-0 bg-black/70 z-[9999] backdrop-blur-sm
                          flex items-center justify-center transition-all duration-200">
                                <div className="bg-white rounded-xl p-6 max-w-4xl w-full shadow-2xl relative flex flex-col
                            scale-95 animate-[scale-in_0.2s_ease-in-out_forwards]">
                                    <button
                                        className="absolute top-2 right-2 bg-gray-200 p-1 rounded-full"
                                        onClick={() => setPreviewDoc(null)}
                                        title="Close"
                                    >✕</button>
                                    {/* Fullscreen button */}
                                    {previewDoc.type === "image" && (
                                        <button
                                            className="absolute top-2 left-2 bg-gray-200 p-1 rounded-full"
                                            title="Full screen"
                                            onClick={() => openFullscreen(imageRef.current)}
                                        >⛶</button>
                                    )}
                                    {["pdf", "ppt", "word", "excel"].includes(previewDoc.type) && (
                                        <button
                                            className="absolute top-2 left-2 bg-gray-200 p-1 rounded-full"
                                            title="Full screen"
                                            onClick={() => openFullscreen(iframeRef.current)}
                                        >⛶</button>
                                    )}
                                    <a
                                        href={previewDoc.url}
                                        download
                                        className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full"
                                        title="Download file"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Download size={18} />
                                    </a>
                                    {/* Preview content */}
                                    {previewDoc.type === "image" ? (
                                        <img
                                            ref={imageRef}
                                            src={previewDoc.url}
                                            alt=""
                                            className="max-w-full max-h-[80vh] rounded mx-auto"
                                        />
                                    ) : previewDoc.type === "pdf" ? (
                                        <iframe
                                            ref={iframeRef}
                                            src={previewDoc.url}
                                            width="100%"
                                            height="600px"
                                            className="rounded"
                                            allowFullScreen
                                        />
                                    ) : ["ppt", "word", "excel"].includes(previewDoc.type) ? (
                                        <iframe
                                            ref={iframeRef}
                                            src={getOfficePreviewUrl(previewDoc.url)}
                                            width="100%"
                                            height="500px"
                                            className="rounded"
                                            allowFullScreen
                                        />
                                    ) : previewDoc.type === "txt" ? (
                                        <TxtPreview url={previewDoc.url} />
                                    ) : (
                                        <div className="text-center text-gray-500">
                                            Preview not supported for this file type. <br />
                                            <a href={previewDoc.url} download className="text-blue-600 underline">Download</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Links and YouTube sections */}
                        {a.links && a.links.length > 0 && (
                            <div className="mt-2 space-x-2">
                                {a.links.map((link, idx) => (
                                    <a
                                        key={idx}
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline break-all"
                                    >
                                        {link}
                                    </a>
                                ))}
                            </div>
                        )}
                        {a.youtubeLinks && a.youtubeLinks.length > 0 && (
                            <div className="mt-2 flex gap-3">
                                {a.youtubeLinks.map((url, idx) => {
                                    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
                                    const embedUrl = match
                                        ? `https://www.youtube.com/embed/${match[1]}`
                                        : url;
                                    return (
                                        <iframe
                                            key={idx}
                                            width="300"
                                            height="170"
                                            src={embedUrl}
                                            title="YouTube video"
                                            allowFullScreen
                                            className="rounded"
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
            {pendingDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm text-center relative">
                        <h2 className="font-semibold text-xl mb-4">Delete Announcement?</h2>
                        <p className="mb-6 text-gray-600">
                            Are you sure you want to delete this announcement? This cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                                onClick={() => setPendingDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
                                onClick={async () => {
                                    if (!pendingDelete) return;
                                    const token =
                                        localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
                                    try {
                                        const res = await fetch(
                                            `${process.env.NEXT_PUBLIC_BACKEND_URL}/announcement-routes/${pendingDelete._id}`,
                                            {
                                                method: "DELETE",
                                                headers: {
                                                    Authorization: token ? `Bearer ${token}` : "",
                                                },
                                            }
                                        );
                                        const data = await res.json();
                                        if (!res.ok) {
                                            alert(data.error || "Failed to delete");
                                            return;
                                        }
                                        setAnnouncements(prev =>
                                            prev.filter(a => a._id !== pendingDelete._id)
                                        );
                                        setPendingDelete(null);
                                    } catch (err: any) {
                                        alert("Delete failed: " + err.message);
                                    }
                                }}
                            >
                                Yes, Delete
                            </button>
                        </div>
                        {/* Optional: close icon */}
                        <button
                            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl"
                            onClick={() => setPendingDelete(null)}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
            {editModalOpen && selectedAnnouncementId && (
                <EditAnnouncementModal
                    isOpen={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    announcementId={selectedAnnouncementId}
                    courseInstanceId={courseInstanceId}
                    onSuccess={() => {
                        setEditModalOpen(false);
                        // Optionally, refresh the announcements list after edit
                        // Re-fetch announcements if you want instant update
                        (async () => {
                            setLoading(true);
                            const token = localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
                            const res = await fetch(
                                `${process.env.NEXT_PUBLIC_BACKEND_URL}/announcement-routes/course/${courseInstanceId}`,
                                { headers: { Authorization: token ? `Bearer ${token}` : "" } }
                            );
                            const data = await res.json();
                            setAnnouncements(data.announcements || []);
                            setLoading(false);
                        })();
                    }}
                />
            )}

        </div>
    );
}
