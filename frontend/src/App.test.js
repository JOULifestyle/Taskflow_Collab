jest.mock("react-calendar");
jest.mock("get-user-locale");


import { render } from "@testing-library/react";
import App from "./App";
import { AllProviders } from "../test-utils";

test("renders app without crashing", () => {
  render(<App />, { wrapper: AllProviders });
  expect(document.body).toBeInTheDocument();
});
