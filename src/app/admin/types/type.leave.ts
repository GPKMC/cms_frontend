
export type UserLite = {
  _id?: string;
  username?: string;
  email?: string;
  role?: "teacher" | "student" | "admin" | string;
};

export type LeaveItem = {
  _id: string;
  user?: UserLite;
  role: "teacher" | "student" | "admin" | string;
  leaveDate: string;
  dayPart: "first_half" | "second_half" | "full_day";
  type: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason?: string;
  rejectionReason?: string;
};
