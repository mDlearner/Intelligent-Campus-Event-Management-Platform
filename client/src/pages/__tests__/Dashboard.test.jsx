import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Dashboard from "../Dashboard.jsx";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() })
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn()
}));

vi.mock("../../lib/auth.js", () => ({
  getAuth: () => ({ user: { role: "student", name: "Test User" } }),
  getToken: () => "test-token"
}));

describe("Dashboard page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders registration skeleton cards while loading", async () => {
    const { useQuery } = await import("@tanstack/react-query");
    useQuery.mockReturnValue({
      data: undefined,
      isLoading: true
    });

    const { container } = render(<Dashboard />);

    expect(screen.getByText("My Registered Events")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
