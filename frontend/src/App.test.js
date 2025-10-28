jest.mock("react-calendar");
jest.mock("get-user-locale");

// Mock matchMedia globally before any imports
Object.defineProperty(window, 'matchMedia', {
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

// Mock service worker
const mockServiceWorker = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock navigator.serviceWorker
Object.defineProperty(window.navigator, 'serviceWorker', {
  writable: true,
  value: mockServiceWorker
});

jest.mock("./hooks/useNotificationSetup", () => ({
  useNotificationSetup: () => ({
    showNotificationBanner: false,
    showIOSInstallBanner: false,
    requestNotificationPermission: jest.fn(),
    dismissNotificationBanner: jest.fn(),
    dismissInstallBanner: jest.fn(),
  }),
}));

jest.mock("./utils/platformUtils", () => ({
  isInStandaloneMode: () => false,
  isIOS: () => false,
}));

jest.mock("./components/InstallPrompt", () => {
  return function MockInstallPrompt() {
    return null;
  };
});

import { render } from "@testing-library/react";
import App from "./App";
import { AllProviders } from "../test-utils";

test("renders app without crashing", () => {
  render(<App />, { wrapper: AllProviders });
  expect(document.body).toBeInTheDocument();
});
