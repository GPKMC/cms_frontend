export type User = {
  username: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'superadmin';
  googleId?: string | null;
  isActive: boolean;
  isVerified: boolean;
  // Optional fields if you want to include timestamps:
  createdAt?: string;  // ISO date string
  updatedAt?: string;  // ISO date string
};
