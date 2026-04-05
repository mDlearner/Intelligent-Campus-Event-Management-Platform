const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { app } = require("../src/index");

test("GET /health returns ok", async () => {
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
});

test("POST /api/auth/login rejects missing credentials", async () => {
  const response = await request(app).post("/api/auth/login").send({});
  assert.equal(response.status, 400);
  assert.match(response.body.message, /Missing email or password/i);
});

test("GET /api/events/registrations/me requires auth", async () => {
  const response = await request(app).get("/api/events/registrations/me");
  assert.equal(response.status, 401);
  assert.match(response.body.message, /Unauthorized/i);
});