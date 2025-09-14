import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export function useTasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const tasksRef = useRef(tasks);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ---------- HELPERS ----------
  const getNextDueDate = (dateStr, repeat) => {
    const d = new Date(dateStr);
    if (repeat === "daily") d.setDate(d.getDate() + 1);
    if (repeat === "weekly") d.setDate(d.getDate() + 7);
    if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
   // Format to local yyyy-MM-ddTHH:mm
  const pad = (n) => n.toString().padStart(2, "0");
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return local;
  };

  const updateTaskDueDate = useCallback(
    async (id, newDue) => {
      const updated = tasksRef.current.map((t) =>
        t._id === id ? { ...t, due: newDue, completed: false } : t
      );
      setTasks(updated);
      localStorage.setItem("tasks", JSON.stringify(updated));

      if (!navigator.onLine) {
        setQueue((prev) => [
          ...prev,
          {
            type: "UPDATE",
            url: `${API_URL}/tasks/${id}`,
            options: {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ due: newDue, completed: false }),
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
          body: JSON.stringify({ due: newDue, completed: false }),
        });
        if (!res.ok) throw new Error("Failed to update recurring task");
      } catch (err) {
        console.error("Failed to update recurring task", err);
      }
    },
    [token]
  );

  // ---------- AUTO-RECURRING HANDLER ----------
  const handleRecurringTasks = useCallback(async () => {
    const now = new Date();
    for (const t of tasksRef.current) {
      if (!t.repeat || !t.due) continue;
      const due = new Date(t.due);
      if (due < now) {
        const nextDue = getNextDueDate(t.due, t.repeat);
        await updateTaskDueDate(t._id, nextDue);
      }
    }
  }, [updateTaskDueDate]);

  useEffect(() => {
    handleRecurringTasks(); // run on mount
    const interval = setInterval(() => {
      handleRecurringTasks();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [handleRecurringTasks]);

  // ---------- CRUD ----------
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
      localStorage.setItem("tasks", JSON.stringify(updated));

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

    console.log("🔍 toggleTask called for:", task.text);
    console.log("➡️ Current values → completed:", task.completed, "repeat:", task.repeat, "due:", task.due);

    let updatedTask;
    console.log("🧪 Task raw data →", task);


    // If completing and it has repeat, generate next due date
    console.log("⚡ Toggling completed status only — no due date change");
updatedTask = { ...task, completed: !task.completed };
    const updatedList = tasksRef.current.map((t) =>
      t._id === id ? updatedTask : t
    );
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
              due: updatedTask.due,
              completed: updatedTask.completed,
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
        body: JSON.stringify({
          due: updatedTask.due,
          completed: updatedTask.completed,
        }),
      });
      if (res.ok) {
        const updatedFromServer = await res.json();
        console.log("✅ Updated task saved on server:", updatedFromServer);
        setTasks((prev) =>
          prev.map((t) => (t._id === id ? updatedFromServer : t))
        );
      } else {
        throw new Error("Failed to toggle task on server");
      }
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
      localStorage.setItem("tasks", JSON.stringify(updated));

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
      const updated = tasksRef.current.map((t) =>
        t._id === id ? { ...t, ...updatedFields, editing: false } : t
      );
      setTasks(updated);
      localStorage.setItem("tasks", JSON.stringify(updated));

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
          body: JSON.stringify({
            text: updatedFields.text,
            due: updatedFields.due,
            priority: updatedFields.priority,
            category: updatedFields.category,
            repeat: updatedFields.repeat, // ✅ added here
            completed: updatedFields.completed,
          }),
        });
        if (!res.ok) throw new Error("Failed to update task");

        const updatedFromServer = await res.json();
        setTasks((prev) =>
          prev.map((t) =>
            t._id === id ? { ...updatedFromServer, editing: false } : t
          )
        );
        toast.success("Task updated");
      } catch (err) {
        toast.error(err.message || "Failed to update task");
        console.error(err);
      }
    },
    [token]
  );

  const reorderTasks = useCallback(
    async (startIndex, endIndex) => {
      const updatedTasks = [...tasksRef.current];
      const [moved] = updatedTasks.splice(startIndex, 1);
      updatedTasks.splice(endIndex, 0, moved);

      const withOrders = updatedTasks.map((t, i) => ({ ...t, order: i }));
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
        toast.success("Reorder saved offline — will sync when online");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/reorder`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderedIds: withOrders.map((t) => t._id) }),
        });
        if (res.ok) {
          const data = await res.json();
          data.sort((a, b) => a.order - b.order);
          setTasks(data);
          localStorage.setItem("tasks", JSON.stringify(data));
          toast.success("Order updated");
        } else {
          throw new Error("Failed to save order");
        }
      } catch (err) {
        toast.error("Failed to update order");
        console.error(err);
      }
    },
    [token]
  );

  // ---------- LOAD ----------
  useEffect(() => {
    if (!token) return;

    const fetchTasks = async () => {
      const saved = localStorage.getItem("tasks");
      if (saved) setTasks(JSON.parse(saved));
      if (!navigator.onLine) return;

      try {
        const res = await fetch(`${API_URL}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch tasks");

        const data = await res.json();
        data.sort((a, b) => a.order - b.order);

        setTasks(data);
        localStorage.setItem("tasks", JSON.stringify(data));

        await handleRecurringTasks();
      } catch (err) {
        toast.error("Failed to load tasks from server");
        console.error(err);
      }
    };

    fetchTasks();
  }, [token, handleRecurringTasks]);

  // ---------- SYNC QUEUE ----------
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
          if (token && !headers.Authorization)
            headers.Authorization = `Bearer ${token}`;
          const options = { ...action.options, headers };

          const res = await fetch(action.url, options);
          if (!res.ok) throw new Error("Failed to sync ADD");

          const created = await res.json();
          tempIdMap[action.meta.tempId] = created._id;

          setTasks((prev) =>
            prev.map((t) => (t._id === action.meta.tempId ? created : t))
          );

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
            realUrl = action.url.replace(
              action.dependsOn,
              tempIdMap[action.dependsOn]
            );
          }

          const headers = { ...(action.options.headers || {}) };
          if (token && !headers.Authorization)
            headers.Authorization = `Bearer ${token}`;
          const options = { ...action.options, headers };

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
        });
        if (res2.ok) {
          const data = await res2.json();
          data.sort((a, b) => a.order - b.order);
          setTasks(data);
          localStorage.setItem("tasks", JSON.stringify(data));
          await handleRecurringTasks();
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
  }, [queue, token, handleRecurringTasks]);

  // ---------- SAVE TO LOCAL ----------
  useEffect(() => {
    try {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    } catch (err) {
      console.error("Failed to write tasks to localStorage", err);
    }
  }, [tasks]);

  // ---------- EDITING ----------
  const startEdit = useCallback((id) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, editing: true } : t))
    );
  }, []);

  const stopEdit = useCallback(() => {
  setTasks((prev) => prev.map((t) => ({ ...t, editing: false })));
}, []);


  return {
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    saveEdit,
    reorderTasks,
    startEdit,
    stopEdit,
    setTasks,
  };
}
