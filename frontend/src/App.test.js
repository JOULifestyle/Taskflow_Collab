jest.mock("react-calendar");
jest.mock("get-user-locale");

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

import { render } from "@testing-library/react";
import App from "./App";
import { AllProviders } from "../test-utils";

test("renders app without crashing", () => {
  render(<App />, { wrapper: AllProviders });
  expect(document.body).toBeInTheDocument();
});
