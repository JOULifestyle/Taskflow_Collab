
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./src/context/AuthContext";
import { SocketProvider } from "./src/context/SocketProvider";

// Combined wrapper for tests 
export const AllProviders = ({ children }) => (
  <AuthProvider>
    <SocketProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </SocketProvider>
  </AuthProvider>
);
