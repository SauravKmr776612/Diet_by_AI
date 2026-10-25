import test from "node:test";
import assert from "node:assert/strict";
import { createServer, validateInput } from "../server.mjs";

const validInput = {
  age: 35,
  height: 168,
  heightUnit: "cm",
  weight: 68,
  weightUnit: "kg",
  activity: "moderate",
  dietaryPattern: "vegetarian",
  preferences: "Enjoys soups and grain bowls",
  allergies: "",
  conditions: "",
  goal: "balanced eating",
  consent: true
};

test("validates adult submissions and sanitizes free-text fields", () => {
  const result = validateInput({ ...validInput, preferences: "  hello\u0000 world  " });
  assert.equal(result.ok, true);
  assert.equal(result.data.preferences, "hello  world");
});

test("rejects minors and missing consent", () => {
  const result = validateInput({ ...validInput, age: 17, consent: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.age, /parent or guardian/);
  assert.match(result.errors.consent, /agree/);
});

test("rejects invalid measurement ranges and choice values", () => {
  const result = validateInput({ ...validInput, height: 20, activity: "sprint" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.height);
  assert.ok(result.errors.activity);
});

test("endpoint rejects invalid input and returns general fallback without AI configuration", async t => {
  const server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/plan`;

  const invalidResponse = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validInput, age: 17 })
  });
  assert.equal(invalidResponse.status, 400);
  assert.ok((await invalidResponse.json()).fields.age);

  const validResponse = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validInput)
  });
  const result = await validResponse.json();
  assert.equal(validResponse.status, 200);
  assert.equal(result.safeRedirect, false);
  assert.ok(result.meals.length >= 3);
  assert.match(result.disclaimer, /not medical advice/);
});

test("endpoint redirects high-risk disclosures to professional care", async t => {
  const server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validInput, conditions: "I am pregnant" })
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.safeRedirect, true);
  assert.equal(result.meals.length, 0);
  assert.match(result.safeMessage, /doctor or registered dietitian/);
});

test("static homepage is served with a restrictive content security policy", async t => {
  const server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(await response.text(), /Nourishment that/);
});

test("endpoint sends the API key only from server configuration and validates structured AI output", async t => {
  let receivedAuthorization;
  let receivedSchema;
  const aiServer = (await import("node:http")).createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    receivedAuthorization = request.headers.authorization;
    receivedSchema = body.response_format?.json_schema?.schema;
    const result = {
      summary: "A flexible vegetarian idea.",
      meals: [{ name: "Lunch", idea: "A bowl with grains and vegetables.", portion: "Adjust to appetite." }],
      limitFoods: [],
      habits: ["Keep water nearby."],
      clinician: ["Discuss individual needs with a clinician."],
      disclaimer: "Model disclaimer",
      safeRedirect: false,
      safeMessage: ""
    };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }));
  });
  await new Promise(resolve => aiServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => aiServer.close(resolve)));

  const server = createServer({
    env: {
      SERVAM_API_KEY: "server-only-test-key",
      SERVAM_API_URL: `http://127.0.0.1:${aiServer.address().port}/v1/chat/completions`,
      SERVAM_MODEL: "test-model"
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validInput)
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(receivedAuthorization, "Bearer server-only-test-key");
  assert.equal(receivedSchema.type, "object");
  assert.match(result.disclaimer, /not medical advice/);
});
