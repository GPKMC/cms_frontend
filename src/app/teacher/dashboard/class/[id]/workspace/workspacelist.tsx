"use client";
import { useEffect, useState } from "react";

interface Material {
  _id: string;
  title: string;
  content: string;
  topic?: { _id: string; title: string } | null;
  postedBy?: { username?: string; email?: string };
  createdAt: string;
}

interface Topic {
  _id: string;
  title: string;
}

async function fetchMaterials(courseInstanceId: string, token: string): Promise<Material[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/course-materials/course/${courseInstanceId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch materials");
  return data.materials;
}

async function fetchTopics(courseInstanceId: string, token: string): Promise<Topic[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/topic-api/course/${courseInstanceId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.topics || [];
}

export default function MaterialsByTopic({ courseInstanceId }: { courseInstanceId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const token =
      localStorage.getItem("token_teacher") ||
      localStorage.getItem("token_student") ||
      "";
    Promise.all([
      fetchMaterials(courseInstanceId, token),
      fetchTopics(courseInstanceId, token),
    ])
      .then(([materials, topics]) => {
        setMaterials(materials);
        setTopics(topics);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseInstanceId]);

  // Group materials by topic
  const grouped: Record<string, Material[]> = {};
  for (const mat of materials) {
    const topicId = mat.topic?._id || "none";
    if (!grouped[topicId]) grouped[topicId] = [];
    grouped[topicId].push(mat);
  }
  // Sort by time, newest first
  Object.values(grouped).forEach(arr =>
    arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  );

  // Dropdown filter options
  let topicOptions = [{ value: "all", label: "All Topics" }];
  topicOptions = topicOptions.concat(
    topics.map(t => ({ value: t._id, label: t.title }))
  );
  if (grouped["none"] && grouped["none"].length)
    topicOptions.push({ value: "none", label: "No Topic" });

  // --- UI rendering
  let content;
  if (filterTopic === "all") {
    // Grouped by topic
    content = (
      <div>
        {topics.map(topic => (
          <div key={topic._id} className="mb-8">
            <h2 className="text-lg font-bold mb-2">{topic.title}</h2>
            {grouped[topic._id]?.length
              ? grouped[topic._id].map(mat => (
                  <MaterialCard key={mat._id} material={mat} />
                ))
              : <div className="text-gray-400 text-sm">No materials for this topic.</div>
            }
          </div>
        ))}
        {/* No Topic section */}
        {grouped["none"]?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-2">No Topic</h2>
            {grouped["none"].map(mat => (
              <MaterialCard key={mat._id} material={mat} />
            ))}
          </div>
        )}
        {topics.length === 0 && !grouped["none"] && (
          <div>No materials found.</div>
        )}
      </div>
    );
  } else if (filterTopic === "none") {
    // Only no-topic
    content = (
      <div>
        <h2 className="text-lg font-bold mb-2">No Topic</h2>
        {grouped["none"]?.length
          ? grouped["none"].map(mat => <MaterialCard key={mat._id} material={mat} />)
          : <div className="text-gray-400 text-sm">No unassigned materials.</div>
        }
      </div>
    );
  } else {
    // Only one topic
    const topic = topics.find(t => t._id === filterTopic);
    content = (
      <div>
        <h2 className="text-lg font-bold mb-2">{topic?.title || "Unknown Topic"}</h2>
        {grouped[filterTopic]?.length
          ? grouped[filterTopic].map(mat => <MaterialCard key={mat._id} material={mat} />)
          : <div className="text-gray-400 text-sm">No materials for this topic.</div>
        }
      </div>
    );
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="my-6">
      {/* Filter select */}
      <div className="mb-6 flex items-center gap-3">
        <span className="font-medium">Filter by topic:</span>
        <select
          className="border px-3 py-1 rounded"
          value={filterTopic}
          onChange={e => setFilterTopic(e.target.value)}
        >
          {topicOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {content}
    </div>
  );
}

// --- Material Card Subcomponent ---
function MaterialCard({ material }: { material: Material }) {
  return (
    <div className="bg-white border rounded p-4 shadow mb-2">
      <div className="font-semibold">{material.title}</div>
      <div
        className="prose max-w-none text-sm mt-1"
        dangerouslySetInnerHTML={{ __html: material.content }}
      />
      <div className="text-xs text-gray-500 mt-2">
        Posted by: {material.postedBy?.username || material.postedBy?.email || "Unknown"}
        &nbsp;•&nbsp;
        {new Date(material.createdAt).toLocaleString()}
      </div>
    </div>
  );
}
