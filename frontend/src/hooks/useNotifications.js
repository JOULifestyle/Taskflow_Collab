import { useEffect, useRef } from "react";
import { useTasks } from "./useTasks";

export function useNotifications() {
  const { tasks } = useTasks();
  const notifiedTasks = useRef(new Set());

  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Reset notifications whenever task list changes
    notifiedTasks.current.clear();

    const interval = setInterval(() => {
      if (Notification.permission !== "granted") return;

      const now = new Date();
      const soon = new Date(now.getTime() + 15 * 60 * 1000);

      tasks.forEach((t) => {
        if (!t.due) return;
        const dueTime = new Date(t.due);

        const earlyKey = `${t._id}-early`;
        const dueKey = `${t._id}-due`;

        // 15 minutes before
        if (
          dueTime > now &&
          dueTime <= soon &&
          !notifiedTasks.current.has(earlyKey)
        ) {
          new Notification("⏳ Task due soon!", {
            body: `${t.text} is due at ${dueTime.toLocaleTimeString()}`,
          });
          notifiedTasks.current.add(earlyKey);
        }

        // exactly at due time (within 1 min)
        const diff = dueTime.getTime() - now.getTime();
        if (
          diff > 0 &&
          diff <= 60 * 1000 &&
          !notifiedTasks.current.has(dueKey)
        ) {
          new Notification("⏰ Task due now!", {
            body: `${t.text} is due now!`,
          });
          notifiedTasks.current.add(dueKey);
        }
      });
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [tasks]);
}
