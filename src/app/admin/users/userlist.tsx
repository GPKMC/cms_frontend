"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "../types/type.user";
import { Eye, Pencil, Trash2 } from "lucide-react";

const roles = ["all", "student", "teacher", "admin", "superadmin"] as const;
const MIN_LIMIT = 20;

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState<string>("all");
  const [searchInput, setSearchInput] = useState<string>(""); // For input field
  const [search, setSearch] = useState<string>(""); // Actual search param for fetch
  const [limit, setLimit] = useState<number>(MIN_LIMIT);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  // Fetch users when role, search, or limit changes
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (role !== "all") params.append("role", role);
      if (search.trim()) params.append("search", search.trim());
      if (limit !== 0) params.append("limit", limit.toString());

      const url = `${baseUrl}/user-api/users?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch users");

      const data = await response.json();
      setUsers(data.users);
      if (typeof data.totalCount === "number") setTotalCount(data.totalCount);
    } catch (err) {
      setError((err as Error).message);
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [role, search, limit]);

  // Called when Search button is clicked
  const handleSearch = () => {
    setLimit(MIN_LIMIT); // reset pagination on new search
    setSearch(searchInput.trim()); // update actual search param to trigger fetch
  };

  // Reset filters and search input
  const handleCancel = () => {
    setRole("all");
    setSearchInput("");
    setSearch("");
    setLimit(MIN_LIMIT);
  };

  const increaseLimit = () => {
    if (limit === 0) return;
    setLimit(Math.min(totalCount, limit + 10));
  };

  const decreaseLimit = () => {
    if (limit === 0) {
      const newLimit = totalCount - 10;
      setLimit(newLimit < MIN_LIMIT ? MIN_LIMIT : newLimit);
    } else {
      const newLimit = limit - 10;
      setLimit(newLimit < MIN_LIMIT ? MIN_LIMIT : newLimit);
    }
  };

  const showFixedLimit = (fixedLimit: number) => {
    if (totalCount <= fixedLimit) {
      setLimit(0); // Show all if totalCount <= fixedLimit
    } else {
      setLimit(fixedLimit < MIN_LIMIT ? MIN_LIMIT : fixedLimit);
    }
  };

  const showAll = () => setLimit(0);
  const showMin = () => setLimit(MIN_LIMIT);

  const showCancelButton = searchInput.trim() !== "";

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">User List</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="font-medium">Filter by role:</label>
          <select
            className="border rounded px-2 py-1"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setLimit(MIN_LIMIT);
            }}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search by username/email"
            className="border rounded px-2 py-1"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          <button
            onClick={handleSearch}
            className="bg-primary text-white px-3 py-1 rounded hover-slide"
          >
            Search
          </button>

          {showCancelButton && (
            <button
              onClick={handleCancel}
              className="border px-3 py-1 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
          )}
        </div>

        <button
          className="border-2 bg-primary px-4 py-2 rounded border-primary hover-slide text-white"
          onClick={() => router.push("/admin/users/userform")}
        >
          Add User
        </button>
      </div>

      {/* Loading & Error */}
      {loading && <p className="text-blue-600 mb-4">Loading...</p>}
      {error && <p className="text-red-600 mb-4">Error: {error}</p>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-4 py-2 text-left">S.N.</th>
              <th className="border px-4 py-2 text-left">Username</th>
              <th className="border px-4 py-2 text-left">Role</th>
              <th className="border px-4 py-2 text-left">Email</th>
              <th className="border px-4 py-2 text-left">Google ID</th>
              <th className="border px-4 py-2 text-left">Active</th>
              <th className="border px-4 py-2 text-left">Verified</th>
              <th className="border px-4 py-2 text-left">Created At</th>
              <th className="border px-4 py-2 text-left">Updated At</th>
              <th className="border px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-4">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user, index) => (
                <tr
                  key={user.email}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border px-4 py-2">{index + 1}</td>
                  <td className="border px-4 py-2">{user.username}</td>
                  <td className="border px-4 py-2">{user.role}</td>
                  <td className="border px-4 py-2">{user.email}</td>
                  <td className="border px-4 py-2">{user.googleId ?? "-"}</td>
                  <td className="border px-4 py-2">
                    {user.isActive ? (
                      <span className="inline-block bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold select-none">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold select-none">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="border px-4 py-2">
                    {user.isVerified ? (
                      <span className="inline-block bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold select-none">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-block bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold select-none">
                        Unverified
                      </span>
                    )}
                  </td>
                  {/* <td className="border px-4 py-2">{user.isVerified ? "Yes" : "No"}</td> */}
                  <td className="border px-4 py-2">
                    {new Date(user.createdAt ?? "").toLocaleString()}
                  </td>
                  <td className="border px-4 py-2">
                    {new Date(user.updatedAt ?? "").toLocaleString()}
                  </td>
                  <td className="border px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={() => alert(`View user: ${user.username}`)}
                        title="View"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        onClick={() => alert(`Edit user: ${user.username}`)}
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                        onClick={() => alert(`Delete user: ${user.username}`)}
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex justify-end flex-wrap gap-2 items-center">
        <div className="mr-4 font-semibold whitespace-nowrap">
          Showing {limit === 0 ? totalCount : Math.min(limit, totalCount)} /{" "}
          {totalCount} users
        </div>

        <button
          onClick={showMin}
          disabled={loading || limit === MIN_LIMIT}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Show Min
        </button>
        <button
          onClick={decreaseLimit}
          disabled={loading || limit === MIN_LIMIT}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          −10
        </button>
        <button
          onClick={increaseLimit}
          disabled={loading || (limit !== 0 && limit >= totalCount)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          +10
        </button>
        <button
          onClick={() => showFixedLimit(50)}
          disabled={
            loading || limit === 50 || (limit === 0 && totalCount <= 50)
          }
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Show 50
        </button>
        <button
          onClick={() => showFixedLimit(100)}
          disabled={
            loading || limit === 100 || (limit === 0 && totalCount <= 100)
          }
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Show 100
        </button>
        <button
          onClick={showAll}
          disabled={loading || limit === 0}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Show All
        </button>
      </div>
    </div>
  );
};

export default UserList;
