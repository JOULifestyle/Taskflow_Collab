import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketProvider"; // ✅ use shared socket instance

export function useCollaborativeTasks(setTasks) {
  const { user } = useAuth();
  const { socket } = useSocket(); //  single shared socket

  useEffect(() => {
    if (!socket || !user) return;

    console.log("🔌 Connected to collab server via shared socket");

    //  Task created
    socket.on("task:created", (task) => {
      setTasks((prev) => {
        // Check if task already exists (avoid duplicates from local creation)
        const exists = prev.some((t) => t._id === task._id);
        if (exists) {
          console.log("⚠️ Task already exists, skipping duplicate:", task._id);
          return prev;
        }
        // Replace any temp task with the same text
        const tempIndex = prev.findIndex((t) => t._id.startsWith("temp-") && t.text === task.text);
        if (tempIndex !== -1) {
          console.log("🔄 Replacing temp task with real task:", task._id);
          const newTasks = [...prev];
          newTasks[tempIndex] = task;
          return newTasks;
        }
        return [...prev, task];
      });
    });

    //  Task updated
    socket.on("task:updated", (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));

      //  Fallback: Show local notification if push notifications aren't working
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification("Task Updated", {
          body: `✏️ ${task.text} was updated`,
          icon: "/logo192.png",
          badge: "/logo192.png",
          tag: `task-${task._id}`, // Prevent duplicate notifications
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      }
    });

    //  Task deleted
    socket.on("task:deleted", (id) => {
      console.log("🗑️ Received task:deleted event for task:", id);
      setTasks((prev) => prev.filter((t) => t._id !== id));
    });

    //  Task reminder
    socket.on("task:reminder", (data) => {
      // Show local notification for due reminders
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification("Task Reminder", {
          body: data.message,
          icon: "/logo192.png",
          badge: "/logo192.png",
          tag: `reminder-${data.task._id}-${data.stage}`, // Prevent duplicate notifications
        });

        // Auto-close after 10 seconds for reminders
        setTimeout(() => notification.close(), 10000);
      }
    });

    //  Clean up
    return () => {
      socket.off("task:created");
      socket.off("task:updated");
      socket.off("task:deleted");
      socket.off("task:reminder");
    };
  }, [socket, user, setTasks]);
}
