"use client";

export type SimpleDraft = {
  _id: string;
  kind: "exam" | "practical";
  marks?: number | "";
  practicalTotal?: number | "";
  passMarks?: number | "";
  remarks?: string;
};

type Props = {
  draft: SimpleDraft;
  onChange: (next: SimpleDraft) => void;
  maxMarks?: number | null;
};

export default function QuickEditFields({ draft, onChange, maxMarks }: Props) {
  const Base = "border rounded-lg px-3 py-2 text-sm";

  if (draft.kind === "exam") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            aria-label="Marks"
            placeholder="Marks"
            className={`${Base} w-28`}
            value={draft.marks ?? ""}
            onChange={(e) =>
              onChange({ ...draft, marks: e.target.value === "" ? "" : Number(e.target.value) })
            }
          />
          <span className="text-slate-500 text-sm">/ {maxMarks ?? "—"}</span>
        </div>
        <input
          type="number"
          aria-label="Pass marks"
          placeholder="Pass"
          className={`${Base} w-24`}
          value={draft.passMarks ?? ""}
          onChange={(e) =>
            onChange({ ...draft, passMarks: e.target.value === "" ? "" : Number(e.target.value) })
          }
        />
        <input
          type="text"
          aria-label="Remarks"
          placeholder="Remarks"
          className={`${Base} w-72`}
          value={draft.remarks ?? ""}
          onChange={(e) => onChange({ ...draft, remarks: e.target.value })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        aria-label="Practical total"
        placeholder="Total"
        className={`${Base} w-28`}
        value={draft.practicalTotal ?? ""}
        onChange={(e) =>
          onChange({
            ...draft,
            practicalTotal: e.target.value === "" ? "" : Number(e.target.value),
          })
        }
      />
      <input
        type="number"
        aria-label="Pass marks"
        placeholder="Pass"
        className={`${Base} w-24`}
        value={draft.passMarks ?? ""}
        onChange={(e) =>
          onChange({ ...draft, passMarks: e.target.value === "" ? "" : Number(e.target.value) })
        }
      />
      <input
        type="text"
        aria-label="Remarks"
        placeholder="Remarks"
        className={`${Base} w-72`}
        value={draft.remarks ?? ""}
        onChange={(e) => onChange({ ...draft, remarks: e.target.value })}
      />
    </div>
  );
}
