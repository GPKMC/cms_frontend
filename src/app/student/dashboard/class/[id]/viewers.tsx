import { motion } from "framer-motion";

interface User {
  _id: string;
  username?: string;
  name?: string;
  email?: string;
}

interface RecipientsPanelProps {
  students: User[];
  visibleTo: string[];
  setVisibleTo: React.Dispatch<React.SetStateAction<string[]>>;
  isAllSelected: boolean;
}

export default function RecipientsPanel({
  students,
  visibleTo,
  setVisibleTo,
  isAllSelected,
}: RecipientsPanelProps) {         // 👈 This is important!
  return (
    <motion.div
      key="recipients-panel"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, type: "tween" }}
      className="overflow-hidden rounded-lg border bg-gray-50 mt-2 p-4"
    >
      <div className="mb-2 flex items-center">
        <input
          type="checkbox"
          id="select-all-students"
          checked={isAllSelected}
          onChange={(e) =>
            e.target.checked
              ? setVisibleTo(students.map((s) => s._id))
              : setVisibleTo([])
          }
          className="mr-2"
        />
        <label htmlFor="select-all-students" className="text-sm font-semibold cursor-pointer">
          Select All Students
        </label>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {students.map((stu) => (
          <label key={stu._id} className="flex items-center gap-2 mb-1 cursor-pointer">
            <input
              type="checkbox"
              checked={visibleTo.includes(stu._id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setVisibleTo((prev) => [...prev, stu._id]);
                } else {
                  setVisibleTo((prev) => prev.filter((id) => id !== stu._id));
                }
              }}
            />
            <span>
              {stu.name || stu.username}
              {stu.email && (
                <span className="text-xs text-gray-500">({stu.email})</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Leave all unchecked or use “Select All” to show to everyone.
      </div>
    </motion.div>
  );
}
