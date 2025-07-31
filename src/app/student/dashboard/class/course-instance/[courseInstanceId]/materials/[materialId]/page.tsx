"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bookmark,
  Calendar,
  User,
  Loader2,
  AlertCircle,
  FileText,
  Eye,
  Send,
} from "lucide-react";

type Material = {
  _id: string;
  title: string;
  content?: string;
  postedBy?: { username?: string; email?: string; role?: string };
  createdAt?: string;
  updatedAt?: string;
  documents?: string[];
  images?: string[];
  youtubeLinks?: string[];
  links?: string[];
};

export default function MaterialDetail() {
  const params = useParams();
  const router = useRouter();
  const materialId = params?.materialId as string;

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            (localStorage.getItem("token_student") ||
              sessionStorage.getItem("token_student") ||
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

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="animate-spin w-7 h-7 mb-2" />
        Loading material details...
      </div>
    );

  if (error)
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 rounded text-red-600">
        <AlertCircle className="w-5 h-5" />
        {error}
      </div>
    );

  if (!material)
    return (
      <div className="py-10 text-center text-gray-400">Material not found.</div>
    );

  // helper to get filename
  const filename = (url: string) => url.split("/").pop();

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-3xl mx-auto px-5">
        {/* Card container */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded">
              <Bookmark className="w-6 h-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-semibold text-gray-900">
                {material.title}
              </h1>
              <div className="flex items-center text-gray-500 text-sm mt-1 space-x-4">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(
                    material.updatedAt || material.createdAt || ""
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                {material.postedBy?.username && (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {material.postedBy.username}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          {material.content && (
            <div
              className="prose max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: material.content }}
            />
          )}

          {/* Documents (Google‑style preview card) */}
          {material.documents && material.documents.length > 0 && (
            <div>
              <h4 className="text-gray-700 font-medium mb-2">Materials</h4>
              <div className="space-y-3">
                {material.documents.map((url, idx) => (
                  <a
                    key={idx}
                    href={
                      url.startsWith("http")
                        ? url
                        : (process.env.NEXT_PUBLIC_BACKEND_URL || "") + url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center border border-gray-200 rounded-lg p-4 hover:shadow transition-shadow"
                  >
                    <FileText className="w-6 h-6 text-gray-600" />
                    <div className="ml-4 flex-1">
                      <div className="text-gray-900 font-medium truncate">
                        {filename(url)}
                      </div>
                      <div className="text-gray-500 text-xs">PDF</div>
                    </div>
                    <Eye className="w-5 h-5 text-gray-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          {material.images && material.images.length > 0 && (
            <div>
              <h4 className="text-gray-700 font-medium mb-2">Images</h4>
              <div className="flex flex-wrap gap-3">
                {material.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={
                      img.startsWith("http")
                        ? img
                        : (process.env.NEXT_PUBLIC_BACKEND_URL || "") + img
                    }
                    alt="Material"
                    className="w-32 h-24 rounded border border-gray-200 object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {/* YouTube Videos */}
          {material.youtubeLinks && material.youtubeLinks.length > 0 && (
            <div>
              <h4 className="text-gray-700 font-medium mb-2">Videos</h4>
              <div className="space-y-4">
                {material.youtubeLinks.map((yt, idx) => {
                  const match = yt.match(
                    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/
                  );
                  const embedUrl = match
                    ? `https://www.youtube.com/embed/${match[1]}`
                    : yt;
                  return (
                    <iframe
                      key={idx}
                      width="100%"
                      height="220"
                      src={embedUrl}
                      title="YouTube video"
                      allowFullScreen
                      className="rounded border border-gray-200"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* External Links */}
          {material.links && material.links.length > 0 && (
            <div>
              <h4 className="text-gray-700 font-medium mb-2">Links</h4>
              <ul className="space-y-1">
                {material.links.map((link, idx) => (
                  <li key={idx}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm break-all"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Class comments */}
        <div className="mt-6 max-w-3xl mx-auto px-5">
          <h4 className="text-gray-700 font-medium mb-2">Class comments</h4>
          <div className="flex items-center space-x-2">
            <textarea
              rows={1}
              placeholder="Add class comment..."
              className="flex-1 resize-none border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none"
            />
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Send className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
