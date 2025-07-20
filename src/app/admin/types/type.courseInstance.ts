export interface CourseInstance {
  _id: string;
  batch: { _id: string; batchname?: string };
  course: { _id: string; name: string; type: string };
  teacher: { _id: string; username: string; email: string };
  assignments?: { _id: string; title?: string }[]; // if populated, or string[]
  materials?: { _id: string; title?: string }[];    // if populated, or string[]
  attendanceRecords?: { _id: string }[];            // or string[]
  grades?: { _id: string }[];                       // or string[]
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
