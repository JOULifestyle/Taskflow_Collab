

// Format ISO string for display in task list
export const formatDueDate = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return ""; // handle invalid dates
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  return d.toLocaleString("en-US", options); // use US locale for consistent testing
};

// Format date to datetime-local for inputs
export const formatDateForInput = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return ""; // handle invalid dates
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000); // shift to local
  return local.toISOString().slice(0, 16);
};

// Convert base64 string to Uint8Array
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}