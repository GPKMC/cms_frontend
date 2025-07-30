"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen, Calendar, User, Loader2, AlertCircle, Download, FileText, Eye
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
 console.log("material Id: ",materialId)
 useEffect(() => {
  if (!materialId) return;

  setLoading(true);
  setError(null);

  fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/student/material/${materialId}`,
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
    .then((data) => {
      console.log("Fetched material data:", data); // <---- LOG
      setMaterial(data);
    })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
}, [materialId]);

useEffect(() => {
  if (material) {
    console.log("Material in state:", material);
  }
}, [material]);


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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40">
      <div className="max-w-3xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{material.title}</h1>
            <div className="flex gap-5 text-gray-500 mt-1 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(material.updatedAt || material.createdAt || "").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
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
            className="prose prose-sm max-w-none text-gray-700 mb-6"
            dangerouslySetInnerHTML={{ __html: material.content }}
          />
        )}

        {/* Documents */}
        {material.documents && material.documents.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents
            </h4>
            <div className="flex flex-wrap gap-3">
              {material.documents.map((url, idx) => (
                <a
                  key={idx}
                  href={
                    url.startsWith("http")
                      ? url
                      : (process.env.NEXT_PUBLIC_BACKEND_URL || "") + url
                  }
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors duration-200 text-sm"
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="truncate max-w-[120px]">
                    {url.split("/").pop()}
                  </span>
                  <Eye className="w-4 h-4 text-blue-600 ml-2" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Images */}
        {material.images && material.images.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-2">Images</h4>
            <div className="flex flex-wrap gap-3">
              {material.images.map((img, idx) => (
                <img
                  key={idx}
                  src={
                    img.startsWith("http")
                      ? img
                      : (process.env.NEXT_PUBLIC_BACKEND_URL || "") + img
                  }
                  alt="Material attachment"
                  className="w-32 h-24 rounded-lg border border-gray-200 object-cover"
                />
              ))}
            </div>
          </div>
        )}

        {/* YouTube Videos */}
        {material.youtubeLinks && material.youtubeLinks.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-2">Videos</h4>
            <div className="space-y-3">
              {material.youtubeLinks.map((yt, idx) => {
                const match = yt.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
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
                    className="rounded-lg border border-gray-200"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* External Links */}
        {material.links && material.links.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-2">External Links</h4>
            <div className="space-y-1">
              {material.links.map((link, idx) => (
                <a
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
