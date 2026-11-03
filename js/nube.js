// Ventana "Guardar en la nube" con el semáforo del estado del plan:
// ⚪ En elaboración → 🟡 Enviado a revisión → 🔴 Con observaciones → 🟢 Autorizado.
// La persona responsable guarda, abre su plan (folio + correo) y lo envía a revisión;
// la DCEVE, con su clave de revisión, abre el plan y pone observaciones o lo autoriza.
// Lee y escribe lo mismo que guarda el formulario (app.js).
const CLAVE = "plan-descriptivo:v1";
const CLAVE_FOLIO = "plan-descriptivo:folio";

const $ = (sel) => document.querySelector(sel);
const crear = (etiqueta, props = {}, hijos = []) => {
  const el = Object.assign(document.createElement(etiqueta), props);
  for (const h of [].concat(hijos)) if (h !== null && h !== undefined && h !== false) el.append(h);
  return el;
};
const dialogo = $("#dialogo-nube");
const mensaje = $("#nube-mensaje");
let estadoActual = null;   // { estado, nombre, comentario, cambio } del plan de este navegador

const leerFolio = () => { try { return localStorage.getItem(CLAVE_FOLIO) || ""; } catch { return ""; } };
function leerDatos() { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } }
const correoDelPlan = () => String(leerDatos().correo_responsable ?? "").trim();

function avisar(texto, tipo = "") {
  mensaje.textContent = texto;
  mensaje.className = `nube__mensaje${tipo ? ` nube__mensaje--${tipo}` : ""}`;
}
const semaforo = (e) => crear("span", { className: `semaforo semaforo--${e.estado}`, textContent: e.nombre });

async function pedir(url, cuerpo) {
  return { ok: false, error: "Versión de demostración: no guarda en la nube. Lo que llenas se queda en tu navegador." };
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const json = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...json } : { ok: false, error: json.error || "No se pudo completar. Intenta de nuevo." };
  } catch {
    return { ok: false, error: "No hay conexión con el servidor de la página." };
  }
}

// ---------- lo que se ve: folio, semáforo y botón "Enviar a revisión" ----------
function pintar() {
  const folio = leerFolio();
  const caja = $("#nube-estado");
  caja.hidden = !folio;
  caja.replaceChildren();
  if (folio) {
    caja.append(crear("p", {}, ["Folio: ", crear("strong", { className: "nube__folio-num", textContent: folio }), " — guárdalo junto con tu correo para abrir el plan en otra computadora."]));
    if (estadoActual) {
      caja.append(crear("p", {}, ["Estado: ", semaforo(estadoActual), estadoActual.cambio ? ` (desde el ${estadoActual.cambio})` : ""]));
      if (estadoActual.comentario) caja.append(crear("p", { className: "nube__observaciones", textContent: `Observaciones de la DCEVE: ${estadoActual.comentario}` }));
    }
  }
  $("#menu-nube-folio").replaceChildren(folio ? (estadoActual ? semaforo(estadoActual) : `Folio ${folio}`) : "Guardar o abrir con folio");

  const bloqueado = Boolean(estadoActual && ["revision", "autorizado"].includes(estadoActual.estado));
  $("#nube-enviar").disabled = bloqueado;
  const revision = $("#nube-revision"), nota = $("#nube-revision-nota");
  const completo = /7 de 7/.test($("#avance-texto")?.textContent ?? "");
  revision.hidden = !folio || !estadoActual || bloqueado;
  revision.disabled = !completo;
  nota.hidden = !(bloqueado || (folio && estadoActual && !completo));
  nota.textContent = estadoActual?.estado === "revision" ? "Tu plan está en revisión en la DCEVE; mientras tanto no se puede modificar."
    : estadoActual?.estado === "autorizado" ? "Tu plan ya está autorizado; ya no se puede modificar."
    : "Para enviarlo a revisión, primero completa las 7 secciones (revisa el avance en el menú).";
}

async function consultarEstado() {
  const folio = leerFolio(), correo = correoDelPlan();
  if (!folio || !correo) return pintar();
  const r = await pedir("/api/planes/estado", { folio, correo });
  if (r.ok) estadoActual = r.estado;
  pintar();
}

// ---------- persona responsable ----------
async function guardar() {
  const boton = $("#nube-enviar");
  boton.disabled = true;
  avisar("Guardando en la nube…");
  const r = await pedir("/api/planes", { datos: leerDatos(), folio: leerFolio() || undefined });
  boton.disabled = false;
  if (!r.ok) { pintar(); avisar(r.error, "error"); return false; }
  try { localStorage.setItem(CLAVE_FOLIO, r.folio); } catch { /* sin guardar el folio en este navegador */ }
  estadoActual = r.estado;
  pintar();
  avisar(`✓ Guardado en la nube el ${r.guardado} (hora de la Ciudad de México), en la carpeta "${r.carpeta}".`, "ok");
  return true;
}

let confirmarRevision = false;
async function enviarRevision() {
  const boton = $("#nube-revision");
  if (!confirmarRevision) {
    confirmarRevision = true;
    boton.textContent = "Sí, enviar a revisión";
    return avisar("Se guardará lo último que capturaste y el plan pasará a «Enviado a revisión». Mientras la DCEVE lo revisa no podrás modificarlo. Da clic en «Sí, enviar a revisión» para continuar.");
  }
  confirmarRevision = false;
  boton.textContent = "Enviar a revisión";
  if (!(await guardar())) return;   // primero se guarda lo último
  const r = await pedir("/api/planes/enviar-revision", { folio: leerFolio(), correo: correoDelPlan() });
  if (!r.ok) return avisar(r.error, "error");
  estadoActual = r.estado;
  pintar();
  avisar("✓ Tu plan se envió a revisión. La DCEVE lo revisará y aquí verás su estado.", "ok");
}

// Trae un plan de la nube a este navegador (persona responsable con su correo, o la DCEVE con su clave)
let confirmarAbrir = "";
async function abrir(boton, cuerpo) {
  if (!/^PD-[A-Z0-9]{8}$/.test(cuerpo.folio)) return avisar("Escribe el folio completo, por ejemplo PD-7K3F9Q2M.", "error");
  if (!cuerpo.clave && !cuerpo.correo) return avisar(boton.id === "rev-abrir" ? "Escribe la clave de revisión." : "Escribe también el correo del responsable del diseño.", "error");
  // primer clic: avisa que se reemplazará lo de este navegador; segundo clic: abre
  if (confirmarAbrir !== boton.id) {
    confirmarAbrir = boton.id;
    boton.textContent = "Sí, reemplazar";
    return avisar("Lo que tienes ahora en este navegador se reemplazará por el plan guardado. Da clic en «Sí, reemplazar» para continuar.");
  }
  confirmarAbrir = "";
  boton.textContent = "Abrir";
  boton.disabled = true;
  avisar("Trayendo el plan de la nube…");
  const r = await pedir("/api/planes/recuperar", cuerpo);
  boton.disabled = false;
  if (!r.ok) return avisar(r.error, "error");
  try {
    localStorage.setItem(CLAVE, JSON.stringify(r.datos));
    localStorage.setItem(CLAVE_FOLIO, r.folio);
  } catch { return avisar("Este navegador no permite guardar datos; no se pudo cargar el plan.", "error"); }
  avisar(`✓ Se trajo el plan "${r.curso}" (${r.estado.nombre}). Cargando…`, "ok");
  setTimeout(() => location.reload(), 900);
}

// ---------- DCEVE ----------
async function cambiarEstado() {
  const folio = $("#rev-folio").value.trim().toUpperCase();
  const clave = $("#rev-clave").value;
  const estado = $("#rev-estado").value;
  const comentario = $("#rev-comentario").value.trim();
  if (!/^PD-[A-Z0-9]{8}$/.test(folio)) return avisar("Escribe el folio completo del plan que revisaste.", "error");
  if (!clave) return avisar("Escribe la clave de revisión.", "error");
  if (!estado) return avisar("Elige el nuevo estado.", "error");
  if (estado === "observaciones" && !comentario) return avisar("Escribe qué debe corregir la persona (las observaciones).", "error");
  avisar("Cambiando el estado…");
  const r = await pedir("/api/planes/revisar", { folio, clave, estado, comentario });
  if (!r.ok) return avisar(r.error, "error");
  if (folio === leerFolio()) { estadoActual = r.estado; pintar(); }
  avisar(`✓ El plan ${r.folio} quedó «${r.estado.nombre}».`, "ok");
}

const reiniciarConfirmaciones = () => {
  confirmarAbrir = ""; confirmarRevision = false;
  $("#nube-recuperar").textContent = "Abrir"; $("#rev-abrir").textContent = "Abrir"; $("#nube-revision").textContent = "Enviar a revisión";
};
$("#menu-nube").addEventListener("click", () => {
  avisar("");
  reiniciarConfirmaciones();
  pintar();
  dialogo.showModal();
  consultarEstado();
});
$("#nube-cerrar").addEventListener("click", () => dialogo.close());
$("#nube-enviar").addEventListener("click", guardar);
$("#nube-revision").addEventListener("click", enviarRevision);
$("#nube-recuperar").addEventListener("click", (e) => abrir(e.currentTarget, { folio: $("#nube-folio-entrada").value.trim().toUpperCase(), correo: $("#nube-correo-entrada").value.trim() }));
$("#rev-abrir").addEventListener("click", (e) => abrir(e.currentTarget, { folio: $("#rev-folio").value.trim().toUpperCase(), clave: $("#rev-clave").value }));
$("#rev-cambiar").addEventListener("click", cambiarEstado);
for (const id of ["#nube-folio-entrada", "#nube-correo-entrada", "#rev-folio", "#rev-clave"]) $(id).addEventListener("input", reiniciarConfirmaciones);
consultarEstado();
