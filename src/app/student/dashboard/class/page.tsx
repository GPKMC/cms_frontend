"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Calendar, Trophy, Play, Lock, CheckCircle } from "lucide-react";
import axios from "axios";

type SemesterOrYear = {
  _id: string;
  name: string;
  unlocked: boolean;
  semesterNumber?: number;
  yearNumber?: number;
};

type Faculty = {
  code: string;
  name: string;
  type: "semester" | "yearly";
  programLevel: string;
  total: number;
};

type Batch = {
  batchname: string;
  current: number;
};

type ApiResponse = {
  batch: Batch;
  faculty: Faculty;
  semestersOrYears: SemesterOrYear[];
};

export default function MyBatchSemesters() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token =
      localStorage.getItem("token_student") ||
      sessionStorage.getItem("token_student");
    if (!token) {
      alert("No student token found. Please login.");
      setLoading(false);
      return;
    }
    const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;
    axios
      .get(`${baseurl}/student/my-batch-semesters`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        alert(
          "Error loading semesters: " +
            (err.response?.data?.message || err.message)
        );
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your academic journey...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-white">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-600 text-lg">No academic data found.</p>
        </div>
      </div>
    );
  }

  const { batch, faculty, semestersOrYears } = data;
  const current = batch.current;
  const total = faculty.total;

  // Count logic
  const unlocked = semestersOrYears.filter((s) => s.unlocked).length;
  const completed = semestersOrYears.filter(
    (s) =>
      (faculty.type === "semester" && (s.semesterNumber ?? 0) < current) ||
      (faculty.type === "yearly" && (s.yearNumber ?? 0) < current)
  ).length;
  const running = semestersOrYears.find(
    (s) =>
      (faculty.type === "semester" && (s.semesterNumber ?? 0) === current) ||
      (faculty.type === "yearly" && (s.yearNumber ?? 0) === current)
  );
  const locked = total - unlocked;

  const progressPercentage = (completed / total) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-indigo-100 p-3 rounded-xl">
              <GraduationCap className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {faculty.name}
              </h1>
              <p className="text-gray-600 text-lg">
                {faculty.code} • {faculty.programLevel.toUpperCase()} • {faculty.type}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Academic Progress</span>
              <span className="text-sm font-medium text-indigo-600">{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">Batch</p>
                  <p className="text-lg font-bold text-blue-800">{batch.batchname}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">Completed</p>
                  <p className="text-lg font-bold text-green-800">{completed}/{total}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center gap-3">
                <Play className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-600 font-medium">Current</p>
                  <p className="text-lg font-bold text-purple-800">{running ? running.name : "None"}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm text-orange-600 font-medium">Locked</p>
                  <p className="text-lg font-bold text-orange-800">{locked}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Semesters/Years Grid */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Trophy className="h-6 w-6 text-indigo-600" />
            Academic Timeline
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {semestersOrYears.map((item) => {
              const isRunning =
                (faculty.type === "semester" && (item.semesterNumber ?? 0) === current) ||
                (faculty.type === "yearly" && (item.yearNumber ?? 0) === current);
              const isCompleted =
                (faculty.type === "semester" && (item.semesterNumber ?? 0) < current) ||
                (faculty.type === "yearly" && (item.yearNumber ?? 0) < current);

              let cardStyle, iconElement, statusText;

              if (isRunning) {
                cardStyle = "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg transform scale-105 hover:scale-110";
                iconElement = <Play className="h-6 w-6" />;
                statusText = "In Progress";
              } else if (isCompleted) {
                cardStyle = "bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl";
                iconElement = <CheckCircle className="h-6 w-6" />;
                statusText = "Completed";
              } else if (item.unlocked) {
                cardStyle = "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg hover:shadow-xl hover:scale-105";
                iconElement = <Calendar className="h-6 w-6" />;
                statusText = "Available";
              } else {
                cardStyle = "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-600 opacity-75";
                iconElement = <Lock className="h-6 w-6" />;
                statusText = "Locked";
              }

              // Map 'yearly' type to 'year' for the URL
              const urlType = faculty.type === "yearly" ? "year" : "semester";
              const url = item.unlocked
                ? `/student/dashboard/class/${urlType}/${item._id}`
                : "#";

              return (
                <Link
                  key={item._id}
                  href={url}
                  className={item.unlocked ? "" : "pointer-events-none opacity-60"}
                >
                  <div
                    className={`p-6 rounded-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 ${cardStyle}`}
                  >
                    <div className="text-center">
                      <div className="flex justify-center mb-3">
                        {iconElement}
                      </div>
                      <h3 className="font-bold text-lg mb-2">{item.name}</h3>
                      <p className="text-sm opacity-90">{statusText}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Achievement Section */}
        <div className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-yellow-300" />
            <h3 className="text-2xl font-bold mb-2">Academic Achievement</h3>
            <p className="text-indigo-100 text-lg">
              You've completed {completed} out of {total} {faculty.type === "semester" ? "semesters" : "years"}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white bg-opacity-20 rounded-full px-6 py-2">
              <span className="text-lg font-semibold">{Math.round(progressPercentage)}% Complete</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
