"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Feedback, Result, SavedGame } from "../lib/types";
import ScratchCard from "./scratch-card";
import { Icon, Ribbon } from "./icons";

// A full reload creates a new page session; retries within this document reuse it.
let pageSessionId: string | undefined;
declare global { interface Window { OCTUBRE_ROSA_API_ORIGIN?: string; } }
class RequestError extends Error { constructor(message: string, public code?: string, public feedback?: Feedback) { super(message); } }
async function api<T>(action: string, body: unknown): Promise<T> {
  try {
    pageSessionId ??= crypto.randomUUID();
    const origin = window.OCTUBRE_ROSA_API_ORIGIN || "";
    const response = await fetch(`${origin}/api/${action}`, { method: "POST", credentials: origin ? "omit" : "same-origin", headers: { "Content-Type": "application/json", "X-Game-Page": pageSessionId }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const data = await response.json() as T & { error?: string; code?: string; feedback?: Feedback };
    if (!response.ok) throw new RequestError(data.error || "No pudimos completar la solicitud.", data.code, data.feedback);
    return data;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("No pudimos conectar. Tu elección se conserva; intentá nuevamente cuando tengas conexión.");
  }
}
export default function Experience() {
  const [saved, setSaved] = useState<SavedGame | null>(null);
  const savedRef = useRef<SavedGame | null>(null);
  const [screen, setScreen] = useState<"home" | "game" | "result">("home");
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [error, setError] = useState(""); const [expired, setExpired] = useState(false);
  const [online, setOnline] = useState(true); const [ready, setReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const commit = useCallback((value: SavedGame) => {
    savedRef.current = value; setSaved(value);
  }, []);
  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : "Ocurrió un problema. Intentá nuevamente.");
    if (e instanceof RequestError && ["SESSION_EXPIRED", "SESSION_MISSING"].includes(e.code || "")) setExpired(true);
  }, []);
  const confirmAnswer = useCallback(async (optionIndex: number) => {
    const current = savedRef.current;
    if (!current || busyRef.current || current.feedback[current.index]) return;
    busyRef.current = true; setBusy(true); setError("");
    const next = { ...current, answers: [...current.answers] }; next.answers[current.index] = optionIndex;
    commit(next);
    try {
      const feedback = await api<Feedback>("answer", { sessionId: current.game.sessionId, questionIndex: current.index, optionIndex });
      const updated = { ...next, feedback: [...next.feedback] }; updated.feedback[current.index] = feedback; commit(updated);
    } catch (e) {
      if (e instanceof RequestError && e.code === "ANSWER_LOCKED" && e.feedback) {
        const updated = { ...next, answers: [...next.answers], feedback: [...next.feedback] };
        updated.answers[current.index] = e.feedback.selectedIndex; updated.feedback[current.index] = e.feedback; commit(updated);
      } else fail(e);
    }
    finally { busyRef.current = false; setBusy(false); }
  }, [commit, fail]);
  const finish = useCallback(async () => {
    const current = savedRef.current;
    if (!current || busyRef.current || current.feedback.some(f => !f)) return;
    busyRef.current = true; setBusy(true); setError(""); commit({ ...current, finishing: true });
    try {
      const result = await api<Result>("finish", { sessionId: current.game.sessionId, answers: current.answers });
      commit({ ...current, result, finishing: false }); setScreen("result");
    } catch (e) { fail(e); setError(e instanceof RequestError && e.code === "SESSION_EXPIRED" ? e.message : "No pudimos guardar tu resultado. Tus respuestas se conservan. Intentá nuevamente."); }
    finally { busyRef.current = false; setBusy(false); }
  }, [commit, fail]);
  useEffect(() => {
    // Do not restore previous games: every page load starts on the welcome screen.
    setOnline(navigator.onLine); setReady(true);
    const reconnect = () => {
      setOnline(true); const current = savedRef.current;
      if (current?.finishing) void finish();
      else if (current && current.answers[current.index] !== null && !current.feedback[current.index]) void confirmAnswer(current.answers[current.index]!);
    };
    const offline = () => setOnline(false);
    window.addEventListener("online", reconnect); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", reconnect); window.removeEventListener("offline", offline); };
  }, [confirmAnswer, finish]);
  useEffect(() => { if (ready && screen !== "home") heading.current?.focus(); }, [screen, saved?.index, ready]);
  async function start() {
    if (busyRef.current) return;
    if (savedRef.current?.result) { setScreen("result"); return; }
    busyRef.current = true; setBusy(true); setError(""); setExpired(false);
    try {
      // Initialize the browser identity before an anonymous attempt is allocated.
      const status = await api<{ attempt: SavedGame | null; expired: boolean }>("attempt", {});
      if (status.expired) { setExpired(true); return; }
      const attempt = status.attempt || await api<SavedGame>("start", {});
      commit(attempt); setScreen(attempt.result ? "result" : "game");
    } catch (e) { fail(e); } finally { busyRef.current = false; setBusy(false); }
  }
  function nextQuestion() {
    if (!saved || !saved.feedback[saved.index]) return;
    if (saved.index === 2) { void finish(); return; }
    commit({ ...saved, index: saved.index + 1 }); setError("");
  }
  const question = saved?.game.questions[saved.index]; const feedback = saved?.feedback[saved.index] || null;
  const errorView = error && <div className="error-box" role="alert"><Icon name="info" /><div><p>{error}</p>{!expired && screen === "game" && <button className="text-button" disabled={busy} onClick={() => { if (saved?.finishing) void finish(); else if (saved?.answers[saved.index] !== null) void confirmAnswer(saved!.answers[saved!.index]!); }}>Reintentar <Icon name="refresh" size={14} /></button>}</div></div>;
  return <div className={`site-shell ${screen === "home" ? "home-screen" : ""}`}>
    <a className="skip-link" href="#main">Saltar al contenido</a>
    {screen !== "home" && <header className="header"><a className="brand" href="/" onClick={e => { e.preventDefault(); setScreen("home"); setError(""); }} aria-label="Octubre Rosa, inicio"><Ribbon className="brand-ribbon"/><span>Octubre <span className="brand-rosa">Rosa</span></span></a></header>}
    {!online && <div className="connection-note" role="status">Sin conexión. Tus respuestas se conservan mientras mantengas esta pestaña abierta.</div>}
    <main id="main">
      {screen === "home" && <section className="welcome">
        <Ribbon className="welcome-ribbon"/>
        <h1>Octubre <span>Rosa</span></h1>
        <p>Tres preguntas. Raspá para responder.</p>
        {expired ? <p>El plazo de tu intento terminó.</p> : <button className="button primary welcome-start" disabled={busy || !ready} onClick={saved ? () => { setScreen(saved.result ? "result" : "game"); setError(""); } : start}>{busy || !ready ? "Cargando…" : saved?.result ? "Ver resultado" : saved ? "Continuar partida" : "Comenzar"}</button>}
        {errorView}
      </section>}
      {screen === "game" && saved && question && <section className="game-section">
        <div className="game-top"><span className="question-counter">Pregunta <b>{saved.index + 1}</b> de 3</span></div><div className="progress-track" aria-label={`Pregunta ${saved.index + 1} de 3`}>{[0,1,2].map(i => <span key={i} className={i <= saved.index ? "filled" : ""}/>)}</div>
        <h1 ref={heading} tabIndex={-1} className="question-heading">{question.text}</h1><p className="game-instruction"><Icon name="hand" size={18}/> Raspá una opción para responder.</p>
        <div className="options-grid">{question.options.map((option, i) => <ScratchCard key={`${saved.game.sessionId}-${saved.index}-${i}`} option={option} index={i} chosen={saved.answers[saved.index]} feedback={feedback} locked={saved.answers[saved.index] !== null || busy || expired} onSelect={confirmAnswer}/>)}</div>
        <div aria-live="polite" aria-atomic="true">{busy && <p className="saving-note"><span className="spinner"/> {saved.finishing ? "Guardando tu resultado…" : "Confirmando tu respuesta…"}</p>}{feedback && !saved.finishing && <div className={`feedback-box ${feedback.isCorrect ? "positive" : "learning"}`}><span className="feedback-icon"><Icon name={feedback.isCorrect ? "check" : "info"} size={22}/></span><div><h2>{feedback.isCorrect ? "¡Respuesta correcta!" : "Respuesta incorrecta"}</h2><p>{feedback.explanation}</p>{!feedback.isCorrect && <p className="correct-copy">Respuesta correcta: <b>{question.options[feedback.correctIndex]}</b></p>}</div></div>}</div>
        {errorView}<div className="game-bottom"><span><Icon name="lock" size={14}/> Una vez confirmada, tu elección no cambia.</span><button className="button primary" disabled={!feedback || busy || expired} onClick={nextQuestion}>{busy && saved.finishing ? "Guardando…" : saved.index === 2 ? saved.finishing ? "Reintentar envío" : "Ver mi resultado" : "Siguiente pregunta"}<Icon name="arrow" size={18}/></button></div>
      </section>}
      {screen === "result" && saved?.result && <section className="result-section"><h1 ref={heading} tabIndex={-1}>Resultado</h1><p className="result-score">{saved.result.correctCount}<span> / 3</span></p><p className="result-caption">respuestas correctas</p><div className={`result-badge ${saved.result.isCorrect ? "success" : ""}`}><Icon name={saved.result.isCorrect ? "check" : "info"} size={18}/>{saved.result.isCorrect ? "Partida correcta" : "Partida incorrecta"}</div><p className="attempt-complete">Tu intento ha finalizado.</p>{errorView}</section>}
    </main>
    <footer className="footer"><span>Actividad educativa.</span></footer>
  </div>;
}
