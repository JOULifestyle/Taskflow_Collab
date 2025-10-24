
import React from "react";
import { render, screen } from "@testing-library/react";
import TodoPage from "../pages/TodoPage";

//  Mock all hooks used inside TodoPage
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { _id: "1", name: "Test User" } }),
}));

jest.mock("../context/SocketProvider", () => ({
  useSocket: () => ({ socket: { emit: jest.fn(), on: jest.fn(), off: jest.fn() } }),
}));

jest.mock("../hooks/useLists", () => ({
  useLists: () => ({
    lists: [{ _id: "list1", name: "Groceries", members: [] }],
    currentList: null,
    selectList: jest.fn(),
    createList: jest.fn(),
    updateListName: jest.fn(),
    deleteList: jest.fn(),
    loading: false,
  }),
}));

jest.mock("../hooks/useTasks", () => ({
  useTasks: () => ({
    tasks: [],
    addTask: jest.fn(),
    toggleTask: jest.fn(),
    deleteTask: jest.fn(),
    startEdit: jest.fn(),
    saveEdit: jest.fn(),
    setTasks: jest.fn(),
  }),
}));

jest.mock("../hooks/useCollaborativeTasks", () => ({
  useCollaborativeTasks: jest.fn(),
}));

//  Stub browser APIs used in effects
beforeAll(() => {
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ publicKey: "mock-key" }) }));
  global.Notification = { requestPermission: jest.fn(() => Promise.resolve("granted")) };
  global.navigator.serviceWorker = { register: jest.fn(() => Promise.resolve({ pushManager: { subscribe: jest.fn() } })) };
  global.localStorage = { getItem: jest.fn(), setItem: jest.fn() };
});

describe("TodoPage", () => {
  it("renders the list view when no currentList", () => {
    render(<TodoPage />);
    expect(screen.getByText(/My Lists/i)).toBeInTheDocument();
  });
});
