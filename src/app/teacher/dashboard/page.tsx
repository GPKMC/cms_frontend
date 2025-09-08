"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  BookOpenCheck, 
  Users, 
  ListChecks, 
  Sparkles,
  Calendar,
  Clock,
  Bell,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Save,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Coffee,
  Star,
  Activity,
  BookOpen
} from "lucide-react";
import { useUser } from "./teacherContext";

type ItemType = "assignment" | "groupAssignment" | "question" | "quiz";

type ItemRow = {
  id: string;
  type: ItemType;
  title: string;
  courseInstanceId: string | null;
  dueAt?: string | null;
};

type Holiday = {
  name: string;
  description: string;
  date: string;
  type: string[];
};

type CourseInstance = {
  _id: string;
  course: { name: string };
  studentCount: number;
};

const TYPE_LABEL: Record<ItemType, string> = {
  assignment: "Assignment",
  groupAssignment: "Group Assignment",
  question: "Question",
  quiz: "Quiz",
};

const TYPE_CONFIG: Record<ItemType, { icon: React.ComponentType<any>; color: string; bgColor: string }> = {
  assignment: { icon: BookOpenCheck, color: "text-blue-600", bgColor: "bg-blue-100" },
  groupAssignment: { icon: Users, color: "text-green-600", bgColor: "bg-green-100" },
  question: { icon: ListChecks, color: "text-purple-600", bgColor: "bg-purple-100" },
  quiz: { icon: Sparkles, color: "text-yellow-600", bgColor: "bg-yellow-100" },
};

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "";

const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return { greeting: "Good Night", icon: Moon, color: "from-indigo-600 to-purple-600" };
  if (hour < 12) return { greeting: "Good Morning", icon: Sunrise, color: "from-orange-500 to-pink-500" };
  if (hour < 17) return { greeting: "Good Afternoon", icon: Sun, color: "from-yellow-500 to-orange-500" };
  if (hour < 21) return { greeting: "Good Evening", icon: Sunset, color: "from-orange-600 to-red-500" };
  return { greeting: "Good Night", icon: Moon, color: "from-indigo-600 to-purple-600" };
};

// Mock schedule
const mockSchedule = [
  { subject: "Advanced Mathematics", time: "10:00 AM", room: "Room 101", status: "upcoming", color: "bg-blue-500" },
  { subject: "Physics Lab", time: "01:00 PM", room: "Lab 205", status: "current", color: "bg-green-500" },
  { subject: "English Literature", time: "03:00 PM", room: "Room 303", status: "upcoming", color: "bg-purple-500" },
];

export default function TeacherDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const teacherId = (user as any)?._id || (user as any)?.id;

  const [items, setItems] = useState<ItemRow[]>([]); // 5 recent assignments
  const [allItems, setAllItems] = useState<ItemRow[]>([]); // all assignments
  const [courses, setCourses] = useState<CourseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState(false);

  const getToken = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher"))) || "";

  const fetchAssignments = async () => {
    if (!teacherId || !API) return;
    setLoading(true);
    const token = getToken();

    try {
      const res = await fetch(`${API}/overallAssignment/teacher/${teacherId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      const sortedItems = (data.items || []).sort((a: any, b: any) => {
        const dateA = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const dateB = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return dateA - dateB;
      });

      // Only keep items from courses teacher teaches
      const teacherCourseIds = courses.map(c => c._id);
      const filteredItems = sortedItems.filter((item: any) => teacherCourseIds.includes(item.courseInstanceId));

      setAllItems(filteredItems);          // store all assignments
      setItems(filteredItems.slice(0, 5)); // show only 5 recent
    } catch (e) {
      console.error("Failed to fetch assignments", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    if (!teacherId || !API) return;
    const token = getToken();
    try {
      const res = await fetch(`${API}/teacher-routes/my-course-instances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCourses(data.courseInstances || []);
    } catch (e) {
      console.error("Failed to fetch courses", e);
    }
  };

  const fetchCalendar = async () => {
    try {
      const res = await fetch(`${API}/calendar`);
      const data = await res.json();
      setHolidays(data.holidays || []);
    } catch (e) {
      console.error("Failed to fetch calendar", e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    const savedNote = localStorage.getItem("dailyNote") || "";
    setNote(savedNote);
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [teacherId]);

  useEffect(() => {
    fetchAssignments();
    fetchCalendar();
  }, [courses]);

  const saveNote = () => {
    localStorage.setItem("dailyNote", note);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2000);
  };

  const today = new Date().toISOString().split("T")[0];
  const todayEvents = holidays.filter((h) => h.date === today);
  const { greeting, icon: GreetingIcon, color } = getTimeBasedGreeting();

  const stats = [
    { label: "Active Courses", value: courses.length.toString(), icon: BookOpen, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Total Students", value: courses.reduce((sum, c) => sum + (c.studentCount || 0), 0).toString(), icon: Users, color: "text-green-600", bg: "bg-green-100" },
    { label: "Total Assignments", value: allItems.length.toString(), icon: ListChecks, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className={`bg-gradient-to-r ${color} text-white p-8 rounded-3xl shadow-lg relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
            <GreetingIcon className="w-full h-full" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <GreetingIcon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">{greeting}, {user?.username || 'Teacher'}!</h1>
                <p className="text-white/90 mt-2 text-lg">Ready to make today amazing? Here's your dashboard.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${stat.bg} rounded-lg`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-white/80 text-sm">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Today's Schedule */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-8">
            {/* Schedule Code */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Today's Schedule</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="space-y-4">
              {mockSchedule.map((item, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-xl border-l-4 ${item.status === 'current' ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-300'} hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.subject}</h3>
                        <p className="text-sm text-gray-600">{item.room}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{item.time}</p>
                      {item.status === 'current' && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                          <Activity className="h-3 w-3" />
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              onClick={() => router.push("/teacher/dashboard/schedule")}
            >
              View Full Schedule
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {/* Assignments Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6">
            {/* Assignments Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <BookOpenCheck className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Recent Assignments</h2>
              </div>
              {/* <Bell className="h-5 w-5 text-gray-400" /> */}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <BookOpenCheck className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500">No assignments found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const config = TYPE_CONFIG[item.type];
                  const Icon = config?.icon;
                  const dueDate = item.dueAt
                    ? new Date(item.dueAt).toLocaleDateString()
                    : "No due date";
                  const isOverdue = item.dueAt && new Date(item.dueAt) < new Date();
                  
                  return (
                    <div
                      key={item.id}
                      className="group p-4 border border-gray-200 rounded-xl hover:shadow-lg hover:border-blue-200 transition-all duration-200 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/teacher/dashboard/class/${item.courseInstanceId}/Details/${item.type}/${item.id}`
                        )
                      }
                    >
                      <div className="flex items-center gap-3">
                        {Icon && (
                          <div className={`p-2 ${config.bgColor} rounded-lg group-hover:scale-110 transition-transform`}>
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${config.bgColor} ${config.color} font-medium`}>
                              {TYPE_LABEL[item.type]}
                            </span>
                            <span className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                              Due: {dueDate}
                            </span>
                          </div>
                        </div>
                        {isOverdue && <AlertCircle className="h-4 w-4 text-red-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              className="mt-6 w-full flex items-center justify-center gap-2 text-blue-600 border-2 border-blue-600 px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors font-semibold"
              onClick={() => router.push("/teacher/dashboard/assignments")}
            >
              View All Assignments
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Daily Notes */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-xl">
                  <Coffee className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Daily Notes</h2>
              </div>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString(undefined, { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            
            <textarea
              placeholder="What's on your mind today? Jot down important reminders, observations, or reflections..."
              className="w-full border border-gray-300 rounded-xl p-4 h-36 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white/50 backdrop-blur-sm transition-all"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            
            <button
              className={`mt-4 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                savedNote
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              onClick={saveNote}
            >
              {savedNote ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Note Saved!
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Note
                </>
              )}
            </button>
          </div>

          {/* Calendar & Today's Events */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-100 rounded-xl">
                <Star className="h-6 w-6 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Today</h2>
            </div>
            
            <div className="text-center bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 mb-6">
              <p className="text-5xl font-bold text-gray-900 mb-2">{new Date().getDate()}</p>
              <p className="text-gray-600 font-medium">
                {new Date().toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {new Date().toLocaleString("default", { weekday: "long" })}
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Today's Events
              </h3>
              
              {loadingCalendar ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-gray-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : todayEvents.length === 0 ? (
                <div className="text-center py-4">
                  <div className="p-3 bg-gray-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No special events today</p>
                  <p className="text-gray-400 text-xs mt-1">Have a productive day!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayEvents.map((event, idx) => (
                    <div key={idx} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-gray-900">{event.name}</p>
                          <p className="text-sm text-gray-600">{event.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
