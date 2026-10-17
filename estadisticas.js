import { API_ORIGIN, icon } from "./comun.js";

const element = id => document.getElementById(id);
const refresh = element("refresh");
let token = "";
let busy = false;
let requestNumber = 0;

document.querySelectorAll("[data-icon]").forEach(node => { node.innerHTML = icon(node.dataset.icon, 22); });

function showPanel(valid) {
  element("panel").hidden = !valid;
  document.querySelector("header").hidden = !valid;
  element("restricted").hidden = valid;
  if (!valid) element("restricted").innerHTML = '<h1>Enlace no válido</h1><p>Usá el enlace de estadísticas que te compartieron.</p><a class="text-button" href="./">Ir al juego</a>';
}

async function load() {
  if (busy || !/^[a-f0-9]{64}$/.test(token)) return;
  busy = true; const currentToken = token; const currentRequest = ++requestNumber;
  refresh.disabled = true; refresh.textContent = "Actualizando…";
  element("error").hidden = true;
  try {
    const response = await fetch(`${API_ORIGIN}/api/stats`, {
      credentials: "omit", headers: { Authorization: `Bearer ${currentToken}` },
      cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(15000),
    });
    if (token !== currentToken || currentRequest !== requestNumber) return;
    if (response.status === 401 || response.status === 403) { showPanel(false); return; }
    const stats = await response.json();
    if (!response.ok) throw new Error(stats.error || "No pudimos cargar las estadísticas.");
    for (const key of ["total", "correct", "incorrect"]) element(key).textContent = Number(stats[key]).toLocaleString("es-AR");
    const percentage = Number(stats.correctPercentage);
    element("percentage").textContent = `${percentage.toLocaleString("es-AR")}%`;
    element("updated").textContent = `Actualizado: ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
    element("distribution").hidden = false;
    element("chart").hidden = element("legend").hidden = stats.total === 0;
    element("empty").hidden = stats.total !== 0;
    element("bar").style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    element("chart").setAttribute("aria-label", `${percentage}% de partidas correctas; ${Math.round((100 - percentage) * 10) / 10}% incorrectas`);
    element("correct-label").textContent = `Correctas · ${stats.correct}`;
    element("incorrect-label").textContent = `Incorrectas · ${stats.incorrect}`;
  } catch (failure) {
    if (token === currentToken && currentRequest === requestNumber) {
      element("error").textContent = failure.message || "No pudimos cargar las estadísticas. Intentá nuevamente.";
      element("error").hidden = false;
    }
  } finally {
    if (currentRequest === requestNumber) { busy = false; refresh.disabled = false; refresh.innerHTML = `${icon("refresh", 17)}Actualizar`; }
  }
}

function readLink() {
  token = new URLSearchParams(location.hash.slice(1)).get("acceso") || "";
  requestNumber++; busy = false;
  for (const id of ["total", "correct", "incorrect", "percentage"]) element(id).textContent = "—";
  element("distribution").hidden = true;
  const valid = /^[a-f0-9]{64}$/.test(token);
  showPanel(valid);
  if (valid) void load();
}

refresh.addEventListener("click", load);
window.addEventListener("hashchange", readLink);
setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000);
readLink();
