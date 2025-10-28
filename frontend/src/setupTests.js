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

// Ensure window and navigator are defined
global.window = Object.create(window);
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost',
  },
});

beforeAll(() => {
  Object.defineProperty(document, "hidden", { value: false, writable: true });
  global.Notification = jest.fn();
  global.Notification.permission = "granted";
  global.Notification.requestPermission = jest.fn(() => Promise.resolve("granted"));

  // Mock matchMedia directly on window
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  // Mock navigator if needed
  if (!window.navigator) {
    window.navigator = {};
  }

  Object.defineProperty(window.navigator, 'standalone', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock standalone mode checks
  Object.defineProperty(window.navigator, 'standalone', {
    writable: true,
    value: false,
  });

  // Mock document.referrer
  Object.defineProperty(document, 'referrer', {
    value: '',
    writable: true,
  });
});

process.env.TZ = 'Africa/Lagos';

