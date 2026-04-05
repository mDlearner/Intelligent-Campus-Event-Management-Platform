import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Events from "../Events.jsx";

const invalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries })
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()]
}));

vi.mock("../../lib/auth.js", () => ({
  getAuth: () => ({ user: { role: "student" } }),
  getToken: () => "test-token"
}));

vi.mock("../../lib/api.js", () => ({
  fetchEventsPaginated: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  registerForEvent: vi.fn()
}));

describe("Events page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders skeleton state while loading", async () => {
    const { useInfiniteQuery } = await import("@tanstack/react-query");
    useInfiniteQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: null
    });

    const { container } = render(<Events />);

    expect(screen.getByText("Events & Registrations")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows load more button when next page exists", async () => {
    const { useInfiniteQuery } = await import("@tanstack/react-query");
    useInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              {
                _id: "evt-1",
                title: "Test Event",
                description: "desc",
                date: "2099-01-01",
                startTime: "10:00",
                endTime: "11:00",
                venue: "Hall A",
                categories: ["Workshop"],
                registrationOpen: true,
                maxSeats: 10,
                seatsRemaining: 9,
                status: "upcoming"
              }
            ]
          }
        ]
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
      error: null
    });

    render(<Events />);

    expect(screen.getByRole("button", { name: /Load more events/i })).toBeInTheDocument();
  });
});
