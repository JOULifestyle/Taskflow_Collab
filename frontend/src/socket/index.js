// src/socket/index.js
import { io } from "socket.io-client";

let socket;

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export function createSocket(token) {
  if (socket) return socket;
  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket"], // faster & avoids polling
    withCredentials: true,
  });

  socket.on("connect", () => {
    console.log("🔌 Connected to Socket.IO server:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected from Socket.IO server");
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
