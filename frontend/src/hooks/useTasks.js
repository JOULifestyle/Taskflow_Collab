import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketProvider";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Normalize tasks to prevent missing fields
const normalizeTasks = (raw = []) =>
  raw.map((t) => ({
    ...t,
    repeat: t?.repeat ?? null,
    category: t?.category ?? "General",
    priority: t?.priority ?? "normal",
    text: t?.text ?? "",
  }));

 // Merge temp + real tasks
function mergeTasks(apiTasks, localTasks) {
  const merged = [];

  for (const local of localTasks) {
    if (local._id.startsWith("temp-")) {
      // Try to match real task by fields
      const match = apiTasks.find(
        (t) =>
          t.text === local.text &&
          String(t.due) === String(local.due) &&
          t.priority === local.priority &&
          t.category === local.category
      );
      merged.push(match || local);
    } else {
      merged.push(local);
    }
  }
  // Add any missing API tasks
  for (const api of apiTasks) {
    if (!merged.find((m) => m._id === api._id)) {
      merged.push(api);
    }
  }

  merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return merged;
}
export function useTasks(listId) {
  const { user } = useAuth();
  const { socket } = useSocket(); 
  const token = user?.token; 
  const [tasks, setTasks] = useState([]);
  const tasksRef = useRef(tasks);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  // keep ref in sync
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  //  listen for socket events
  useEffect(() => {
    if (!socket) return;

    const handleUpdated = (updatedTask) => {
      console.log("📢 Got task:updated from server:", updatedTask);
      if (updatedTask.listId !== listId) return; // only update if same list

      setTasks((prev) => 
        prev.map((t) =>
      t._id === updatedTask._id ? { ...t, ...updatedTask } : t
    )
      );
    };

    socket.on("task:updated", handleUpdated);

    return () => {
      socket.off("task:updated", handleUpdated);
    };
  }, [socket, listId]);

   //  Reset when no list is selected
  useEffect(() => {
    if (!listId) {
      setTasks([]); // clear tasks
      return;
    }
    // Load tasks from localStorage (per listId)
    const saved = localStorage.getItem(`tasks-${listId}`);
    if (saved) {
      try {
        setTasks(normalizeTasks(JSON.parse(saved)));
      } catch {
        localStorage.removeItem(`tasks-${listId}`);
        setTasks([]);
      }
    } else {
      setTasks([]); // reset when switching lists
    }
  }, [listId]);


  // Fetch tasks from API when token or listId changes
  useEffect(() => {
    if (!token || !listId) return;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/lists/${listId}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch tasks");

        const data = await res.json();
        const normalized = normalizeTasks(data);

        const saved = localStorage.getItem(`tasks-${listId}`);
        const local = saved ? normalizeTasks(JSON.parse(saved)) : [];
        const merged = mergeTasks(normalized, local);

        setTasks(merged);
        localStorage.setItem(`tasks-${listId}`, JSON.stringify(merged));
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [token, listId]);

   // Persist tasks to localStorage whenever they change
  useEffect(() => {
    if (!listId) return; //  don’t persist if no active list
    localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalizeTasks(tasks)));
  }, [tasks, listId]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!token || !listId) return;

    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch(`${API_URL}/lists/${listId}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const normalized = normalizeTasks(data);

        const saved = localStorage.getItem(`tasks-${listId}`);
const local = saved ? normalizeTasks(JSON.parse(saved)) : [];
const merged = mergeTasks(normalized, local);


        setTasks(merged);
        localStorage.setItem(`tasks-${listId}`, JSON.stringify(merged));
      } catch (err) {
        console.error("Auto-refresh failed:", err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token, listId]);

  // Persist tasks to localStorage whenever they change
  useEffect(() => {
    if (!listId) return;
    localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalizeTasks(tasks)));
  }, [tasks, listId]);

  // -------------------
  // CRUD
  // -------------------
   const addTask = useCallback(
    async (text, due, priority, category, repeat = null) => {
      if (!text?.trim() || !listId) return;

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
      localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalizeTasks(updated)));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "ADD",
            url: `${API_URL}/lists/${listId}/tasks`,
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
        const res = await fetch(`${API_URL}/lists/${listId}/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({ text, due, priority, category, repeat }),
        });
        if (!res.ok) throw new Error("Failed to add task");
        const created = await res.json();

        setTasks((prev) =>
          prev.map((t) => (t._id === tempId ? created : t))
        );
        toast.success("Task added");
      } catch (err) {
        toast.error("Failed to add task");
        console.error(err);
      }
    },
    [token, listId]
  );

  const toggleTask = useCallback(
    async (id) => {
      const task = tasksRef.current.find((t) => t._id === id);
      if (!task || !listId) return;

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
      localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalizeTasks(updatedList)));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "UPDATE",
            url: `${API_URL}/lists/${listId}/tasks/${id}`,
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
        const res = await fetch(`${API_URL}/lists/${listId}/tasks/${id}`, {
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
setTasks((prev) =>
  prev.map((t) =>
    t._id === updatedFromServer._id ? { ...t, ...updatedFromServer } : t
  )
);
      } catch (err) {
        toast.error("Failed to update task");
        console.error(err);
      }
    },
    [token, listId]
  );

  const deleteTask = useCallback(
    async (id) => {
      const updated = tasksRef.current.filter((t) => t._id !== id);
      setTasks(updated);
      localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalizeTasks(updated)));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "DELETE",
            url: `${API_URL}/lists/${listId}/tasks/${id}`,
            options: { method: "DELETE", headers: {} },
            dependsOn: id.startsWith("temp-") ? id : undefined,
          },
        ]);
        toast.success("Deleted locally — will sync when online");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/lists/${listId}/tasks/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res.ok) {
  toast.success("Task deleted");
  setTasks((prev) => prev.filter((t) => t._id !== id));
}
      } catch (err) {
        toast.error("Failed to delete task");
        console.error(err);
      }
    },
    [token, listId]
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
      localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalizeTasks(updated)));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "UPDATE",
            url: `${API_URL}/lists/${listId}/tasks/${id}`,
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
        const res = await fetch(`${API_URL}/lists/${listId}/tasks/${id}`, {
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
  prev.map((t) =>
    t._id === updatedFromServer._id
      ? { ...t, ...updatedFromServer, editing: false }
      : t
  )
);

        toast.success("Task updated");
      } catch (err) {
        toast.error(err.message || "Failed to update task");
        console.error(err);
      }
    },
    [token, listId]
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
      localStorage.setItem(`tasks-${listId}`, JSON.stringify(withOrders));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "REORDER",
            url: `${API_URL}/lists/${listId}/tasks/reorder`,
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
        const res = await fetch(`${API_URL}/lists/${listId}/tasks/reorder`, {
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
          data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setTasks(data);
          localStorage.setItem(`tasks-${listId}`, JSON.stringify(data));
          toast.success("Recurring order updated");
        }
      } catch (err) {
        toast.error("Failed to update recurring order");
        console.error(err);
      }
    },
    [token, listId]
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
      localStorage.setItem(`tasks-${listId}`, JSON.stringify(withOrders));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "REORDER",
            url: `${API_URL}/lists/${listId}/tasks/reorder`,
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
        const res = await fetch(`${API_URL}/lists/${listId}/tasks/reorder`, {
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
          data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setTasks(data);
          localStorage.setItem(`tasks-${listId}`, JSON.stringify(data));
          toast.success("Non-recurring order updated");
        }
      } catch (err) {
        toast.error("Failed to update non-recurring order");
        console.error(err);
      }
    },
    [token, listId]
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
    if (!queue.length || !listId) return;
    let cancelled = false;

    const trySync = async () => {
      if (!navigator.onLine || cancelled) return;

      const newQueue = [...queue];
      const tempIdMap = {};

      // First: process ADDs (to map temp ids -> real ids)
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

      // Then: process remaining actions, substituting temp ids where needed
      for (const action of [...newQueue]) {
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

      // Final: refresh canonical list from server
      try {
        const res2 = await fetch(`${API_URL}/lists/${listId}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res2.ok) {
  const data = await res2.json();
  const normalized = normalizeTasks(data);

  const saved = localStorage.getItem(`tasks-${listId}`);
const local = saved ? normalizeTasks(JSON.parse(saved)) : [];
const merged = mergeTasks(normalized, local);


  setTasks(merged);
  localStorage.setItem(`tasks-${listId}`, JSON.stringify(merged));
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
  }, [queue, token, listId]);

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
    queue,
  };
}
