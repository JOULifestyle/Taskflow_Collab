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

    const s = createSocket(user.token);
    setSocket(s);

    return () => {
      disconnectSocket();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, getSocket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
