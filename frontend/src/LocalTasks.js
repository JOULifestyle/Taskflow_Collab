// localTasks.js
export function loadLocalTasks() {
  const saved = localStorage.getItem("tasks");
  return saved ? JSON.parse(saved) : [];
}

export function saveLocalTasks(tasks) {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}
