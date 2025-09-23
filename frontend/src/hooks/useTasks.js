import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Normalize tasks to prevent missing fields
const normalizeTasks = (raw) =>
  raw.map((t) => ({
    ...t,
    repeat: t.repeat || null,
    category: t.category || "General",
    priority: t.priority || "normal",
    text: t.text || "",
  }));

export function useTasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const tasksRef = useRef(tasks);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false); 

  // keep ref in sync
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Load tasks from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("tasks");
    if (saved) {
      try {
        setTasks(normalizeTasks(JSON.parse(saved)));
      } catch {
        localStorage.removeItem("tasks");
      }
    }
  }, []);

  // Fetch tasks from API on mount or token change
  useEffect(() => {
    if (!token) return;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store", //  prevent stale cache
        });
        if (!res.ok) throw new Error("Failed to fetch tasks");

        const data = await res.json();
        const normalized = normalizeTasks(data);
        normalized.sort((a, b) => a.order - b.order);

        setTasks(normalized);
        localStorage.setItem("tasks", JSON.stringify(normalized));
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [token]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch(`${API_URL}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = await res.json();
        const normalized = normalizeTasks(data);
        normalized.sort((a, b) => a.order - b.order);

        setTasks(normalized);
        localStorage.setItem("tasks", JSON.stringify(normalized));
      } catch (err) {
        console.error("Auto-refresh failed:", err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token]);

  // Persist tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(normalizeTasks(tasks)));
  }, [tasks]);

  // -------------------
  // CRUD
  // -------------------
  const addTask = useCallback(
    async (text, due, priority, category, repeat = null) => {
      if (!text?.trim()) return;

      const tempId = `temp-${Date.now()}`;
      const newTask = {
        _id: tempId,
        text,
        due,
        priority,
        category,
        repeat,
        completed: false,
        order: tasksRef.current.length,
      };

      const updated = [...tasksRef.current, newTask];
      setTasks(updated);
      localStorage.setItem("tasks", JSON.stringify(normalizeTasks(updated)));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "ADD",
            url: `${API_URL}/tasks`,
            options: {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, due, priority, category, repeat }),
            },
            meta: { tempId },
          },
        ]);
        toast.success("Task added offline — will sync when online");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({ text, due, priority, category, repeat }),
        });
        const created = await res.json();
        setTasks((prev) => prev.map((t) => (t._id === tempId ? created : t)));
        toast.success("Task added");
      } catch (err) {
        toast.error("Failed to add task");
        console.error(err);
      }
    },
    [token]
  );

  const toggleTask = useCallback(
    async (id) => {
      const task = tasksRef.current.find((t) => t._id === id);
      if (!task) return;

      const newCompleted = !task.completed;
      let newLastCompletedAt = task.lastCompletedAt;

      if (newCompleted) {
        const now = new Date();
        const last = task.lastCompletedAt ? new Date(task.lastCompletedAt) : null;
        const isSameDay =
          last &&
          last.getFullYear() === now.getFullYear() &&
          last.getMonth() === now.getMonth() &&
          last.getDate() === now.getDate();

        if (!isSameDay) newLastCompletedAt = now.toISOString();
      }

      const updatedTask = { ...task, completed: newCompleted, lastCompletedAt: newLastCompletedAt };
      const updatedList = tasksRef.current.map((t) => (t._id === id ? updatedTask : t));
      setTasks(updatedList);
      localStorage.setItem("tasks", JSON.stringify(updatedList));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "UPDATE",
            url: `${API_URL}/tasks/${id}`,
            options: {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                completed: newCompleted,
                lastCompletedAt: newLastCompletedAt,
              }),
            },
          },
        ]);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            completed: newCompleted,
            lastCompletedAt: newLastCompletedAt,
          }),
        });
        if (!res.ok) throw new Error("Failed to toggle task");

        const updatedFromServer = await res.json();
        setTasks((prev) => prev.map((t) => (t._id === id ? updatedFromServer : t)));
      } catch (err) {
        toast.error("Failed to update task");
        console.error(err);
      }
    },
    [token]
  );

  const deleteTask = useCallback(
    async (id) => {
      const updated = tasksRef.current.filter((t) => t._id !== id);
      setTasks(updated);
      localStorage.setItem("tasks", JSON.stringify(normalizeTasks(updated)));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "DELETE",
            url: `${API_URL}/tasks/${id}`,
            options: { method: "DELETE", headers: {} },
            dependsOn: id.startsWith("temp-") ? id : undefined,
          },
        ]);
        toast.success("Deleted locally — will sync when online");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res.ok) toast.success("Task deleted");
      } catch (err) {
        toast.error("Failed to delete task");
        console.error(err);
      }
    },
    [token]
  );

  const saveEdit = useCallback(
    async (id, updatedFields) => {
      if (updatedFields.repeat === "" || updatedFields.repeat === undefined) {
        updatedFields.repeat = null;
      }

      const updated = tasksRef.current.map((t) =>
        t._id === id ? { ...t, ...updatedFields, editing: false } : t
      );
      setTasks(updated);
      localStorage.setItem("tasks", JSON.stringify(normalizeTasks(updated)));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "UPDATE",
            url: `${API_URL}/tasks/${id}`,
            options: {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatedFields),
            },
          },
        ]);
        toast.success("Task edited offline — will sync when online");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            text: updatedFields.text,
            due: updatedFields.due,
            priority: updatedFields.priority,
            category: updatedFields.category,
            repeat: updatedFields.repeat,
            completed: updatedFields.completed,
          }),
        });
        if (!res.ok) throw new Error("Failed to update task");

        const updatedFromServer = await res.json();
        if (!updatedFromServer.repeat) updatedFromServer.repeat = null;

        setTasks((prev) =>
          prev.map((t) => (t._id === id ? { ...updatedFromServer, editing: false } : t))
        );
        toast.success("Task updated");
      } catch (err) {
        toast.error(err.message || "Failed to update task");
        console.error(err);
      }
    },
    [token]
  );

  // -------------------
  // Reorder Functions
  // -------------------
  const reorderRecurring = useCallback(
    async (startIndex, endIndex) => {
      const recurring = tasksRef.current.filter((t) => t.repeat);
      const nonRecurring = tasksRef.current.filter((t) => !t.repeat);

      const updatedRecurring = [...recurring];
      const [moved] = updatedRecurring.splice(startIndex, 1);
      updatedRecurring.splice(endIndex, 0, moved);

      const withOrders = [
        ...nonRecurring,
        ...updatedRecurring.map((t, i) => ({ ...t, order: i })),
      ];

      setTasks(withOrders);
      localStorage.setItem("tasks", JSON.stringify(withOrders));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "REORDER",
            url: `${API_URL}/tasks/reorder`,
            options: {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderedIds: withOrders.map((t) => t._id) }),
            },
          },
        ]);
        toast.success("Recurring order saved offline — will sync when online");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/reorder`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({ orderedIds: withOrders.map((t) => t._id) }),
        });
        if (res.ok) {
          const data = await res.json();
          data.sort((a, b) => a.order - b.order);
          setTasks(data);
          localStorage.setItem("tasks", JSON.stringify(data));
          toast.success("Recurring order updated");
        }
      } catch (err) {
        toast.error("Failed to update recurring order");
        console.error(err);
      }
    },
    [token]
  );

  const reorderNonRecurring = useCallback(
    async (startIndex, endIndex) => {
      const recurring = tasksRef.current.filter((t) => t.repeat);
      const nonRecurring = tasksRef.current.filter((t) => !t.repeat);

      const updatedNonRecurring = [...nonRecurring];
      const [moved] = updatedNonRecurring.splice(startIndex, 1);
      updatedNonRecurring.splice(endIndex, 0, moved);

      const withOrders = [
        ...updatedNonRecurring.map((t, i) => ({ ...t, order: i })),
        ...recurring,
      ];

      setTasks(withOrders);
      localStorage.setItem("tasks", JSON.stringify(withOrders));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "REORDER",
            url: `${API_URL}/tasks/reorder`,
            options: {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderedIds: withOrders.map((t) => t._id) }),
            },
          },
        ]);
        toast.success("Non-recurring order saved offline — will sync when online");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/reorder`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({ orderedIds: withOrders.map((t) => t._id) }),
        });
        if (res.ok) {
          const data = await res.json();
          data.sort((a, b) => a.order - b.order);
          setTasks(data);
          localStorage.setItem("tasks", JSON.stringify(data));
          toast.success("Non-recurring order updated");
        }
      } catch (err) {
        toast.error("Failed to update non-recurring order");
        console.error(err);
      }
    },
    [token]
  );

  // -------------------
  // Editing Helpers
  // -------------------
  const startEdit = useCallback((id) => {
    setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, editing: true } : t)));
  }, []);

  const stopEdit = useCallback(() => {
    setTasks((prev) => prev.map((t) => ({ ...t, editing: false })));
  }, []);

  // -------------------
  // Queue Sync
  // -------------------
  useEffect(() => {
    if (!queue.length) return;
    let cancelled = false;

    const trySync = async () => {
      if (!navigator.onLine || cancelled) return;

      const newQueue = [...queue];
      const tempIdMap = {};

      for (const action of queue.filter((a) => a.type === "ADD")) {
        try {
          const headers = { ...(action.options.headers || {}) };
          if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
          const options = { ...action.options, headers, cache: "no-store" };

          const res = await fetch(action.url, options);
          if (!res.ok) throw new Error("Failed to sync ADD");

          const created = await res.json();
          tempIdMap[action.meta.tempId] = created._id;

          setTasks((prev) => prev.map((t) => (t._id === action.meta.tempId ? created : t)));

          const index = newQueue.indexOf(action);
          if (index > -1) newQueue.splice(index, 1);
        } catch (err) {
          console.error("Failed to sync ADD", action, err);
        }
      }

      for (const action of newQueue) {
        try {
          let realUrl = action.url;
          if (action.dependsOn && tempIdMap[action.dependsOn]) {
            realUrl = action.url.replace(action.dependsOn, tempIdMap[action.dependsOn]);
          }

          const headers = { ...(action.options.headers || {}) };
          if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
          const options = { ...action.options, headers, cache: "no-store" };

          const res = await fetch(realUrl, options);
          if (!res.ok) throw new Error("Failed to sync action");

          const index = newQueue.indexOf(action);
          if (index > -1) newQueue.splice(index, 1);
        } catch (err) {
          console.error("Failed to sync action", action, err);
        }
      }

      setQueue(newQueue);

      try {
        const res2 = await fetch(`${API_URL}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res2.ok) {
          const data = await res2.json();
          data.sort((a, b) => a.order - b.order);
          setTasks(data);
          localStorage.setItem("tasks", JSON.stringify(data));
        }
      } catch (err) {
        console.error("Failed to refresh tasks after sync", err);
      }
    };

    window.addEventListener("online", trySync);
    trySync();
    return () => {
      cancelled = true;
      window.removeEventListener("online", trySync);
    };
  }, [queue, token]);

  return {
    tasks,
    loading, 
    addTask,
    toggleTask,
    deleteTask,
    saveEdit,
    reorderRecurring,
    reorderNonRecurring,
    startEdit,
    stopEdit,
    setTasks,
  };
}
