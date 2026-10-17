import { env } from "cloudflare:workers";
import { createQuestionOrder, publicQuestions, feedbackFor, scoreAnswers, QUESTION_SET_VERSION, type OrderedQuestion } from "./questions";
import { hasStatsAccess } from "./access";
import type { SavedGame } from "./types";
class ApiError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_ERROR", public feedback?: ReturnType<typeof feedbackFor>) { super(message); }
}
type Session = {
  id: string; question_set_version: string; questions: string;
  answer_0: number | null; answer_1: number | null; answer_2: number | null;
  expires_at: number; completed_at: number | null; correct_count: number | null; is_correct: number | null;
};
function db() {
  if (!env.DB) throw new ApiError(503, "El servicio todavía no está disponible. Intentá nuevamente.");
  return env.DB;
}
function json(value: unknown, status = 200, cookie?: string) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}
async function participant(request: Request, initialize = false) {
  const page = request.headers.get("x-game-page");
  if (page !== null && !/^[0-9a-f-]{36}$/.test(page)) throw new ApiError(400, "La sesión de la página no es válida.");
  if (externalFrontend(request)) {
    if (!page) throw new ApiError(400, "Falta la sesión de la página.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`octubre-rosa:2026:external-page:${page}`));
    return { key: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""), cookie: undefined };
  }
  const account = request.headers.get("oai-authenticated-user-id");
  let token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith("octubre_rosa_attempt="))?.split("=")[1];
  let cookie: string | undefined;
  if (!account && (!token || !/^[0-9a-f-]{36}$/.test(token))) {
    if (!initialize) throw new ApiError(409, "Volvé a cargar la página para recuperar tu intento.", "COOKIE_REQUIRED");
    token = crypto.randomUUID();
    cookie = `octubre_rosa_attempt=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  }
  // New page loads have independent attempts; repeated requests in one page do not.
  // Missing headers retain compatibility with previously allocated sessions.
  const scope = page ? `:page:${page}` : "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`octubre-rosa:2026:${account ? `account:${account}` : `browser:${token}`}${scope}`));
  return { key: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""), cookie };
}
async function claimedSession(key: string) {
  return db().prepare("SELECT g.* FROM game_sessions g JOIN attempt_claims a ON a.session_id = g.id WHERE a.participant_key = ?").bind(key).first<Session>();
}
function snapshot(row: Session): SavedGame {
  const questions: OrderedQuestion[] = JSON.parse(row.questions);
  const answers = savedAnswers(row);
  const unanswered = answers.findIndex(a => a === null);
  return {
    game: { sessionId: row.id, questions: publicQuestions(questions), expiresAt: row.expires_at }, answers,
    feedback: answers.map((a, i) => a === null ? null : feedbackFor(questions[i], a)),
    index: unanswered < 0 ? 2 : unanswered, result: row.completed_at === null ? null : { sessionId: row.id, correctCount: row.correct_count!, isCorrect: row.is_correct === 1, completedAt: row.completed_at }, finishing: false,
  };
}
function hasExpired(row: Session) { return row.question_set_version !== QUESTION_SET_VERSION || (row.completed_at === null && row.expires_at <= Date.now()); }
async function body(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 2048) throw new ApiError(413, "La solicitud es demasiado grande.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Faltan los datos de la partida.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new ApiError(413, "La solicitud es demasiado grande."); }
    chunks.push(value);
  }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(data));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new ApiError(400, "Los datos enviados no son válidos."); }
}
async function loadSession(id: unknown): Promise<Session> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new ApiError(400, "La partida no es válida.");
  const row = await db().prepare("SELECT * FROM game_sessions WHERE id = ?").bind(id).first<Session>();
  if (!row) throw new ApiError(404, "No encontramos esta partida.", "SESSION_MISSING");
  if (hasExpired(row)) throw new ApiError(410, "El plazo de tu intento terminó.", "SESSION_EXPIRED");
  return row;
}
function savedAnswers(row: Session) { return [row.answer_0, row.answer_1, row.answer_2]; }
function savedResult(row: Session) { return { sessionId: row.id, correctCount: row.correct_count, isCorrect: row.is_correct === 1, completedAt: row.completed_at }; }
async function limitStarts(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") || "local-preview";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`octubre-rosa:${ip}:${Math.floor(Date.now() / 3600000)}`));
  const key = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
  const row = await db().prepare("INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count")
    .bind(key, Date.now() + 3600000).first<{ count: number }>();
  if (row && row.count > 60) throw new ApiError(429, "Se iniciaron muchas partidas desde esta conexión. Intentá más tarde.", "RATE_LIMIT");
}
type Action = "attempt" | "start" | "answer" | "finish" | "stats";
function externalFrontend(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin !== new URL(request.url).origin && origin === env.GAME_FRONTEND_ORIGIN);
}
export async function handleApi(request: Request, action: Action) {
  const origin = request.headers.get("origin");
  const external = externalFrontend(request);
  if (origin && origin !== new URL(request.url).origin && !external) return json({ error: "La solicitud no está permitida." }, 403);
  let response: Response;
  if (request.method === "OPTIONS") {
    const headers = (request.headers.get("access-control-request-headers") || "").split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
    const method = action === "stats" ? "GET" : "POST";
    const allowedHeaders = action === "stats" ? ["authorization"] : ["content-type", "x-game-page"];
    if (!external || request.headers.get("access-control-request-method") !== method || headers.some(h => !allowedHeaders.includes(h))) return json({ error: "La solicitud no está permitida." }, 403);
    response = new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": method, "Access-Control-Allow-Headers": allowedHeaders.join(", "), "Access-Control-Max-Age": "600" } });
  } else response = await dispatch(request, action);
  if (external) {
    response.headers.set("Access-Control-Allow-Origin", origin!);
    response.headers.set("Vary", "Origin");
  }
  return response;
}
async function dispatch(request: Request, action: Action) {
  try {
    if (request.method !== (action === "stats" ? "GET" : "POST")) return json({ error: "Método no permitido." }, 405);
    if (action === "stats") {
      if (!hasStatsAccess(request.headers)) throw new ApiError(401, "El enlace de estadísticas no es válido.", "INVALID_STATS_LINK");
      const totals = await db().prepare("SELECT COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct FROM game_sessions WHERE completed_at IS NOT NULL").first<{ total: number; correct: number }>();
      const total = Number(totals?.total || 0), correct = Number(totals?.correct || 0);
      return json({ total, correct, incorrect: total - correct, correctPercentage: total ? Math.round(correct / total * 1000) / 10 : 0 });
    }
    const input = await body(request);
    if ((action === "answer" || action === "finish") && (typeof input.sessionId !== "string" || !/^[0-9a-f-]{36}$/.test(input.sessionId))) throw new ApiError(400, "La partida no es válida.");
    const identity = await participant(request, action === "attempt");
    if (action === "attempt") {
      let row = await claimedSession(identity.key);
      // Adopt an existing pre-upgrade game through its unguessable session capability.
      // Both columns are unique, so migration can never allocate a second attempt.
      if (!row && typeof input.sessionId === "string" && /^[0-9a-f-]{36}$/.test(input.sessionId)) {
        await db().prepare("INSERT OR IGNORE INTO attempt_claims (participant_key, session_id) SELECT ?, id FROM game_sessions WHERE id = ?")
          .bind(identity.key, input.sessionId).run();
        row = await claimedSession(identity.key);
      }
      return json({ attempt: row && !hasExpired(row) ? snapshot(row) : null, expired: Boolean(row && hasExpired(row)) }, 200, identity.cookie);
    }
    if (action === "start") {
      const previous = await claimedSession(identity.key);
      if (previous) {
        if (hasExpired(previous)) throw new ApiError(410, "El plazo de tu intento terminó.", "SESSION_EXPIRED");
        return json(snapshot(previous));
      }
      await limitStarts(request);
      const questions = createQuestionOrder(); const sessionId = crypto.randomUUID();
      const now = Date.now(); const expiresAt = now + 24 * 3600000;
      await db().batch([
        db().prepare("DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE reset_at < ? LIMIT 100)").bind(now),
        db().prepare("INSERT INTO game_sessions (id, question_set_version, questions, created_at, expires_at) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM attempt_claims WHERE participant_key = ?)").bind(sessionId, QUESTION_SET_VERSION, JSON.stringify(questions), now, expiresAt, identity.key),
        db().prepare("INSERT OR IGNORE INTO attempt_claims (participant_key, session_id) VALUES (?, ?)").bind(identity.key, sessionId),
      ]);
      const created = await claimedSession(identity.key);
      if (!created) throw new Error("Attempt claim missing after transaction");
      return json(snapshot(created), created.id === sessionId ? 201 : 200);
    }
    let row = await loadSession(input.sessionId);
    const owner = await db().prepare("SELECT participant_key FROM attempt_claims WHERE session_id = ?").bind(row.id).first<{ participant_key: string }>();
    if (!owner || owner.participant_key !== identity.key) throw new ApiError(403, "Esta partida pertenece a otra sesión.", "FORBIDDEN");
    const questions: OrderedQuestion[] = JSON.parse(row.questions);
    if (action === "answer") {
      const questionIndex = input.questionIndex, optionIndex = input.optionIndex;
      if (typeof questionIndex !== "number" || !Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 2 || typeof optionIndex !== "number" || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 2) throw new ApiError(400, "Elegí una de las tres opciones.");
      const answers = savedAnswers(row);
      if (answers[questionIndex] !== null) {
        if (answers[questionIndex] !== optionIndex) throw new ApiError(409, "Esta respuesta ya fue confirmada y no se puede cambiar.", "ANSWER_LOCKED", feedbackFor(questions[questionIndex], answers[questionIndex]!));
        return json(feedbackFor(questions[questionIndex], optionIndex));
      }
      if (questionIndex > 0 && answers[questionIndex - 1] === null) throw new ApiError(409, "Primero respondé la pregunta anterior.");
      const column = ["answer_0", "answer_1", "answer_2"][questionIndex];
      const predecessor = questionIndex > 0 ? `AND answer_${questionIndex - 1} IS NOT NULL` : "";
      const changed = await db().prepare(`UPDATE game_sessions SET ${column} = ? WHERE id = ? AND ${column} IS NULL AND completed_at IS NULL AND expires_at > ? ${predecessor} RETURNING id`).bind(optionIndex, row.id, Date.now()).first();
      if (!changed) {
        row = await loadSession(row.id);
        if (savedAnswers(row)[questionIndex] !== optionIndex) throw new ApiError(409, "Esta respuesta ya fue confirmada.", "ANSWER_LOCKED", feedbackFor(questions[questionIndex], savedAnswers(row)[questionIndex]!));
      }
      return json(feedbackFor(questions[questionIndex], optionIndex));
    }
    // Recompute from locked answers; ignore all client score fields.
    const answers = input.answers;
    if (!Array.isArray(answers) || answers.length !== 3 || answers.some(a => !Number.isInteger(a) || a < 0 || a > 2)) throw new ApiError(400, "Completá las tres preguntas antes de finalizar.");
    if (answers.some((a, i) => a !== savedAnswers(row)[i])) throw new ApiError(409, "Las respuestas no coinciden con las confirmadas.");
    if (row.completed_at !== null) return json(savedResult(row));
    const result = scoreAnswers(questions, answers);
    const updated = await db().prepare("UPDATE game_sessions SET correct_count = ?, is_correct = ?, completed_at = ? WHERE id = ? AND completed_at IS NULL AND expires_at > ? RETURNING *")
      .bind(result.correctCount, Number(result.isCorrect), Date.now(), row.id, Date.now()).first<Session>();
    const completed = updated || await loadSession(row.id);
    if (completed.completed_at === null) throw new ApiError(410, "El plazo de tu intento terminó.", "SESSION_EXPIRED");
    return json(savedResult(completed));
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message, code: error.code, ...(error.feedback ? { feedback: error.feedback } : {}) }, error.status);
    console.error("Game API failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "No pudimos conectar con el servidor. Intentá nuevamente.", code: "SERVER_ERROR" }, 503);
  }
}
