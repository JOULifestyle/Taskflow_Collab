import React, { createContext, useContext, useEffect, useState } from "react";
import { createSocket, disconnectSocket, getSocket } from "../socket";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user?.token) {
      disconnectSocket();
      setSocket(null);
      return;
    }

    // create the socket instance
    const s = createSocket(user.token);

    // listen for connect event before setting
    s.on("connect", () => {
      console.log("✅ Socket connected:", s.id);
      setSocket(s);
    });

    s.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });

    // cleanup only this socket
    return () => {
      if (s) {
        s.disconnect();
      }
    };
  }, [user?.token]);

  return (
    <SocketContext.Provider value={{ socket, getSocket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
