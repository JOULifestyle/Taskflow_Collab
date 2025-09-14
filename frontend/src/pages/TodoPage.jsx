import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useTasks } from "../hooks/useTasks";
import { useAuth } from "../context/AuthContext"; 
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

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ✅ Login/Signup Component
function AuthForm() {
  const { login, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // toggle login/signup

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password);
      toast.success(`${mode} successful`);
    } catch (err) {
      toast.error(err.message || "Auth failed");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-md shadow-md flex flex-col gap-3 w-full max-w-sm"
    >
      <h2 className="text-xl font-bold text-center">{mode === "login" ? "Login" : "Signup"}</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-2 border rounded-md"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="p-2 border rounded-md"
        required
      />
      <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
        {mode === "login" ? "Login" : "Signup"}
      </button>
      <p className="text-sm text-center">
        {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-blue-500 underline"
        >
          {mode === "login" ? "Signup" : "Login"}
        </button>
      </p>
    </form>
  );
}

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

// ✅ Format date to datetime-local for inputs
const formatDateForInput = (dateStr) => {
  if (!dateStr) return "";
  return dateStr.slice(0, 16); // "YYYY-MM-DDTHH:mm"
};

function Todo() {
  const { user } = useAuth();
  const { tasks, addTask, toggleTask, deleteTask, startEdit, saveEdit, setTasks } =
    useTasks();
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("General");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [repeat, setRepeat] = useState("");
  const stopEdit = () => {
  setTasks(prev => prev.map(t => ({ ...t, editing: false })));
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

  // Offline-first fetch tasks
  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      const token = localStorage.getItem("token");
      if (!navigator.onLine) {
        const saved = localStorage.getItem("tasks");
        if (saved) setTasks(JSON.parse(saved));
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setTasks(data);
        localStorage.setItem("tasks", JSON.stringify(data));
      } catch (err) {
        toast.error("Failed to load tasks");
        console.error(err);
      }
    };

    fetchTasks();
  }, [user, setTasks]);

  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  // ⏳ Recurring task checker
  useEffect(() => {
    const checkRecurring = () => {
      const now = new Date();
      tasks.forEach((task) => {
        if (task.repeat && task.due && new Date(task.due) < now) {
          let newDue = new Date(task.due);
          if (task.repeat === "daily") newDue.setDate(newDue.getDate() + 1);
          if (task.repeat === "weekly") newDue.setDate(newDue.getDate() + 7);
          if (task.repeat === "monthly") newDue.setMonth(newDue.getMonth() + 1);

          saveEdit(task._id, { ...task, due: newDue.toISOString() });
        }
      });
    };

    checkRecurring();
    const interval = setInterval(checkRecurring, 60000);
    return () => clearInterval(interval);
  }, [tasks, saveEdit]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t._id === active.id);
    const newIndex = tasks.findIndex((t) => t._id === over.id);

    const newTasks = arrayMove(tasks, oldIndex, newIndex);
    setTasks(newTasks);
    localStorage.setItem("tasks", JSON.stringify(newTasks));

    if (!navigator.onLine) return;

    try {
      const token = localStorage.getItem("token"); 
      const res = await fetch(`${API_URL}/tasks/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderedIds: newTasks.map((t) => t._id) }),
      });
      if (!res.ok) throw new Error("Failed to save order");
      const updatedTasks = await res.json();
      setTasks(updatedTasks);
      localStorage.setItem("tasks", JSON.stringify(updatedTasks));
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
    .filter(t => categoryFilter === "all" ? true : t.category === categoryFilter);

  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;

  if (!user) return <AuthForm />;

  return (
    <>
      <Toaster />
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 rounded-xl shadow-xl w-full max-w-lg sm:max-w-md mx-auto flex flex-col justify-between min-h-[90vh]">
        <div>
          <h1 className="text-2xl font-bold mb-4 text-center">📅 My To-Do List</h1>

          {installable && (
            <button
              onClick={handleInstallClick}
              className="mb-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
            >
              📲 Install App
            </button>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between mb-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded p-2"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded p-2 sm:ml-2"
            >
              <option value="all">All Categories</option>
              <option value="General">General</option>
              <option value="Work">Work</option>
              <option value="Personal">Personal</option>
              <option value="Shopping">Shopping</option>
            </select>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-300 dark:bg-gray-600 h-3 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(completedTasks / totalTasks) * 100 || 0}%` }}
            />
          </div>

          {/* Add Task Form */}
          <div className="mb-4">
            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors"
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
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
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
                    addTask(input, dueDate, priority, category, repeat);
                    setInput("");
                    setDueDate("");
                    setPriority("medium");
                    setCategory("General");
                    setRepeat("");
                    setShowForm(false);
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 active:bg-green-800 transition-colors"
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
            <SortableContext items={filteredTasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-3">
                {filteredTasks.map((task, index) => (
                  <SortableTask
                    key={task._id}
                    id={task._id}
                    task={task}
                    index={index}
                    toggleTask={() => toggleTask(task._id)}
                    deleteTask={() => deleteTask(task._id)}
                    startEdit={(id) => startEdit(id)}
                    onSave={(updatedFields) => saveEdit(task._id, updatedFields)}
                    getDueDateColor={getDueDateColor}
                    getPriorityColor={getPriorityColor}
                    stopEdit={stopEdit}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        <footer className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
          © 2025 joulifestyle
        </footer>
      </div>
    </>
  );
}

/* Sortable Task Item */
function SortableTask({ id, task, toggleTask, deleteTask, startEdit, onSave, getDueDateColor, getPriorityColor, stopEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} {...attributes} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 rounded-md ${getPriorityColor(task.priority)}`}>
      {task.editing ? (
        <EditTask task={task} onSave={onSave} onCancel={stopEdit} />
      ) : (
        <>
          <div className="flex items-start gap-3 w-full">
            <span {...listeners} className="cursor-grab text-gray-500 hover:text-gray-800" title="Drag">⠿</span>
            <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task._id)} />
            <div>
              <p className={`${task.completed ? "line-through text-gray-400" : ""} font-medium`}>{task.text}</p>
              {task.due && <p className={`text-sm ${getDueDateColor(task.due)}`}>Due: {formatDueDate(task.due)}</p>}
              <p className="text-xs italic capitalize">Priority: {task.priority}</p>
              <p className="text-xs font-semibold text-blue-500">Category: {task.category}</p>
              {task.repeat && (
    <p className="text-xs text-purple-500 capitalize">🔁Repeats: {task.repeat}</p>
  )}
            </div>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <button onClick={() => startEdit(task._id)} className="text-blue-500 hover:underline text-sm">Edit</button>
            <button onClick={() => deleteTask(task._id)} className="text-red-500 hover:underline text-sm">Delete</button>
          </div>
        </>
      )}
    </li>
  );
}

/* Edit Task Form */
function EditTask({ task, onSave, onCancel }) {
  const [text, setText] = useState(task.text || "");
  const [due, setDue] = useState(formatDateForInput(task.due));
  const [priority, setPriority] = useState(task.priority || "medium");
  const [category, setCategory] = useState(task.category || "General");
  const [repeat, setRepeat] = useState(task.repeat ?? "");

  const inputClasses =
    "w-full p-2 border rounded-md bg-white text-gray-800 border-gray-300 " +
    "dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600";

  const buttonBase =
    "px-4 py-1 rounded-md text-white transition-colors";

  return (
    <div className="w-full flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputClasses}
      />
      <input
        type="datetime-local"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className={inputClasses}
      />
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
          onClick={() => onSave({ text, due, priority, category, repeat })}
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

export default Todo;
