'use client';

import React, { useEffect, useMemo, useState } from 'react';

/* ===== CONFIG ===== */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const EP = {
  announcements: `${BACKEND}/announcement?adminView=true&limit=100`, // simple list
  facultyList: `${BACKEND}/faculty-api/faculties`,
  // to resolve batch names for "batches" audience (by faculty code)
  batchesByFacultyCode: (
    code: string,
    opts?: { programLevel?: string; facultyType?: 'semester' | 'yearly'; limit?: number }
  ) => {
    const p = new URLSearchParams();
    p.set('facultyCode', code);
    if (opts?.programLevel) p.set('programLevel', opts.programLevel);
    if (opts?.facultyType) p.set('facultyType', opts.facultyType);
    p.set('limit', String(opts?.limit ?? 500));
    return `${BACKEND}/batch-api/batch?${p.toString()}`;
  },
};

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token_admin') || localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ===== TYPES ===== */
type Audience = { mode: 'all' | 'faculty' | 'batches'; facultyIds?: string[]; batchIds?: string[] };

type AnnouncementItem = {
  _id: string;
  title: string;
  summary?: string;
  type?: 'general' | 'event' | 'seminar' | 'exam' | 'result' | 'cultural' | 'eca';
  priority?: 'normal' | 'high' | 'urgent';
  published?: boolean;
  pinned?: boolean;
  audience?: Audience;
  createdAt?: string;
};

type FacultyLite = {
  _id: string;
  name?: string;
  username?: string;
  email?: string;
  code?: string;                       // used to fetch batches
  programLevel?: string;
  type?: 'semester' | 'yearly';
};

type BatchLite = {
  _id: string;
  batchname?: string;  // prefer this
  batchName?: string;  // fallback
  name?: string;       // fallback
  code?: string;       // fallback
  year?: number;       // fallback
};

/* ===== HELPERS ===== */
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString() : '—');
const chip = (txt: React.ReactNode, cls = '') => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{txt}</span>
);
const priColor: Record<NonNullable<AnnouncementItem['priority']>, string> = {
  normal: 'bg-gray-100 text-gray-700',
  high: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-red-100 text-red-700',
};
const facLabel = (f: FacultyLite | undefined, id: string) =>
  f ? `${f.name || f.username || f.email || f._id}${f.code ? ` (${f.code})` : ''}` : id;
const batchLabel = (b: BatchLite) =>
  b.batchname || b.batchName || b.name || b.code || (b.year ? String(b.year) : b._id);

/* ===== LIST PAGE (ONLY) ===== */
export default function AnnouncementListOnly() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(false);

  // faculty + quick lookup
  const [faculty, setFaculty] = useState<FacultyLite[]>([]);
  const facultyById = useMemo(() => {
    const m = new Map<string, FacultyLite>();
    faculty.forEach((f) => m.set(f._id, f));
    return m;
  }, [faculty]);

  // cache batches per facultyId (so we can show batch names, not ids)
  const [batchCache, setBatchCache] = useState<Record<string, BatchLite[]>>({});

  /* load faculty + announcements */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // faculty
        const fRes = await fetch(EP.facultyList, { headers: { ...authHeaders() } });
        const fData = await fRes.json();
        const flist: FacultyLite[] = Array.isArray(fData) ? fData : fData.data || fData.teachers || [];
        setFaculty(flist);

        // announcements
        const aRes = await fetch(EP.announcements, { headers: { ...authHeaders() } });
        const aData = await aRes.json();
        setItems(aData.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* when items arrive, prefetch batches for any "batches" audience we haven't cached yet */
  useEffect(() => {
    (async () => {
      const needed = new Set<string>();
      items.forEach((it) => {
        if (it.audience?.mode === 'batches') {
          const fid = it.audience.facultyIds?.[0];
          if (fid && !batchCache[fid]) needed.add(fid);
        }
      });
      if (!needed.size) return;

      const updates: Record<string, BatchLite[]> = {};
      for (const fid of needed) {
        const fac = facultyById.get(fid);
        if (!fac?.code) continue;
        try {
          const url = EP.batchesByFacultyCode(fac.code, {
            programLevel: fac.programLevel,
            facultyType: fac.type,
            limit: 500,
          });
          const res = await fetch(url, { headers: { ...authHeaders() } });
          const data = await res.json();
          const list: BatchLite[] = Array.isArray(data?.batches)
            ? data.batches
            : Array.isArray(data)
            ? data
            : data.data || [];
          updates[fid] = list;
        } catch {
          // ignore
        }
      }
      if (Object.keys(updates).length) {
        setBatchCache((prev) => ({ ...prev, ...updates }));
      }
    })();
  }, [items, facultyById, batchCache]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-4">Announcements</h1>

        {loading && <div className="bg-white border rounded-xl p-6 text-gray-500">Loading…</div>}

        {!loading && items.length === 0 && (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-500">No announcements.</div>
        )}

        <div className="space-y-4">
          {items.map((it) => {
            const aud = it.audience;
            let audienceNode: React.ReactNode = chip('All (everyone)', 'bg-sky-50 text-sky-800');

            if (aud?.mode === 'faculty') {
              const ids = aud.facultyIds || [];
              const names = ids.map((id) => facLabel(facultyById.get(id), id));
              audienceNode =
                ids.length === 0
                  ? chip('Faculty: all (every batch)', 'bg-indigo-50 text-indigo-800')
                  : chip(`Faculty: ${names.join(', ')}`, 'bg-indigo-50 text-indigo-800');
            }

            if (aud?.mode === 'batches') {
              const fid = aud.facultyIds?.[0];
              const facName = fid ? facLabel(facultyById.get(fid), fid) : undefined;
              const cache = fid ? batchCache[fid] || [] : [];
              const map = new Map(cache.map((b) => [b._id, batchLabel(b)]));
              const batchNames = (aud.batchIds || []).map((id) => map.get(id) || id);
              audienceNode = (
                <div className="flex flex-wrap gap-2">
                  {facName && chip(facName, 'bg-emerald-50 text-emerald-800')}
                  {batchNames.length
                    ? chip(`Batches: ${batchNames.join(', ')}`, 'bg-emerald-50 text-emerald-800')
                    : chip('Batches: —', 'bg-emerald-50 text-emerald-800')}
                </div>
              );
            }

            return (
              <div key={it._id} className="bg-white border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {chip(it.type || 'general', 'bg-indigo-50 text-indigo-800')}
                      {chip(`Priority: ${it.priority || 'normal'}`, priColor[it.priority || 'normal'])}
                      {chip(it.published ? 'Published' : 'Draft', it.published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700')}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-gray-900 truncate">{it.title}</h3>
                    {it.summary && <p className="text-gray-600 text-sm mt-0.5">{it.summary}</p>}
                    <div className="mt-3">{audienceNode}</div>
                  </div>
                  <div className="text-sm text-gray-600 text-right">
                    <div>Created: <span className="font-medium">{fmtDate(it.createdAt)}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
