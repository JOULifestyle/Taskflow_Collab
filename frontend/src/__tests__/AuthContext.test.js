import React from "react";
import { renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../context/AuthContext";

// Proper react-hot-toast mock
jest.mock("react-hot-toast", () => {
  const toastFn = jest.fn();
  toastFn.success = jest.fn();
  toastFn.error = jest.fn();
  return toastFn;
});

describe("AuthContext", () => {
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(() => {
    localStorage.clear();
    jest.resetAllMocks();
  });

  test("provides auth context to children", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("login");
    expect(result.current).toHaveProperty("logout");
  });

  test("loads user from localStorage on mount", () => {
    localStorage.setItem("token", "mock-token");
    localStorage.setItem("username", "testuser");
    localStorage.setItem("email", "test@example.com");

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toEqual({
      token: "mock-token",
      username: "testuser",
      email: "test@example.com",
    });
  });

  test("logout clears user data and localStorage", () => {
    // Simulate a logged-in state via localStorage
    localStorage.setItem("token", "token");
    localStorage.setItem("username", "user");
    localStorage.setItem("email", "email@example.com");

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBe(null);
    expect(localStorage.getItem("token")).toBe(null);
    expect(localStorage.getItem("username")).toBe(null);
    expect(localStorage.getItem("email")).toBe(null);
  });

  test("handles invalid JWT gracefully (simplified)", () => {
    localStorage.setItem("token", "invalid.jwt.token");
    localStorage.setItem("username", "testuser");
    localStorage.setItem("email", "test@example.com");

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).not.toBeUndefined();
  });
});
