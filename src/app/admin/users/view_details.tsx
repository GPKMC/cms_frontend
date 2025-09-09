"use client";
import React, { useEffect, useState } from "react";
import { User as BaseUser } from "../types/type.user"; // adjust path if needed
import {
  Eye,
  X,
  User as UserIcon,
  Mail,
  Shield,
  Calendar,
  CheckCircle,
  XCircle,
  Users,
} from "lucide-react";

type Batch = {
  _id: string;
  batchname: string;
  faculty?: string;
  year?: number;
};

// Extend the imported User type to include batch
type User = BaseUser & { batch?: Batch | string };

type ViewUserModalProps = {
  userId: string;
  onClose: () => void;
};

const ViewUserModal: React.FC<ViewUserModalProps> = ({ userId, onClose }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token_admin");
        if (!token) throw new Error("Unauthorized");

        const res = await fetch(`${baseUrl}/user-api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to fetch user");
        }

        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, baseUrl]);

  // Render batch name properly
  const renderBatch = () => {
    if (!user?.batch) return "Not assigned";

    // If batch is populated object
    if (typeof user.batch === "object" && "batchname" in user.batch) {
      return user.batch.batchname;
    }

    // If batch is only an ID string, show placeholder
    return `Batch ID: ${user.batch}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Eye className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white">User Details</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading user details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">Error: {error}</span>
              </div>
            </div>
          )}

          {user && (
            <div className="space-y-6">
              {/* Profile Section */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-3 bg-blue-100 rounded-full">
                  <UserIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">{user.username}</h4>
                  <p className="text-gray-600 capitalize">{user.role}</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Mail className="h-5 w-5 text-gray-500" />
                  <div>
                    <span className="text-sm text-gray-500">Email</span>
                    <p className="font-medium text-gray-900">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Shield className="h-5 w-5 text-gray-500" />
                  <div>
                    <span className="text-sm text-gray-500">Role</span>
                    <p className="font-medium text-gray-900 capitalize">{user.role}</p>
                  </div>
                </div>

                {user.role === "student" && (
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <Users className="h-5 w-5 text-gray-500" />
                    <div>
                      <span className="text-sm text-gray-500">Batch</span>
                      <p className="font-medium text-gray-900">{renderBatch()}</p>
                    </div>
                  </div>
                )}

                {user.googleId && (
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <div className="h-5 w-5 text-gray-500">G</div>
                    <div>
                      <span className="text-sm text-gray-500">Google ID</span>
                      <p className="font-medium text-gray-900">{user.googleId}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-3">Account Status</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    {user.isActive ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span
                      className={`font-medium ${
                        user.isActive ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {user.isVerified ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-orange-500" />
                    )}
                    <span
                      className={`font-medium ${
                        user.isVerified ? "text-green-700" : "text-orange-700"
                      }`}
                    >
                      {user.isVerified ? "Verified" : "Unverified"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-3">Account Information</h5>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Created:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Last Updated:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 rounded-b-xl border-t">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewUserModal;
