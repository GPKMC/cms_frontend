"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useUser } from "../teacherContext";
import { 
  GraduationCap, 
  Search,
  Filter,
  Plus,
  Users,
  Calendar,
  BookOpen,
  TrendingUp,
  Star,
  ChevronRight,
  Grid3X3,
  List,
  SortDesc
} from "lucide-react";

interface CourseInstance {
  _id: string;
  course: {
    name: string;
    semesterOrYear?: {
      name?: string;
      semesterNumber?: number;
      yearNumber?: number;
    };
  };
  batch: {
    batchname: string;
  };
  teacher: {
    _id: string;
    name: string;
    email?: string;
  };
  studentCount: number;
}

interface EnhancedCourseCardProps {
  title: string;
  semesterOrYear: string;
  batchName: string;
  teacherName: string;
  studentCount: number;
  onClick: () => void;
}

const EnhancedCourseCard = ({ 
  title, 
  semesterOrYear, 
  batchName, 
  teacherName, 
  studentCount, 
  onClick 
}: EnhancedCourseCardProps) => {
  return (
    <div 
      onClick={onClick}
      className="group relative bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Gradient Header */}
      <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
      
      {/* Card Content */}
      <div className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl group-hover:from-blue-100 group-hover:to-purple-100 transition-colors duration-300">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors duration-200 line-clamp-2">
                {title}
              </h3>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
        </div>

        {/* Info Grid */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{semesterOrYear}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <GraduationCap className="h-4 w-4" />
              <span>{batchName}</span>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-100 rounded-lg">
              <Users className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-sm">
              <span className="font-semibold text-gray-900">{studentCount}</span>
              <span className="text-gray-500 ml-1">students</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-400 fill-current" />
            <span className="text-sm font-medium text-gray-700">4.8</span>
          </div>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      </div>
    </div>
  );
};

export default function MyCourseInstances() {
  const router = useRouter();
  const { user } = useUser();
  const [instances, setInstances] = useState<CourseInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<CourseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher")
      : null;

  useEffect(() => {
    const fetchCourseInstances = async () => {
      if (!user?.id) return;
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/teacher-routes/my-course-instances`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const courseInstances = res.data.courseInstances || [];
        setInstances(courseInstances);
        setFilteredInstances(courseInstances);
      } catch (error: any) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourseInstances();
  }, [user, token]);

  useEffect(() => {
    let filtered = instances;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(instance =>
        instance.course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instance.batch.batchname.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Semester/Year filter
    if (selectedFilter !== "all") {
      filtered = filtered.filter(instance => {
        if (selectedFilter === "semester") {
          return instance.course.semesterOrYear?.semesterNumber;
        } else if (selectedFilter === "year") {
          return instance.course.semesterOrYear?.yearNumber;
        }
        return true;
      });
    }
    
    setFilteredInstances(filtered);
  }, [searchTerm, selectedFilter, instances]);

  const totalStudents = instances.reduce((sum, instance) => sum + instance.studentCount, 0);

  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-2 bg-gray-200"></div>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-200 rounded-xl"></div>
            <div className="h-6 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="w-5 h-5 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-3 mb-6">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-16"></div>
          <div className="h-4 bg-gray-200 rounded w-12"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto p-6">
        {/* Enhanced Header Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                <GraduationCap className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">My Courses</h1>
                <div className="flex items-center gap-6 text-gray-600">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">{instances.length} courses</span>
                  </div>
                  {/* <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-500" />
                    <span className="font-medium">{totalStudents} total students</span>
                  </div> */}
                </div>
              </div>
            </div>
            
            {/* <button className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              <Plus className="h-5 w-5" />
              <span className="font-semibold">Request New Course</span>
            </button> */}
          </div>
        </div>

        {/* Enhanced Search and Filter Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search courses, batches, or topics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 min-w-[140px]"
                >
                  <option value="all">All Courses</option>
                  <option value="semester">Semester Courses</option>
                  <option value="year">Year Courses</option>
                </select>
              </div>
              
              <div className="flex items-center bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === "grid" 
                      ? "bg-white shadow-sm text-blue-600" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === "list" 
                      ? "bg-white shadow-sm text-blue-600" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className={`grid gap-6 ${
            viewMode === "grid" 
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
              : "grid-cols-1"
          }`}>
            {[...Array(8)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredInstances.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-200 p-16">
            <div className="text-center">
              <div className="p-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <GraduationCap className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {searchTerm || selectedFilter !== "all" ? "No courses found" : "No courses assigned"}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                {searchTerm || selectedFilter !== "all" 
                  ? "Try adjusting your search or filter criteria to find what you're looking for" 
                  : "You haven't been assigned any courses yet. Contact your administrator to get started with your teaching journey."
                }
              </p>
              {searchTerm || selectedFilter !== "all" ? (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedFilter("all");
                  }}
                  className="px-8 py-3 text-blue-600 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition-all duration-200 font-semibold"
                >
                  Clear All Filters
                </button>
              ) : (
                <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold">
                  Request Your First Course
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Showing <span className="font-semibold text-blue-600">{filteredInstances.length}</span> of <span className="font-semibold">{instances.length}</span> courses
              </p>
              <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
                <SortDesc className="h-4 w-4" />
                <span className="text-sm">Sort by</span>
              </button>
            </div>
            
            <div className={`grid gap-6 ${
              viewMode === "grid" 
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                : "grid-cols-1 max-w-4xl mx-auto"
            }`}>
              {filteredInstances.map((item) => (
                <EnhancedCourseCard
                  key={item._id}
                  title={item.course.name}
                  semesterOrYear={
                    item.course.semesterOrYear?.semesterNumber
                      ? `Semester ${item.course.semesterOrYear.semesterNumber}`
                      : item.course.semesterOrYear?.yearNumber
                      ? `Year ${item.course.semesterOrYear.yearNumber}`
                      : item.course.semesterOrYear?.name || "No Semester"
                  }
                  batchName={item.batch.batchname}
                  teacherName={item.teacher.name}
                  studentCount={item.studentCount}
                  onClick={() => router.push(`/teacher/dashboard/class/${item._id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}