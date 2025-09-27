import { useEffect } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "./useTasks";

const SOCKET_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export function useCollaborativeTasks() {
  const { token } = useAuth();
  const { setTasks } = useTasks(); // merge socket updates into local state

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => console.log("🔌 Connected to collab server"));

    // handle updates from other clients
    socket.on("task:created", (task) => {
      setTasks((prev) => [...prev, task]);
    });

    socket.on("task:updated", (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    });

    socket.on("task:deleted", (id) => {
      setTasks((prev) => prev.filter((t) => t._id !== id));
    });

    return () => socket.disconnect();
  }, [token, setTasks]);
}
