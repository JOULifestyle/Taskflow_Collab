// sync.js
import { loadLocalTasks, saveLocalTasks } from "./LocalTasks";

const API_URL = "https://your-api.com";

export async function syncTasks(token) {
  if (!navigator.onLine) return;

  const tasks = loadLocalTasks();
  const updated = [];

  for (const task of tasks) {
    try {
      if (task.syncStatus === "pending") {
        await fetch(`${API_URL}/tasks/${task.id || ""}`, {
          method: task.id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(task)
        });
        updated.push({ ...task, syncStatus: "synced" });
      } else if (task.syncStatus === "deleted") {
        await fetch(`${API_URL}/tasks/${task.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        // skip pushing deleted task to updated list (removes it)
      } else {
        updated.push(task); // already synced
      }
    } catch (err) {
      console.error("Sync failed for task", task, err);
      updated.push(task); // keep task as is if sync failed
    }
  }

  saveLocalTasks(updated.filter(t => t.syncStatus !== "deleted"));
}
