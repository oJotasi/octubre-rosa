import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";

// Execute the actual API and its SQL against SQLite, the engine used by D1.
const bundle = await build({ entryPoints: ["lib/api.ts"], bundle: true, write: false, platform: "node", format: "esm", plugins: [{ name: "test-d1", setup(builder) {
  builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "test" }));
  builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const env = globalThis.__gameTestEnv;" }));
} }] });
globalThis.__gameTestEnv = {};
const { handleApi } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
let sqlite;
const sessionHeaders = new Map();
function statement(query, args = []) {
  return {
    query, args,
    bind(...values) { return statement(query, values); },
    async first() { return sqlite.prepare(query).get(...args) || null; },
    async run() { return sqlite.prepare(query).run(...args); },
  };
}
beforeEach(() => {
  globalThis.__gameTestEnv.GAME_FRONTEND_ORIGIN = "https://ojotasi.github.io";
  sessionHeaders.clear();
  globalThis.__gameTestEnv.STATS_ACCESS_TOKEN = "a".repeat(64);
  sqlite?.close(); sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle").filter(f => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  globalThis.__gameTestEnv.DB = { prepare: statement, async batch(items) {
    sqlite.exec("BEGIN");
    try { for (const item of items) sqlite.prepare(item.query).run(...item.args); sqlite.exec("COMMIT"); }
    catch (e) { sqlite.exec("ROLLBACK"); throw e; }
    return [];
  } };
});
after(() => sqlite.close());
async function call(action, body = {}, headers = {}) {
  const identity = action === "start" && !headers.Cookie && !headers["oai-authenticated-user-id"] ? { "oai-authenticated-user-id": crypto.randomUUID() } : sessionHeaders.get(body.sessionId) || {};
  const requestHeaders = { "Content-Type": "application/json", ...identity, ...headers };
  const response = await handleApi(new Request(`https://game.test/api/${action}`, { method: action === "stats" ? "GET" : "POST", headers: requestHeaders, ...(action === "stats" ? {} : { body: JSON.stringify(body) }) }), action);
  const data = await response.json();
  if (action === "start" && data.game) sessionHeaders.set(data.game.sessionId, requestHeaders);
  return { status: response.status, data };
}
const stats = () => call("stats", {}, { Authorization: `Bearer ${"a".repeat(64)}` });
const start = async () => (await call("start")).data.game;
test("GitHub Pages preflight allows only game requests from the configured origin", async () => {
  const headers = { Origin: "https://ojotasi.github.io", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-game-page" };
  const preflight = h => handleApi(new Request("https://game.test/api/start", { method: "OPTIONS", headers: h }), "start");
  const response = await preflight(headers);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), headers.Origin);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  assert.equal((await preflight({ ...headers, Origin: "https://other.test" })).status, 403);
  assert.equal((await preflight({ ...headers, "Access-Control-Request-Headers": "authorization" })).status, 403);
  assert.equal((await call("stats", {}, { Origin: headers.Origin, Authorization: `Bearer ${"a".repeat(64)}` })).status, 200);
});
test("GitHub statistics require the secret token and allow only authenticated GET preflight", async () => {
  const origin = "https://ojotasi.github.io";
  const headers = { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" };
  const preflight = h => handleApi(new Request("https://game.test/api/stats", { method: "OPTIONS", headers: h }), "stats");
  const allowed = await preflight(headers);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(allowed.headers.get("Access-Control-Allow-Headers"), "authorization");
  assert.equal(allowed.headers.get("Access-Control-Allow-Credentials"), null);
  assert.equal((await preflight({ ...headers, "Access-Control-Request-Method": "POST" })).status, 403);
  assert.equal((await preflight({ ...headers, Origin: "https://other.test" })).status, 403);
  for (const authorization of ["", `Bearer ${"b".repeat(64)}`, `Bearer ${"a".repeat(64)}`]) {
    const response = await handleApi(new Request("https://game.test/api/stats", { headers: { Origin: origin, Authorization: authorization } }), "stats");
    assert.equal(response.status, authorization === `Bearer ${"a".repeat(64)}` ? 200 : 401);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  }
});
test("GitHub Pages games work without cookies, retain ownership and finish once", async () => {
  const headers = { Origin: "https://ojotasi.github.io", "X-Game-Page": crypto.randomUUID() };
  const external = async (action, input = {}, h = headers) => {
    const response = await handleApi(new Request(`https://game.test/api/${action}`, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify(input) }), action);
    assert.equal(response.headers.get("Set-Cookie"), null);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), headers.Origin);
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await external("attempt")).data.attempt, null);
  const game = (await external("start")).data.game;
  assert.equal((await external("start")).data.game.sessionId, game.sessionId);
  assert.equal((await external("answer", { sessionId: game.sessionId, questionIndex: 0, optionIndex: 0 }, { ...headers, "X-Game-Page": crypto.randomUUID() })).status, 403);
  for (let i = 0; i < 3; i++) assert.equal((await external("answer", { sessionId: game.sessionId, questionIndex: i, optionIndex: 0 })).status, 200);
  const input = { sessionId: game.sessionId, answers: [0, 0, 0] };
  const finished = await external("finish", input);
  assert.equal(finished.status, 200);
  assert.deepEqual(await external("finish", input), finished);
  assert.equal((await stats()).data.total, 1);
  assert.equal((await external("attempt", {}, { ...headers, "X-Game-Page": crypto.randomUUID() })).data.attempt, null);
});
const correctText = { hombres: "Sí.", deteccion: "Porque permite iniciar una evaluación y tratamiento oportunos.", mes: "Octubre." };
function answersFor(game, score) { return game.questions.map((q, i) => { const correct = q.options.indexOf(correctText[q.id]); return i < score ? correct : (correct + 1) % 3; }); }
async function answerAll(game, answers) {
  for (let questionIndex = 0; questionIndex < 3; questionIndex++) {
    const response = await call("answer", { sessionId: game.sessionId, questionIndex, optionIndex: answers[questionIndex] });
    assert.equal(response.status, 200);
  }
}

test("start returns exactly 3 shuffled questions, never their answers or explanations", async () => {
  const orders = new Set();
  for (let i = 0; i < 16; i++) {
    const game = await start(); assert.equal(game.questions.length, 3);
    assert.equal(new Set(game.questions.map(q => q.id)).size, 3);
    for (const q of game.questions) { assert.equal(q.options.length, 3); assert.deepEqual(Object.keys(q).sort(), ["id", "options", "text"]); }
    orders.add(JSON.stringify(game.questions));
  }
  assert.ok(orders.size > 1); assert.equal((await stats()).data.total, 0);
});
test("unfinished games and locked answers do not increase statistics", async () => {
  const game = await start();
  await call("answer", { sessionId: game.sessionId, questionIndex: 0, optionIndex: 1 });
  assert.equal((await stats()).data.total, 0);
  assert.equal((await call("finish", { sessionId: game.sessionId, answers: [1, 0, 0] })).status, 409);
});
test("each of 0/3, 1/3, 2/3 and 3/3 is scored on the server, ignoring forged score", async () => {
  for (let score = 0; score <= 3; score++) {
    const game = await start(), answers = answersFor(game, score);
    await answerAll(game, answers);
    const response = await call("finish", { sessionId: game.sessionId, answers, is_correct: true, correctCount: 3 });
    assert.equal(response.status, 200); assert.equal(response.data.correctCount, score); assert.equal(response.data.isCorrect, score === 3);
  }
  assert.deepEqual((await stats()).data, { total: 4, correct: 1, incorrect: 3, correctPercentage: 25 });
});
test("answers lock before feedback; same answer can be retried, different answer rejected", async () => {
  const game = await start(); const body = { sessionId: game.sessionId, questionIndex: 0, optionIndex: 0 };
  const initial = await call("answer", body); assert.equal(typeof initial.data.correctIndex, "number");
  assert.deepEqual(await call("answer", body), initial);
  assert.equal((await call("answer", { ...body, optionIndex: 1 })).status, 409);
  assert.equal((await call("answer", { ...body, questionIndex: 2 })).status, 409);
});
test("concurrent selections lock exactly one answer", async () => {
  const game = await start();
  const responses = await Promise.all([0,1,2].map(optionIndex => call("answer", { sessionId: game.sessionId, questionIndex: 0, optionIndex })));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 2);
});
test("concurrent finish and lost-response retry count exactly one completed game", async () => {
  const game = await start(), answers = answersFor(game, 3); await answerAll(game, answers);
  const requests = await Promise.all(Array.from({ length: 10 }, () => call("finish", { sessionId: game.sessionId, answers })));
  for (const response of requests) assert.deepEqual(response, requests[0]);
  assert.equal((await stats()).data.total, 1);
  sqlite.prepare("UPDATE game_sessions SET expires_at = 0 WHERE id = ?").run(game.sessionId);
  assert.deepEqual(await call("finish", { sessionId: game.sessionId, answers }), requests[0]);
});
test("multiple devices have independent sessions and shared totals", async () => {
  const [a, b] = await Promise.all([start(), start()]); assert.notEqual(a.sessionId, b.sessionId);
  for (const game of [a, b]) { const answers = answersFor(game, 3); await answerAll(game, answers); await call("finish", { sessionId: game.sessionId, answers }); }
  assert.equal((await stats()).data.total, 2);
});
test("expired sessions are rejected and never counted", async () => {
  const game = await start(), answers = answersFor(game, 3); await answerAll(game, answers);
  sqlite.prepare("UPDATE game_sessions SET expires_at = 0 WHERE id = ?").run(game.sessionId);
  assert.equal((await call("finish", { sessionId: game.sessionId, answers })).status, 410);
  assert.equal((await stats()).data.total, 0);
});
test("invalid IDs, malformed bodies, invalid indexes and mismatched final answers are rejected", async () => {
  assert.equal((await call("answer", { sessionId: "bad" })).status, 400);
  const game = await start();
  for (const index of [-1, 3, 1.5, "0", null]) assert.equal((await call("answer", { sessionId: game.sessionId, questionIndex: 0, optionIndex: index })).status, 400);
  const answers = answersFor(game, 3); await answerAll(game, answers);
  assert.equal((await call("finish", { sessionId: game.sessionId, answers: [0] })).status, 400);
  assert.equal((await call("finish", { sessionId: game.sessionId, answers: answers.map(a => (a + 1) % 3) })).status, 409);
  assert.equal((await stats()).data.total, 0);
});
test("stats require the secret link; cross-origin writes and oversized bodies are blocked", async () => {
  assert.equal((await call("stats")).status, 401);
  assert.equal((await call("start", {}, { Origin: "https://other.test" })).status, 403);
  assert.equal((await call("start", { padding: "x".repeat(2500) })).status, 413);
});
test("start rate is bounded per connection without storing IP addresses", async () => {
  for (let i = 0; i < 60; i++) assert.equal((await call("start")).status, 201);
  assert.equal((await call("start")).status, 429);
  const key = sqlite.prepare("SELECT key FROM rate_limits").get().key;
  assert.match(key, /^[0-9a-f]{64}$/);
});

test("stats accept the secret link without accounts, and reject account identity alone", async () => {
  const other = await call("stats", {}, { "oai-authenticated-user-id": "participant", "oai-authenticated-user-email": "other@example.test" });
  assert.equal(other.status, 401);
  assert.equal((await stats()).status, 200);
  delete globalThis.__gameTestEnv.STATS_ACCESS_TOKEN;
  assert.equal((await stats()).status, 401);
});

test("wrong, truncated and malformed stats tokens never reveal counts", async () => {
  for (const token of ["b".repeat(64), "a".repeat(63), "a".repeat(65), "not-a-token"]) {
    const response = await call("stats", {}, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 401); assert.equal(response.data.total, undefined);
  }
  const response = await handleApi(new Request(`https://game.test/api/stats?acceso=${"a".repeat(64)}`), "stats");
  assert.equal(response.status, 401);
});

test("one account keeps exactly one attempt before and after completion", async () => {
  const identity = { "oai-authenticated-user-id": "single-participant" };
  const initial = await call("start", {}, identity); const game = initial.data.game;
  assert.equal(initial.status, 201);
  const again = await call("start", {}, identity);
  assert.equal(again.status, 200); assert.equal(again.data.game.sessionId, game.sessionId);
  const answers = answersFor(game, 2); await answerAll(game, answers);
  const finished = await call("finish", { sessionId: game.sessionId, answers });
  const after = await call("start", {}, identity);
  assert.equal(after.status, 200); assert.deepEqual(after.data.result, finished.data);
  const restored = await call("attempt", {}, identity);
  assert.deepEqual(restored.data.attempt.result, finished.data);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM game_sessions").get().total, 1);
  assert.equal((await stats()).data.total, 1);
});

test("simultaneous starts in different tabs allocate one attempt", async () => {
  const identity = { "oai-authenticated-user-id": "concurrent-participant" };
  const responses = await Promise.all(Array.from({ length: 8 }, () => call("start", {}, identity)));
  assert.equal(new Set(responses.map(r => r.data.game.sessionId)).size, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM game_sessions").get().total, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM attempt_claims").get().total, 1);
});

test("clearing local game state or using another browser with the same account resumes locked answers", async () => {
  const identity = { "oai-authenticated-user-id": "same-account" };
  const game = (await call("start", {}, identity)).data.game;
  await call("answer", { sessionId: game.sessionId, questionIndex: 0, optionIndex: 1 });
  const restored = await call("attempt", {}, identity);
  assert.equal(restored.data.attempt.game.sessionId, game.sessionId);
  assert.equal(restored.data.attempt.answers[0], 1);
  assert.ok(restored.data.attempt.feedback[0]);
  assert.equal(restored.data.attempt.feedback[1], null);
  const restarted = await call("start", {}, identity);
  assert.equal(restarted.data.answers[0], 1);
});

test("an expired attempt cannot allocate a new game", async () => {
  const identity = { "oai-authenticated-user-id": "expired-participant" };
  const game = (await call("start", {}, identity)).data.game;
  sqlite.prepare("UPDATE game_sessions SET expires_at = 0 WHERE id = ?").run(game.sessionId);
  assert.equal((await call("start", {}, identity)).status, 410);
  assert.equal((await call("attempt", {}, identity)).data.expired, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM game_sessions").get().total, 1);
});

test("another participant cannot answer, finish or adopt a claimed session", async () => {
  const game = await start(); const other = { "oai-authenticated-user-id": "another-participant" };
  assert.equal((await call("answer", { sessionId: game.sessionId, questionIndex: 0, optionIndex: 0 }, other)).status, 403);
  assert.equal((await call("finish", { sessionId: game.sessionId, answers: [0,0,0] }, other)).status, 403);
  assert.equal((await call("attempt", { sessionId: game.sessionId }, other)).data.attempt, null);
});

test("anonymous visitors receive a persistent HttpOnly cookie and keep one attempt", async () => {
  const init = await handleApi(new Request("https://game.test/api/attempt", { method: "POST", body: "{}" }), "attempt");
  const setCookie = init.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Lax/);
  const identity = { Cookie: setCookie.split(";")[0] };
  const first = await call("start", {}, identity);
  const second = await call("start", {}, identity);
  assert.equal(first.data.game.sessionId, second.data.game.sessionId);
  assert.equal((await call("attempt", {}, identity)).data.attempt.game.sessionId, first.data.game.sessionId);
  const withoutCookie = await handleApi(new Request("https://game.test/api/start", { method: "POST", body: "{}" }), "start");
  assert.equal(withoutCookie.status, 409);
});

test("an existing game is adopted once during the upgrade without resetting its answers", async () => {
  const game = await start();
  await call("answer", { sessionId: game.sessionId, questionIndex: 0, optionIndex: 2 });
  sqlite.prepare("DELETE FROM attempt_claims WHERE session_id = ?").run(game.sessionId);
  const identity = { "oai-authenticated-user-id": "legacy-participant" };
  const recovered = await call("attempt", { sessionId: game.sessionId }, identity);
  assert.equal(recovered.data.attempt.answers[0], 2);
  assert.equal((await call("start", {}, identity)).data.game.sessionId, game.sessionId);
});

test("a page reload allows a fresh attempt without duplicating the completed game", async () => {
  const browser = { Cookie: `octubre_rosa_attempt=${crypto.randomUUID()}` };
  const firstPage = { ...browser, "X-Game-Page": crypto.randomUUID() };
  const game = (await call("start", {}, firstPage)).data.game;
  const answers = answersFor(game, 3); await answerAll(game, answers);
  await call("finish", { sessionId: game.sessionId, answers });
  const samePage = await call("start", {}, firstPage);
  assert.equal(samePage.data.game.sessionId, game.sessionId);
  assert.ok(samePage.data.result);
  const reloadedPage = { ...browser, "X-Game-Page": crypto.randomUUID() };
  assert.equal((await call("attempt", {}, reloadedPage)).data.attempt, null);
  const fresh = await call("start", {}, reloadedPage);
  assert.equal(fresh.status, 201); assert.notEqual(fresh.data.game.sessionId, game.sessionId);
  assert.deepEqual(fresh.data.answers, [null, null, null]); assert.equal(fresh.data.result, null);
  assert.equal((await stats()).data.total, 1);
  assert.equal((await call("finish", { sessionId: game.sessionId, answers }, firstPage)).status, 200);
  assert.equal((await stats()).data.total, 1);
});

test("a new page session is not blocked by a previous account attempt", async () => {
  const account = { "oai-authenticated-user-id": "returning-user" };
  const previous = (await call("start", {}, account)).data.game;
  const page = { ...account, "X-Game-Page": crypto.randomUUID() };
  const responses = await Promise.all(Array.from({ length: 5 }, () => call("start", {}, page)));
  assert.equal(new Set(responses.map(r => r.data.game.sessionId)).size, 1);
  assert.notEqual(responses[0].data.game.sessionId, previous.sessionId);
  assert.equal((await call("answer", { sessionId: previous.sessionId, questionIndex: 0, optionIndex: 0 }, page)).status, 403);
  assert.equal((await call("start", {}, { ...account, "X-Game-Page": "invalid" })).status, 400);
});
