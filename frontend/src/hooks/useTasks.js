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

// Removed unused mergeTasks function
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
     
      if (listId && updatedTask.listId !== listId) return; // only update if same list (or all lists if no listId)

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
     // Load from localStorage initially for instant UI, but API will override
     const saved = localStorage.getItem(`tasks-${listId}`);
     if (saved) {
       try {
         const parsed = JSON.parse(saved);
         console.log(`[LOCALSTORAGE] Loading ${parsed.length} tasks from localStorage for list ${listId}:`, parsed.map(t => ({ id: t._id, text: t.text, completed: t.completed })));
         setTasks(normalizeTasks(parsed));
       } catch {
         console.error(`[LOCALSTORAGE] Failed to parse localStorage for list ${listId}, clearing`);
         localStorage.removeItem(`tasks-${listId}`);
         setTasks([]);
       }
     } else {
       console.log(`[LOCALSTORAGE] No saved tasks for list ${listId}, starting empty`);
       setTasks([]); // reset when switching lists
     }
   }, [listId]);


  // Fetch tasks from API when token or listId changes
  useEffect(() => {
    if (!token) return;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        let data = [];

        if (listId) {
          // Fetch tasks for specific list
          console.log(`[FETCH] Fetching tasks for list ${listId}`);
          const res = await fetch(`${API_URL}/lists/${listId}/tasks`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          console.log(`[FETCH] Response status: ${res.status}`);
          if (!res.ok) throw new Error("Failed to fetch tasks");
          data = await res.json();
          console.log(`[FETCH] Received ${data.length} tasks`);
        } else {
          // Fetch all tasks across all lists
          const res = await fetch(`${API_URL}/tasks/all`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Failed to fetch all tasks");
          data = await res.json();
        }

        const normalized = normalizeTasks(data);

        if (listId) {
          // For specific list, use server data as source of truth
          console.log(`[FETCH] Setting ${normalized.length} tasks from server (replacing localStorage) for list ${listId}:`, normalized.map(t => ({ id: t._id, text: t.text, completed: t.completed })));
          setTasks(normalized);
          localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalized));
        } else {
          // For all tasks, just set them directly
          console.log(`[FETCH] Setting ${normalized.length} tasks from server for all lists:`, normalized.map(t => ({ id: t._id, text: t.text, completed: t.completed })));
          setTasks(normalized);
        }

        // Clear any stale localStorage data that might conflict
        if (listId) {
          // Force localStorage to match server state
          console.log(`[FETCH] Updating localStorage for list ${listId} with server data`);
          localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalized));
        }
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
     console.log(`[PERSIST] Saving ${tasks.length} tasks to localStorage for list ${listId}:`, tasks.map(t => ({ id: t._id, text: t.text, completed: t.completed })));
     localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalizeTasks(tasks)));
   }, [tasks, listId]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!token || !listId) return;

    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        console.log(`[AUTO-REFRESH] Fetching tasks for list ${listId}`);
        const res = await fetch(`${API_URL}/lists/${listId}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        console.log(`[AUTO-REFRESH] Response status: ${res.status}`);
        if (!res.ok) {
          console.warn(`Auto-refresh failed with status: ${res.status}`);
          return;
        }
        const data = await res.json();
        console.log(`[AUTO-REFRESH] Received ${data.length} tasks for list ${listId}:`, data.map(t => ({ id: t._id, text: t.text, completed: t.completed })));
        const normalized = normalizeTasks(data);

        // Use server data as source of truth for auto-refresh
        console.log(`[AUTO-REFRESH] Updating tasks state and localStorage for list ${listId}`);
        setTasks(normalized);
        localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalized));
      } catch (err) {
        console.error("Auto-refresh failed:", err);
        // Don't show toast for auto-refresh failures to avoid spam
        // Check if it's a connection error and handle gracefully
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
          console.warn(`[AUTO-REFRESH] Network error, will retry on next interval`);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token, listId]);

  // Persist tasks to localStorage whenever they change
  useEffect(() => {
    if (!listId) return;
    localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalizeTasks(tasks)));
  }, [tasks, listId]);

  
  // CRUD
  
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
      console.log(`[DELETE] Attempting to delete task ${id} from list ${listId}`);
      const updated = tasksRef.current.filter((t) => t._id !== id);
      console.log(`[DELETE] After filter, ${updated.length} tasks remain:`, updated.map(t => ({ id: t._id, text: t.text, completed: t.completed })));
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
        console.log(`[DELETE] Deleting task ${id}`);
        const res = await fetch(`${API_URL}/lists/${listId}/tasks/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        console.log(`[DELETE] Delete response status: ${res.status}`);
        if (res.ok) {
          toast.success("Task deleted");
          console.log(`[DELETE] Server confirmed deletion of task ${id}`);
          setTasks((prev) => prev.filter((t) => t._id !== id));
        } else {
          console.error(`[DELETE] Delete failed with status: ${res.status}`);
          toast.error("Failed to delete task");
        }
      } catch (err) {
        console.error("[DELETE] Delete error:", err);
        toast.error("Failed to delete task");
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


  // Reorder Functions
  
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

  
  // Editing Helpers
  
  const startEdit = useCallback((id) => {
    setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, editing: true } : t)));
  }, []);

  const stopEdit = useCallback(() => {
    setTasks((prev) => prev.map((t) => ({ ...t, editing: false })));
  }, []);

  
  // Queue Sync

  useEffect(() => {
    if (!queue.length || !listId) return;
    let cancelled = false;
    let syncInProgress = false;

    const trySync = async () => {
      if (!navigator.onLine || cancelled || syncInProgress) return;

      syncInProgress = true;
      const newQueue = [...queue];
      const tempIdMap = {};
      const failedActions = [];

      try {
        // First: process ADDs (to map temp ids -> real ids)
        for (const action of queue.filter((a) => a.type === "ADD")) {
          try {
            const headers = { ...(action.options.headers || {}) };
            if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
            const options = { ...action.options, headers, cache: "no-store" };

            const res = await fetch(action.url, options);
            if (!res.ok) {
              console.warn(`[SYNC] ADD failed with status ${res.status}, will retry later`);
              failedActions.push(action);
              continue;
            }

            const created = await res.json();
            tempIdMap[action.meta.tempId] = created._id;

            setTasks((prev) => prev.map((t) => (t._id === action.meta.tempId ? created : t)));

            const index = newQueue.indexOf(action);
            if (index > -1) newQueue.splice(index, 1);
          } catch (err) {
            console.warn("[SYNC] Failed to sync ADD, will retry later", action, err);
            failedActions.push(action);
          }
        }

        // Then: process remaining actions, substituting temp ids where needed
        for (const action of [...newQueue]) {
          // Skip if this action depends on a temp ID that couldn't be mapped
          if (action.dependsOn && !tempIdMap[action.dependsOn]) {
            console.warn(`[SYNC] Skipping action because temp ID ${action.dependsOn} couldn't be mapped`, action);
            failedActions.push(action);
            continue;
          }

          try {
            let realUrl = action.url;
            if (action.dependsOn && tempIdMap[action.dependsOn]) {
              realUrl = action.url.replace(action.dependsOn, tempIdMap[action.dependsOn]);
            }

            const headers = { ...(action.options.headers || {}) };
            if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
            const options = { ...action.options, headers, cache: "no-store" };

            const res = await fetch(realUrl, options);
            if (!res.ok) {
              console.warn(`[SYNC] Action failed with status ${res.status}, will retry later`, action);
              failedActions.push(action);
              continue;
            }

            const index = newQueue.indexOf(action);
            if (index > -1) newQueue.splice(index, 1);
          } catch (err) {
            console.warn("[SYNC] Failed to sync action, will retry later", action, err);
            failedActions.push(action);
          }
        }

        // If we have failed actions, show a user-friendly message
        if (failedActions.length > 0) {
          console.warn(`[SYNC] ${failedActions.length} actions failed to sync, will retry on next online event`);
          // Don't show toast to avoid spam - the actions will retry automatically
        }

        // Update queue with only failed actions (they will retry on next sync)
        setQueue(failedActions);

        // Final: refresh canonical list from server
        try {
          const res2 = await fetch(`${API_URL}/lists/${listId}/tasks`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (res2.ok) {
            const data = await res2.json();
            const normalized = normalizeTasks(data);

            // Use server data as source of truth
            console.log(`[SYNC] Refreshing tasks after sync for list ${listId}:`, normalized.map(t => ({ id: t._id, text: t.text, completed: t.completed })));
            setTasks(normalized);
            localStorage.setItem(`tasks-${listId}`, JSON.stringify(normalized));
          }
        } catch (err) {
          console.error("Failed to refresh tasks after sync", err);
        }
      } finally {
        syncInProgress = false;
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
