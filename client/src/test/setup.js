import "@testing-library/jest-dom/vitest";

class MockIntersectionObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.IntersectionObserver = MockIntersectionObserver;
