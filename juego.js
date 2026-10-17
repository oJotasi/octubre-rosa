import { API_ORIGIN, escape, icon } from "./comun.js";

// Un intento por carga de página. Recargar crea una sesión nueva.
const pageSession = crypto.randomUUID();
const main = document.querySelector("#main");
const shell = document.querySelector("#shell");
let screen = "home";
let saved = null;
let busy = false;
let error = "";
let expired = false;
let cleanCanvas = [];

async function api(action, body) {
  try {
    const response = await fetch(`${API_ORIGIN}/api/${action}`, {
      method: "POST", credentials: "omit",
      headers: { "Content-Type": "application/json", "X-Game-Page": pageSession },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) {
      const failure = new Error(data.error || "No pudimos completar la solicitud.");
      failure.code = data.code;
      failure.feedback = data.feedback;
      throw failure;
    }
    return data;
  } catch (failure) {
    if (failure.code) throw failure;
    throw new Error("No pudimos conectar. Tu elección se conserva; intentá nuevamente cuando tengas conexión.");
  }
}

function fail(failure) {
  error = failure.message;
  expired = ["SESSION_EXPIRED", "SESSION_MISSING"].includes(failure.code);
}

function errorView() {
  if (!error) return "";
  return `<div class="error-box" role="alert">${icon("info")}<div><p>${escape(error)}</p>${screen === "game" && !expired ? '<button class="text-button" data-action="retry">Reintentar</button>' : ""}</div></div>`;
}

function render(focus = false) {
  cleanCanvas.forEach(clean => clean());
  cleanCanvas = [];
  shell.classList.toggle("home-screen", screen === "home");
  document.querySelector("header").hidden = screen === "home";
  if (screen === "home") {
    const label = busy ? "Cargando…" : saved?.result ? "Ver resultado" : saved ? "Continuar partida" : "Comenzar";
    main.innerHTML = `<section class="welcome"><img class="welcome-ribbon" src="ribbon.svg" alt=""><h1>Octubre <span>Rosa</span></h1><p>Tres preguntas. Raspá para responder.</p>${expired ? '<p>El plazo de tu intento terminó.</p>' : `<button class="button primary welcome-start" data-action="start" ${busy ? "disabled" : ""}>${label}</button>`}${errorView()}</section>`;
  } else if (screen === "result") {
    const result = saved.result;
    main.innerHTML = `<section class="result-section"><h1 tabindex="-1">Resultado</h1><p class="result-score">${result.correctCount}<span> / 3</span></p><p class="result-caption">respuestas correctas</p><div class="result-badge ${result.isCorrect ? "success" : ""}">${icon(result.isCorrect ? "check" : "info", 18)}${result.isCorrect ? "Partida correcta" : "Partida incorrecta"}</div><p class="attempt-complete">Tu intento ha finalizado.</p></section>`;
  } else {
    const question = saved.game.questions[saved.index];
    const feedback = saved.feedback[saved.index];
    const chosen = saved.answers[saved.index];
    const locked = chosen !== null || busy || expired;
    const cards = question.options.map((option, index) => {
      const selected = chosen === index;
      const correct = feedback?.correctIndex === index;
      const status = selected ? "Tu respuesta" : correct ? "Respuesta correcta" : locked ? "Opción bloqueada" : "Tu respuesta empieza acá";
      return `<article class="option-card ${selected ? "is-selected" : ""} ${correct ? "is-correct" : ""} ${locked && !selected && !correct ? "is-muted" : ""}"><div class="option-copy"><span class="option-letter">${"ABC"[index]}</span><span>${escape(option)}</span>${feedback && (selected || correct) ? icon(correct ? "check" : "close") : ""}</div><div class="scratch-area"><span>${status}</span>${locked ? "" : `<canvas data-option="${index}" aria-hidden="true"></canvas>`}</div><div class="option-bottom"><button data-option="${index}" aria-label="Seleccionar opción ${"ABC"[index]}: ${escape(option)}" ${locked ? "disabled" : ""}>${locked ? selected ? "Elección confirmada" : correct ? "Respuesta correcta" : "No seleccionada" : "Elegir sin raspar"}</button><span class="scratch-progress"></span></div></article>`;
    }).join("");
    const correction = feedback && !saved.finishing ? `<div class="feedback-box ${feedback.isCorrect ? "positive" : "learning"}"><span class="feedback-icon">${icon(feedback.isCorrect ? "check" : "info", 22)}</span><div><h2>${feedback.isCorrect ? "¡Respuesta correcta!" : "Respuesta incorrecta"}</h2><p>${escape(feedback.explanation)}</p>${feedback.isCorrect ? "" : `<p class="correct-copy">Respuesta correcta: <b>${escape(question.options[feedback.correctIndex])}</b></p>`}</div></div>` : "";
    main.innerHTML = `<section class="game-section"><div class="game-top"><span class="question-counter">Pregunta <b>${saved.index + 1}</b> de 3</span></div><div class="progress-track" aria-label="Pregunta ${saved.index + 1} de 3">${[0, 1, 2].map(i => `<span class="${i <= saved.index ? "filled" : ""}"></span>`).join("")}</div><h1 class="question-heading" tabindex="-1">${escape(question.text)}</h1><p class="game-instruction">${icon("hand", 18)}Raspá una opción para responder.</p><div class="options-grid">${cards}</div><div aria-live="polite" aria-atomic="true">${busy ? `<p class="saving-note"><span class="spinner"></span>${saved.finishing ? "Guardando tu resultado…" : "Confirmando tu respuesta…"}</p>` : correction}</div>${errorView()}<div class="game-bottom"><span>${icon("lock", 14)}Una vez confirmada, tu elección no cambia.</span><button class="button primary" data-action="next" ${!feedback || busy || expired ? "disabled" : ""}>${saved.index === 2 ? saved.finishing ? "Reintentar envío" : "Ver mi resultado" : "Siguiente pregunta"}${icon("arrow", 18)}</button></div></section>`;
    main.querySelectorAll("canvas").forEach(canvas => cleanCanvas.push(scratch(canvas)));
  }
  if (focus) main.querySelector("h1")?.focus();
}

async function start() {
  if (busy) return;
  if (saved) { screen = saved.result ? "result" : "game"; render(true); return; }
  busy = true; error = ""; render();
  try {
    const status = await api("attempt", {});
    if (status.expired) expired = true;
    else { saved = status.attempt || await api("start", {}); screen = saved.result ? "result" : "game"; }
  } catch (failure) { fail(failure); }
  finally { busy = false; render(true); }
}

async function confirm(option) {
  if (!saved || busy || expired || saved.feedback[saved.index]) return;
  busy = true; error = ""; saved.answers[saved.index] = option; render();
  try {
    saved.feedback[saved.index] = await api("answer", { sessionId: saved.game.sessionId, questionIndex: saved.index, optionIndex: option });
  } catch (failure) {
    if (failure.code === "ANSWER_LOCKED" && failure.feedback) {
      saved.answers[saved.index] = failure.feedback.selectedIndex;
      saved.feedback[saved.index] = failure.feedback;
    } else fail(failure);
  } finally { busy = false; render(); }
}

async function finish() {
  if (busy || saved.feedback.some(value => !value)) return;
  busy = true; error = ""; saved.finishing = true; render();
  try {
    saved.result = await api("finish", { sessionId: saved.game.sessionId, answers: saved.answers });
    saved.finishing = false; screen = "result";
  } catch (failure) { fail(failure); }
  finally { busy = false; render(screen === "result"); }
}

function retry() {
  if (saved?.finishing) void finish();
  else if (saved && saved.answers[saved.index] !== null && !saved.feedback[saved.index]) void confirm(saved.answers[saved.index]);
}

main.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.option !== undefined) void confirm(Number(button.dataset.option));
  if (button.dataset.action === "start") void start();
  if (button.dataset.action === "retry") retry();
  if (button.dataset.action === "next" && saved?.feedback[saved.index] && !busy) {
    if (saved.index === 2) void finish();
    else { saved.index++; error = ""; render(true); }
  }
});
document.querySelector(".brand").addEventListener("click", event => {
  event.preventDefault(); if (busy) return;
  screen = "home"; error = ""; render();
});
function connection() { document.querySelector("#connection").hidden = navigator.onLine; }
window.addEventListener("offline", connection);
window.addEventListener("online", () => { connection(); retry(); });
connection();

// Borra el recubrimiento y confirma después de raspar el 80 % real del área.
function scratch(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return () => {};
  const option = Number(canvas.dataset.option);
  let pointer = null, last = null, lastCheck = 0, initialized = false, confirmed = false;
  function paint() {
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    const old = document.createElement("canvas"); old.width = canvas.width; old.height = canvas.height;
    if (initialized) old.getContext("2d").drawImage(canvas, 0, 0);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(58 * ratio);
    if (initialized) { context.drawImage(old, 0, 0, canvas.width, canvas.height); return; }
    initialized = true; context.scale(ratio, ratio);
    context.fillStyle = "#efdae3"; context.fillRect(0, 0, width, 58);
    context.strokeStyle = "#e4bccc"; context.lineWidth = 1;
    for (let x = -60; x < width + 60; x += 16) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 58, 58); context.stroke(); }
    context.fillStyle = "#793953"; context.font = "600 11px system-ui"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("✧  RASPÁ PARA ELEGIR  ✧", width / 2, 29);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
  function measure() {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0, samples = 0;
    for (let y = 0; y < canvas.height; y += 4) for (let x = 0; x < canvas.width; x += 4) { samples++; if (pixels[(y * canvas.width + x) * 4 + 3] < 128) clear++; }
    const fraction = clear / samples;
    canvas.closest("article").querySelector(".scratch-progress").textContent = `${Math.floor(fraction * 100)}%`;
    if (fraction >= .8 && !confirmed && !busy && saved.answers[saved.index] === null) { confirmed = true; void confirm(option); }
  }
  function erase(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width, y = (event.clientY - rect.top) * canvas.height / rect.height;
    context.globalCompositeOperation = "destination-out"; context.lineWidth = 38 * canvas.height / rect.height; context.lineCap = "round"; context.lineJoin = "round";
    context.beginPath(); context.moveTo(last?.x ?? x, last?.y ?? y); context.lineTo(x + .01, y); context.stroke(); last = { x, y };
    if (performance.now() - lastCheck > 45) { lastCheck = performance.now(); measure(); }
  }
  canvas.addEventListener("pointerdown", event => {
    if (confirmed || busy || pointer !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointer = event.pointerId; last = null; canvas.setPointerCapture(pointer); erase(event);
  });
  canvas.addEventListener("pointermove", event => { if (pointer === event.pointerId && !confirmed && !busy) erase(event); });
  function up(event) {
    if (pointer !== event.pointerId) return;
    if (!confirmed && !busy) measure();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointer = null; last = null;
  }
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  paint(); const observer = new ResizeObserver(paint); observer.observe(canvas);
  return () => observer.disconnect();
}
