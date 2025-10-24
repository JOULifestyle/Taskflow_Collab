// Load DOM matchers
import "@testing-library/jest-dom";

//  Mock react-calendar (bypass ESM import)
jest.mock("react-calendar", () => () => <div data-testid="mock-calendar">Mock Calendar</div>);

// Mock get-user-locale
jest.mock("get-user-locale", () => jest.fn(() => "en-US"));

//  Mock react-router-dom navigate
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

//  Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

//  Mock fetch and localStorage globally
global.fetch = jest.fn();

global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};


beforeAll(() => {
  Object.defineProperty(document, "hidden", { value: false, writable: true });
  global.Notification = jest.fn();
  global.Notification.permission = "granted";
  global.Notification.requestPermission = jest.fn(() => Promise.resolve("granted"));
});
