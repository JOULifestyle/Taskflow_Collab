import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketProvider"; 

export function useCollaborativeTasks(setTasks) {
  const { user } = useAuth();
  const { socket } = useSocket(); //  single shared socket

  useEffect(() => {
    if (!socket || !user) return;


    //  Task created
    socket.on("task:created", (task) => {
      setTasks((prev) => {
        // Check if task already exists (avoid duplicates from local creation)
        const exists = prev.some((t) => t._id === task._id);
        if (exists) {
          
          return prev;
        }
        // Replace any temp task with the same text
        const tempIndex = prev.findIndex((t) => t._id.startsWith("temp-") && t.text === task.text);
        if (tempIndex !== -1) {
          
          const newTasks = [...prev];
          newTasks[tempIndex] = task;
          return newTasks;
        }
        // Show local notification for new task (only if tab not focused)
        if ("Notification" in window && Notification.permission === "granted" && !document.hasFocus()) {
          try {
            const notification = new Notification("New Task Created", {
              body: `📝 ${task.text}`,
              icon: "/logo192.png",
              badge: "/logo192.png",
              tag: `task-${task._id}`,
              requireInteraction: true,
            });
            setTimeout(() => notification.close(), 30000);
          } catch (error) {
            console.error("Failed to show notification for created task:", error);
          }
        }
        return [...prev, task];
      });
    });

    //  Task updated
    socket.on("task:updated", (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));

      //  Fallback: Show local notification if push notifications aren't working
      if ("Notification" in window && Notification.permission === "granted" && !document.hasFocus()) {
        try {
          const notification = new Notification("Task Updated", {
            body: `✏️ ${task.text} was updated`,
            icon: "/logo192.png",
            badge: "/logo192.png",
            tag: `task-${task._id}`, // Prevent duplicate notifications
            requireInteraction: true, // Keep notification until user interacts
          });

          // Auto-close after 30 seconds if not interacted
          setTimeout(() => notification.close(), 30000);
        } catch (error) {
          console.error("Failed to show notification for updated task:", error);
        }
      }
    });

    //  Task deleted
    socket.on("task:deleted", (id) => {
      setTasks((prev) => prev.filter((t) => t._id !== id));
    });

    //  Task reminder
    socket.on("task:reminder", (data) => {
      
      if ("Notification" in window && Notification.permission === "granted" && !document.hasFocus()) {
        try {
          const notification = new Notification("Task Reminder", {
            body: data.message,
            icon: "/logo192.png",
            badge: "/logo192.png",
            tag: `reminder-${data.task._id}-${data.stage}`, 
            requireInteraction: true, 
          });

          // Auto-close after 30 seconds if not interacted
          setTimeout(() => notification.close(), 30000);
        } catch (error) {
          console.error("Failed to show notification for reminder:", error);
        }
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
