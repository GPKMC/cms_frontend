export type BatchPeriod = {
  _id: string;
  batch: {
    _id: string;
    batchname: string;
    slug: string;
  };
  semesterOrYear: {
    _id: string;
    name?: string;
    semesterNumber?: number;
    yearNumber?: number;
    courses?: { _id: string; code: string; name: string }[];
  };
  startDate?: string;
  endDate?: string;
  status: "not_started" | "ongoing" | "completed";
  description?: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
};
