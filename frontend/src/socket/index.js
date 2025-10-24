import { io } from "socket.io-client";

let socket;

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export function createSocket(token) {
  if (socket) return socket;

  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket"], // skip polling for faster connection
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  //  Connection lifecycle 
  socket.on("connect", () => {
   
  });

  socket.on("disconnect", (reason) => {
    
  });

  socket.on("connect_error", (err) => {
    
  });

  //  Global error handler from server 
  socket.on("error", (err) => {
    console.error("🚨 Socket error event:", err);
  });

  return socket;
}

export function getSocket() {
  return socket || null;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

//  Helper: subscribe/unsubscribe to a list room 
export function joinList(listId) {
  if (socket && listId) {
    socket.emit("join-list", listId);
  }
}

export function leaveList(listId) {
  if (socket && listId) {
    socket.emit("leave-list", listId);
  }
}

// NEW: listen for member updates/removals 
export function onMemberEvents({ onShared, onRemoved }) {
  if (!socket) return;

  if (onShared) {
    socket.on("list:shared", ({ listId, userId, role }) => {
      onShared({ listId, userId, role });
    });
  }

  if (onRemoved) {
    socket.on("list:memberRemoved", ({ listId, userId }) => {
      onRemoved({ listId, userId });
    });
  }
}

//  helper to cleanup listeners when leaving modal/page 
export function offMemberEvents() {
  if (!socket) return;
  socket.off("list:shared");
  socket.off("list:memberRemoved");
}
