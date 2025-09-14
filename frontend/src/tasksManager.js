// tasksManager.js
import { loadLocalTasks, saveLocalTasks } from "./LocalTasks";

export function addTask(task) {
  const tasks = loadLocalTasks();
  tasks.push({ ...task, syncStatus: "pending" });
  saveLocalTasks(tasks);
}

export function updateTask(updatedTask) {
  const tasks = loadLocalTasks().map(t =>
    t.id === updatedTask.id
      ? { ...updatedTask, syncStatus: "pending" }
      : t
  );
  saveLocalTasks(tasks);
}

export function deleteTask(id) {
  const tasks = loadLocalTasks().map(t =>
    t.id === id ? { ...t, syncStatus: "deleted" } : t
  );
  saveLocalTasks(tasks);
}
