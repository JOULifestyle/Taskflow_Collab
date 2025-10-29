import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useTasks } from "../hooks/useTasks";
import { useLists } from "../hooks/useLists";
import { useCollaborativeTasks } from "../hooks/useCollaborativeTasks";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketProvider";
import { useNotificationSetup } from "../hooks/useNotificationSetup";
import NotificationBanner from "../components/NotificationBanner";
import IOSInstallBanner from "../components/IOSInstallBanner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MembersModal from "../components/MembersModal";
import ShareList from "../components/ShareList";



const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Format ISO string for display in task list
const formatDueDate = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return d.toLocaleString(undefined, options); // uses user's locale
};

// Format date to datetime-local for inputs
const formatDateForInput = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

function TodoPage()  {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { lists, currentList, selectList, createList, updateListName, deleteList, loading: listsLoading } = useLists();
  const { tasks, addTask, toggleTask, deleteTask, startEdit, saveEdit, setTasks } =
    useTasks(currentList?._id);
  const {
    showNotificationBanner,
    showIOSInstallBanner,
    requestNotificationPermission,
    dismissNotificationBanner,
    dismissInstallBanner
  } = useNotificationSetup();

  // Determine user's role for current list
  const userRole = currentList?.members?.find(m => m.userId === user?._id)?.role || 'viewer';
  const isViewer = userRole === 'viewer';
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("General");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [repeat, setRepeat] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [showMembers, setShowMembers] = useState(false);
  const [showShare, setShowShare] = useState(false);
    const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const stopEdit = () => {
  setTasks(prev => prev.map(t => ({ ...t, editing: false })));
};
useCollaborativeTasks(setTasks);

//  Join/leave list rooms + listen for list:shared updates
  useEffect(() => {
  if (!currentList?._id || !socket) return;

  socket.emit("join-list", currentList._id);

  socket.on("list:shared", (data) => {
    toast.success(`User added/updated: ${data.userId} as ${data.role}`);
    
  });

  return () => {
    socket.emit("leave-list", currentList._id);
    socket.off("list:shared");
  };
}, [currentList?._id, socket]);

useEffect(() => {
  const registerPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log('Push notifications are not supported in this browser/device');
      return;
    }

    const swReg = await navigator.serviceWorker.register("/service-worker.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    // Get public key from backend
    const res = await fetch(`${API_URL}/vapid`);
    const data = await res.json();
    const publicKey = data.publicKey;

    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(subscription)
    });
  };

  if (user) registerPush();
}, [user]);

// helper
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
};

  // PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setDeferredPrompt(null);
      setInstallable(false);
      toast.success("✅ App installed successfully!");
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallable(false);
    if (outcome === "accepted") toast.success("Installation accepted!");
  };

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor));


  const handleDragEnd = async (event) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  // Check which list the dragged item belongs to
  const inRecurring = recurringTasks.some((t) => t._id === active.id);
  const list = inRecurring ? recurringTasks : nonRecurringTasks;

  const oldIndex = list.findIndex((t) => t._id === active.id);
  const newIndex = list.findIndex((t) => t._id === over.id);

  if (oldIndex === -1 || newIndex === -1) return; // invalid drag

  // Reorder only that list
  const newList = arrayMove(list, oldIndex, newIndex);

  // Merge both lists back into one full tasks array
  const newTasks = inRecurring
    ? [...nonRecurringTasks, ...newList]
    : [...newList, ...recurringTasks];

  setTasks(newTasks);
  localStorage.setItem(`tasks-${currentList?._id}`, JSON.stringify(newTasks));

  // Sync with backend if online
  if (!navigator.onLine) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/lists/${currentList?._id}/tasks/reorder`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
  orderedIds: newTasks
    .filter((t) => !t._id.startsWith("temp-"))
    .map((t) => t._id),
}),
    });

    if (!res.ok) throw new Error("Failed to save order");

    const updatedTasks = await res.json();
    setTasks(updatedTasks);
    localStorage.setItem(`tasks-${currentList?._id}`, JSON.stringify(updatedTasks));
  } catch (err) {
    toast.error("Failed to save task order");
    console.error(err);
  }
};


  const getDueDateColor = (due) => {
    const daysLeft = Math.ceil((new Date(due) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return "text-red-600";
    if (daysLeft === 0) return "text-yellow-500";
    return "text-green-600";
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "border-l-4 border-red-500";
      case "medium": return "border-l-4 border-yellow-400";
      case "low": return "border-l-4 border-green-400";
      default: return "";
    }
  };

  const filteredTasks = tasks
    .filter(t => filter === "completed" ? t.completed : filter === "incomplete" ? !t.completed : true)
    .filter(t => (t.text || "").toLowerCase().includes(search.toLowerCase()))
    .filter(t => categoryFilter === "all" ? true : t.category === categoryFilter)
    .filter(t => severityFilter === "all" ? true : t.priority === severityFilter);

  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;

  const recurringTasks = filteredTasks.filter(t => t.repeat);
const nonRecurringTasks = filteredTasks.filter(t => !t.repeat);

  
  // Show Lists First
 
  // If no list selected → show the list catalog


if (!currentList) {


  const handleEdit = async (listId) => {
    if (!editValue.trim()) return;
    await updateListName(listId, editValue); 
    setEditingId(null);
    setEditValue("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Install PWA */}
        {installable && (
          <button
            onClick={handleInstallClick}
            className="mb-4 sm:mb-6 w-full flex items-center justify-center gap-2 bg-green-600 dark:bg-green-700 text-white py-2 sm:py-3 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 transition font-medium shadow-lg text-sm sm:text-base"
          >
            📲 Install App
          </button>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 sm:p-6 w-full border border-gray-100 dark:border-gray-700">
          <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-white text-center">
            📋 My Lists
          </h1>

          {listsLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-300">Loading lists...</span>
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-gray-500 dark:text-gray-400 mb-6">No lists yet. Create your first list below!</p>
            </div>
          ) : (
            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              {lists.map((list) => (
                <li
                  key={list._id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 sm:p-4 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  {/* Editable List Name */}
                  {editingId === list._id ? (
                    <div className="flex gap-1 sm:gap-2">
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleEdit(list._id)}
                        onKeyDown={(e) => e.key === "Enter" && handleEdit(list._id)}
                        autoFocus
                        className="flex-1 px-2 sm:px-3 py-1 sm:py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="List name"
                      />
                      <button
                        onClick={() => handleEdit(list._id)}
                        className="px-2 sm:px-3 py-1 sm:py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span
                        className="flex-1 cursor-pointer font-medium text-sm sm:text-base text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate pr-2"
                        onClick={() => selectList(list)}
                        title={list.name}
                      >
                        {list.name}
                      </span>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingId(list._id);
                            setEditValue(list.name);
                          }}
                          className="p-1 sm:p-2 text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors text-sm sm:text-base"
                          title="Edit list name"
                        >
                          ✏️
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm(`Delete list "${list.name}"?`)) {
                              deleteList(list._id);
                            }
                          }}
                          className="p-1 sm:p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors text-sm sm:text-base"
                          title="Delete list"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add List Form */}
          <form
            className="flex flex-col sm:flex-row gap-2 sm:gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const name = formData.get("listName");
              if (name?.trim()) {
                createList(name.trim());
                e.target.reset();
              }
            }}
          >
            <input
              type="text"
              name="listName"
              placeholder="Enter new list name"
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              required
            />
            <button
              type="submit"
              className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base"
            >
              <span className="text-base sm:text-lg">➕</span>
              <span className="hidden sm:inline">Add</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 sm:mt-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 TaskFlow. Organize your world.</p>
        </div>
      </div>
    </div>
  );
}

  
  // Tasks View
 

  return (
    <>
      <Toaster />
      {showNotificationBanner && (
        <NotificationBanner
          onEnable={requestNotificationPermission}
          onDismiss={dismissNotificationBanner}
        />
      )}
      {showIOSInstallBanner && (
        <IOSInstallBanner onDismiss={dismissInstallBanner} />
      )}

      {false ? (
        <div className="flex justify-center items-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2 sm:p-4 lg:p-6 rounded-xl shadow-xl w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto flex flex-col justify-between min-h-[90vh]">
          <div>
            {/* Title & Back */}
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2 text-center break-words">📅 {currentList.name}</h1>
            <p className="text-center text-xs sm:text-sm text-gray-500 mb-2 sm:mb-4">
              <span className="hidden sm:inline">List ID: </span><span className="font-mono break-all">{currentList._id.slice(-8)}</span>
            </p>
            <button
              onClick={() => selectList(null)}
              className="mb-2 sm:mb-4 text-xs sm:text-sm text-blue-500 underline"
            >
              ← Back to Lists
            </button>

            {/* New buttons */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
              <button
                onClick={() => {
                  if (isViewer) {
                    alert("You are on viewer mode. You cannot manage members.");
                    return;
                  }
                  setShowMembers(true);
                }}
                disabled={isViewer}
                className={`px-2 sm:px-3 py-1 sm:py-2 rounded text-xs sm:text-sm ${
                  isViewer
                    ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                Manage Members
              </button>
              <button
                onClick={() => {
                  if (isViewer) {
                    alert("You are on viewer mode. You cannot share the list.");
                    return;
                  }
                  setShowShare((prev) => !prev);
                }}
                disabled={isViewer}
                className={`px-2 sm:px-3 py-1 sm:py-2 rounded text-xs sm:text-sm ${
                  isViewer
                    ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {showShare ? "Close Share" : "Share List"}
              </button>
            </div>

            {/* Inline ShareList */}
            {showShare && (
              <div className="mb-4 sm:mb-6">
                <ShareList listId={currentList._id} token={localStorage.getItem("token")} />
              </div>
            )}

            {/* Members Modal */}
            {showMembers && (
              <MembersModal
                list={currentList}
                token={localStorage.getItem("token")}
                onClose={() => setShowMembers(false)}
                currentUser={user}
              />
            )}
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 mb-2 sm:mb-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs sm:text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded p-1 sm:p-2"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs sm:text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded p-1 sm:p-2"
            >
              <option value="all">All Categories</option>
              <option value="General">General</option>
              <option value="Work">Work</option>
              <option value="Personal">Personal</option>
              <option value="Shopping">Shopping</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs sm:text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded p-1 sm:p-2"
            >
              <option value="all">All Severities</option>
              <option value="low">Low 🟢</option>
              <option value="medium">Medium 🟡</option>
              <option value="high">High 🔴</option>
            </select>

          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-300 dark:bg-gray-600 h-2 sm:h-3 rounded-full overflow-hidden mb-2 sm:mb-4">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(completedTasks / totalTasks) * 100 || 0}%` }}
            />
          </div>

          {/* Add Task Form */}
          <div className="mb-2 sm:mb-4">
            <button
              onClick={() => {
                if (isViewer) {
                  alert("You are on viewer mode. You cannot add tasks.");
                  return;
                }
                setShowForm(!showForm);
              }}
              disabled={isViewer}
              className={`w-full px-3 sm:px-4 py-1 sm:py-2 rounded-md transition-colors text-sm sm:text-base ${
                isViewer
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
              }`}
            >
              {showForm ? "Undo" : "Add Task"}
            </button>

            {showForm && (
              <div className="flex flex-col gap-3 mt-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="New task"
                  className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <div className="relative">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Due Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:dark:opacity-50"
                    step="60"
                  />
                </div>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="low">Low 🟢</option>
                  <option value="medium">Medium 🟡</option>
                  <option value="high">High 🔴</option>
                </select>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="General">General</option>
                  <option value="Work">Work</option>
                  <option value="Personal">Personal</option>
                  <option value="Shopping">Shopping</option>
                </select>
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  className="p-2 border rounded-md"
                >
                  <option value="">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                <button
                  onClick={() => {
                    if (isViewer) {
                      alert("You are on viewer mode. You cannot add tasks.");
                      return;
                    }
                    addTask(input, dueDate, priority, category, repeat);
                    setInput("");
                    setDueDate("");
                    setPriority("medium");
                    setCategory("General");
                    setRepeat("");
                    setShowForm(false);
                  }}
                  disabled={isViewer}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    isViewer
                      ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                      : "bg-green-600 text-white hover:bg-green-700 active:bg-green-800"
                  }`}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search tasks..."
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md mb-4"
          />

          {/* Drag and Drop Tasks */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {/* Non-recurring tasks */}
  <h2 className="font-bold text-sm sm:text-base lg:text-lg mt-2 sm:mt-4 mb-2">📝 Tasks</h2>
<SortableContext
  items={nonRecurringTasks.map((t) => t._id)}
  strategy={verticalListSortingStrategy}
>
  <ul className="space-y-2 sm:space-y-3">
    {nonRecurringTasks.map((task, index) => (
      <SortableTask
        key={task._id}
        id={task._id}
        task={task}
        index={index}
        toggleTask={() => toggleTask(task._id)}
        deleteTask={() => deleteTask(task._id)}
        startEdit={() => startEdit(task._id)}
        onSave={(updatedFields) => saveEdit(task._id, updatedFields)}
        getDueDateColor={getDueDateColor}
        getPriorityColor={getPriorityColor}
        stopEdit={stopEdit}
        isViewer={isViewer}
      />
    ))}
  </ul>
</SortableContext>

{/* Divider */}
<hr className="my-4 sm:my-6 border-gray-400 dark:border-gray-600" />

{/* Recurring tasks */}
<h2 className="font-bold text-sm sm:text-base lg:text-lg mb-2">🔁 Recurring Tasks</h2>
<SortableContext
  items={recurringTasks.map((t) => t._id)}
  strategy={verticalListSortingStrategy}
>
  <ul className="space-y-2 sm:space-y-3">
    {recurringTasks.map((task, index) => (
      <SortableTask
        key={task._id}
        id={task._id}
        task={task}
        index={index}
        toggleTask={() => toggleTask(task._id)}
        deleteTask={() => deleteTask(task._id)}
        startEdit={() => startEdit(task._id)}
        onSave={(updatedFields) => saveEdit(task._id, updatedFields)}
        getDueDateColor={getDueDateColor}
        getPriorityColor={getPriorityColor}
        stopEdit={stopEdit}
        isViewer={isViewer}
      />
    ))}
  </ul>
</SortableContext>
          </DndContext>
        </div>

        <footer className="text-center mt-4 sm:mt-6 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          © 2025 joulifestyle
        </footer>
      </div>
      )}
    </>
  );
}

/* Sortable Task Item */
function SortableTask({ id, task, toggleTask, deleteTask, startEdit, onSave, getDueDateColor, getPriorityColor, stopEdit, isViewer }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // Helper to format lastCompletedAt
  const formatLastCompleted = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleString();
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex flex-col sm:flex-row justify-between items-start sm:items-center w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 sm:p-3 rounded-md ${getPriorityColor(task.priority)}`}
    >
      {task.editing ? (
        <EditTask task={task} onSave={onSave} onCancel={stopEdit} />
      ) : (
        <>
          <div className="flex items-start gap-2 sm:gap-3 w-full">
            <span {...listeners} className="cursor-grab text-gray-500 hover:text-gray-800 text-sm sm:text-base" title="Drag">⠿</span>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => {
                if (isViewer) {
                  alert("You are on viewer mode. You cannot toggle tasks.");
                  return;
                }
                toggleTask(task._id);
              }}
              disabled={isViewer}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <p className={`${task.completed ? "line-through text-gray-400" : ""} font-medium text-sm sm:text-base break-words`}>{task.text}</p>
              {task.due && <p className={`text-xs sm:text-sm ${getDueDateColor(task.due)}`}>Due: {formatDueDate(task.due)}</p>}
              <p className="text-xs italic capitalize">Priority: {task.priority}</p>
              <p className="text-xs font-semibold text-blue-500">Category: {task.category}</p>
              {task.repeat && (
                <p className="text-xs text-purple-500 capitalize">🔁 Repeats: {task.repeat}</p>
              )}

              {/* show last completed */}
              {task.lastCompletedAt && (
                <p className="text-xs text-gray-500">
                  ✅ Last done: {formatLastCompleted(task.lastCompletedAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-1 sm:gap-2 mt-2 sm:mt-0 self-end sm:self-center">
            <button
              onClick={() => {
                if (isViewer) {
                  alert("You are on viewer mode. You cannot edit tasks.");
                  return;
                }
                startEdit(task._id);
              }}
              disabled={isViewer}
              className={`text-xs sm:text-sm ${isViewer ? "text-gray-400 cursor-not-allowed" : "text-blue-500 hover:underline"}`}
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (isViewer) {
                  alert("You are on viewer mode. You cannot delete tasks.");
                  return;
                }
                deleteTask(task._id);
              }}
              disabled={isViewer}
              className={`text-xs sm:text-sm ${isViewer ? "text-gray-400 cursor-not-allowed" : "text-red-500 hover:underline"}`}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}


/* Edit Task Form */
function EditTask({ task, onSave, onCancel }) {
  const [text, setText] = useState(task.text || "");
  const [due, setDue] = useState(task.due ? formatDateForInput(task.due) : "");
  const [priority, setPriority] = useState(task.priority || "medium");
  const [category, setCategory] = useState(task.category || "General");
  const [repeat, setRepeat] = useState(task.repeat ?? "");

  const inputClasses =
    "w-full p-1 sm:p-2 border rounded-md bg-white text-gray-800 border-gray-300 text-sm " +
    "dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600";

  const buttonBase =
    "px-3 sm:px-4 py-1 rounded-md text-white transition-colors text-sm";

  return (
    <div className="w-full flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputClasses}
      />
      <div className="relative">
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Due Date &amp; Time</label>
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className={inputClasses + " [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:dark:opacity-50"}
          step="60"
        />
      </div>
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className={inputClasses}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className={inputClasses}
      >
        <option value="General">General</option>
        <option value="Work">Work</option>
        <option value="Personal">Personal</option>
        <option value="Shopping">Shopping</option>
      </select>
      <select
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        className={inputClasses}
      >
        <option value="">No repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => {
            // When creating a Date from datetime-local value, specify it's in local time
            const dueDate = due ? new Date(due).toISOString() : null;
            onSave({ text, due: dueDate, priority, category, repeat: repeat || null });
          }}
          className={`${buttonBase} bg-green-500 hover:bg-green-600`}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className={`${buttonBase} bg-gray-500 hover:bg-gray-600`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default TodoPage;
