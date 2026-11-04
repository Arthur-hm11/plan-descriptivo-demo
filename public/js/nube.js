// Guardar en la nube y modificar un plan guardado.
//   · Al abrir la página: el formulario de siempre, vacío. Barra arriba con «💾 Guardar mi plan».
//     La primera vez que se guarda sale el folio en grande para anotarlo.
//   · Menú «Modificar un plan guardado»: pide folio + correo y abre ESE plan en otra pestaña.
//   · En un plan guardado la barra muestra folio y semáforo, «💾 Guardar cambios» y «📤 Enviar a la DCEVE».
// Semáforo: ⚪ En elaboración → 🟡 Enviado a la DCEVE → 🔴 Con observaciones → 🟢 Autorizado.
// Con 🟡 o 🟢 el plan se ve pero no se puede modificar. La DCEVE revisa en otra página (/revision).
const BASE = "plan-descriptivo:v1";
const $ = (sel) => document.querySelector(sel);
const ss = {
  leer: (k) => { try { return sessionStorage.getItem(k) || ""; } catch { return ""; } },
  poner: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* nada */ } },
  quitar: (k) => { try { sessionStorage.removeItem(k); } catch { /* nada */ } },
};
const CLAVE = ss.leer("pd:clave") || BASE;    // el plan de ESTA pestaña (lo mismo que usa app.js)
const leerTexto = () => { try { return localStorage.getItem(CLAVE) || ""; } catch { return ""; } };
const leerDatos = () => { try { return JSON.parse(leerTexto()) || {}; } catch { return {}; } };
const folio = () => ss.leer("pd:folio");
const ficha = () => ss.leer("pd:ficha");      // aparta el plan para ESTA pestaña (solo un lugar a la vez)
const correoDelPlan = () => String(leerDatos().correo_responsable ?? "").trim();
const hayCambios = () => folio() ? leerTexto() !== ss.leer("pd:guardado") : String(leerDatos().nombre_actividad ?? "").trim() !== "";
const completo = () => /7 de 7/.test($("#avance-texto")?.textContent ?? "");
const NOMBRES = { elaboracion: "En elaboración", revision: "Enviado a la DCEVE", observaciones: "Con observaciones", autorizado: "Autorizado" };
const crear = (etiqueta, props = {}, hijos = []) => {
  const el = Object.assign(document.createElement(etiqueta), props);
  for (const h of [].concat(hijos)) if (h !== null && h !== undefined && h !== false && h !== "") el.append(h);
  return el;
};
const irASeccion = (id) => {          // botón del menú de esa sección
  const i = secciones.findIndex((s) => s.id === id);
  document.querySelectorAll("#menu-secciones .menu__boton")[i]?.click();
};
let servicio = { guardado: true };   // si el servidor puede guardar en la nube (lo dice /api/servicio)
let estado = null;   // { estado, nombre, comentario, secciones, cambio }
const secciones = (await fetch("datos/formulario.json").then((r) => r.json())).secciones;   // para nombrar las secciones de las observaciones

function mensaje(id, texto, tipo = "") {
  const el = $(id);
  el.textContent = texto;
  el.classList.toggle("mensaje--ok", tipo === "ok");
  el.classList.toggle("mensaje--error", tipo === "error");
}
async function pedir(url, cuerpo) {
  if (!servicio.guardado) return { ok: false, error: "Esta versión no está conectada a la nube de la SABG: por ahora no se pueden guardar ni abrir planes en línea. Guarda tu plan en PDF desde Herramientas → Hoja final del Plan." };
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const json = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...json } : { ok: false, error: json.error || "No se pudo completar. Intenta de nuevo." };
  } catch {
    return { ok: false, error: "No hay conexión con el servidor de la página. Revisa tu internet e intenta de nuevo." };
  }
}
for (const b of document.querySelectorAll("[data-cerrar]")) b.addEventListener("click", () => b.closest("dialog").close());

// ---------- barra: folio, semáforo y botones ----------
async function consultarEstado() {
  if (!folio()) { estado = null; return; }
  const r = await pedir("/api/planes/estado", { folio: folio(), correo: correoDelPlan(), ficha: ficha() });
  estado = r.ok ? r.estado : null;
  if (!r.ok) mensaje("#barra-mensaje", r.error, "error");
}

function pintarBarra() {
  if (!servicio.guardado) return;
  const e = estado?.estado;
  $("#barra-estado").replaceChildren(...(folio()
    ? [crear("span", { className: "chip chip--folio", title: "Tu folio", textContent: folio() }),
       crear("span", { className: `chip chip--estado chip--${e ?? "cargando"}`, textContent: e ? NOMBRES[e] ?? estado.nombre : "Consultando…" })]
    : [crear("span", { className: "chip chip--nuevo", textContent: "Plan nuevo · aún sin guardar" })]));
  const bloqueado = e === "revision" || e === "autorizado";
  $("#barra-guardar").hidden = bloqueado;
  $("#barra-guardar").textContent = folio() ? "💾 Guardar cambios" : "💾 Guardar mi plan";
  $("#barra-enviar").hidden = !folio() || bloqueado || !e;
  document.body.classList.toggle("plan-bloqueado", bloqueado);
  const aviso = $("#aviso-plan");
  const conObs = e === "observaciones" ? secciones.filter((s) => estado.secciones?.[s.id]) : [];
  aviso.className = "aviso-plan" + (e === "observaciones" ? " aviso-plan--rojo" : "");
  aviso.hidden = !(bloqueado || e === "observaciones");
  if (e === "revision") aviso.replaceChildren("Tu plan lo está revisando la DCEVE. Puedes verlo, pero no modificarlo hasta que te lo regrese.");
  else if (e === "autorizado") aviso.replaceChildren("¡Tu plan ya está autorizado! Puedes verlo e imprimirlo, pero ya no se puede modificar.");
  else if (e === "observaciones") {
    // un solo aviso corto: las secciones a corregir son enlaces que llevan a cada una
    const enlaces = conObs.flatMap((s, k) => [k ? " · " : "", crear("button", { type: "button", className: "aviso-plan__enlace", textContent: `${s.numero}. ${s.titulo}`, onclick: () => irASeccion(s.id) })]);
    aviso.replaceChildren(
      crear("strong", { textContent: "La DCEVE te pide corregir: " }),
      ...(enlaces.length ? enlaces : ["revisa el comentario general."]),
      estado?.comentario ? crear("span", { className: "aviso-plan__general", textContent: `Comentario general: ${estado.comentario}` }) : "",
      crear("span", { className: "aviso-plan__paso", textContent: "Al terminar, guarda y vuelve a enviarlo a la DCEVE." }),
    );
  }
  pintarObsSeccion();
  marcarMenu();
}

// Observación de la DCEVE para la sección que se está viendo (arriba del formulario)
function pintarObsSeccion() {
  const titulo = $("#titulo-seccion")?.textContent ?? "";
  const s = secciones.find((x) => x.titulo === titulo);
  const nota = estado?.estado === "observaciones" && s ? estado.secciones?.[s.id] : "";
  const caja = $("#obs-seccion");
  caja.hidden = !nota;
  caja.replaceChildren(...(nota ? [crear("strong", { textContent: "La DCEVE pide corregir en esta sección" }), crear("span", { textContent: nota })] : []));
}
// Punto rojo en el menú en las secciones con observaciones
function marcarMenu() {
  const con = estado?.estado === "observaciones" ? new Set(secciones.filter((s) => estado.secciones?.[s.id]).map((s) => s.titulo)) : new Set();
  for (const b of document.querySelectorAll("#menu-secciones .menu__boton")) {
    const t = b.children[1]?.textContent ?? "";
    b.classList.toggle("menu__boton--obs", con.has(t));
    b.title = con.has(t) ? `${t} — tiene observaciones de la DCEVE` : t;
  }
}
new MutationObserver(pintarObsSeccion).observe($("#titulo-seccion"), { childList: true, characterData: true, subtree: true });
new MutationObserver(marcarMenu).observe($("#menu-secciones"), { childList: true });

async function guardar() {
  const eraNuevo = !folio();
  mensaje("#barra-mensaje", "Guardando…");
  const r = await pedir("/api/planes", { datos: leerDatos(), folio: folio() || undefined, ficha: ficha() || undefined });
  if (!r.ok) { mensaje("#barra-mensaje", r.error, "error"); return false; }
  ss.poner("pd:folio", r.folio);
  if (r.ficha) ss.poner("pd:ficha", r.ficha);
  ss.poner("pd:guardado", leerTexto());
  estado = r.estado;
  pintarBarra();
  const hora = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  mensaje("#barra-mensaje", `✓ Guardado · ${hora}`, "ok");
  if (eraNuevo) { $("#folio-grande").textContent = r.folio; $("#dialogo-folio").showModal(); $("#folio-copiar").focus(); }
  return true;
}

$("#barra-guardar").addEventListener("click", async () => {
  $("#barra-guardar").disabled = true;
  await guardar();
  $("#barra-guardar").disabled = false;
});
$("#folio-copiar").addEventListener("click", async () => {
  const b = $("#folio-copiar");
  try { await navigator.clipboard.writeText(folio()); b.textContent = "✓ Folio copiado"; } catch { b.textContent = "Cópialo a mano"; }
  setTimeout(() => { b.textContent = "Copiar folio"; }, 2500);
});

// ---------- enviar a la DCEVE ----------
$("#barra-enviar").addEventListener("click", () => {
  if (!completo()) return mensaje("#barra-mensaje", "Para enviarlo a la DCEVE, primero completa las 7 secciones (mira el avance en el menú).", "error");
  mensaje("#enviar-mensaje", "");
  $("#dialogo-enviar").showModal();
});
$("#enviar-si").addEventListener("click", async () => {
  const b = $("#enviar-si");
  b.disabled = true;
  mensaje("#enviar-mensaje", "Enviando…");
  if (hayCambios() && !(await guardar())) { b.disabled = false; return mensaje("#enviar-mensaje", $("#barra-mensaje").textContent, "error"); }
  const r = await pedir("/api/planes/enviar-revision", { folio: folio(), correo: correoDelPlan(), ficha: ficha() });
  b.disabled = false;
  if (!r.ok) return mensaje("#enviar-mensaje", r.error, "error");
  estado = r.estado;
  $("#dialogo-enviar").close();
  pintarBarra();
  mensaje("#barra-mensaje", "✓ Tu plan se envió a la DCEVE.", "ok");
});

// ---------- modificar un plan guardado: folio + correo → se abre en otra pestaña ----------
$("#menu-abrir").addEventListener("click", () => {
  mensaje("#abrir-mensaje", "");
  $("#dialogo-abrir").showModal();
  $("#abrir-folio").focus();
});
$("#abrir-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = $("#abrir-folio").value.trim().toUpperCase();
  const correo = $("#abrir-correo").value.trim();
  if (!/^PD-[A-Z0-9]{8}$/.test(f)) return mensaje("#abrir-mensaje", "Escribe tu folio completo, por ejemplo PD-7K3F9Q2M.", "error");
  if (!correo) return mensaje("#abrir-mensaje", "Escribe el correo del responsable del diseño.", "error");
  // la pestaña se abre ya (con el clic), y se llena cuando la nube responde
  const pestana = window.open("", "_blank");
  if (pestana) pestana.document.title = "Abriendo tu plan…";
  $("#abrir-entrar").disabled = true;
  mensaje("#abrir-mensaje", "Buscando tu plan…");
  const r = await pedir("/api/planes/recuperar", { folio: f, correo });
  $("#abrir-entrar").disabled = false;
  if (!r.ok) { pestana?.close(); return mensaje("#abrir-mensaje", r.error, "error"); }
  try {
    localStorage.setItem(`${BASE}:${r.folio}`, JSON.stringify(r.datos));
    localStorage.setItem("pd:abrir", r.folio);   // pase de un solo uso para la pestaña nueva
    localStorage.setItem("pd:abrir-ficha", r.ficha ?? "");
  } catch { pestana?.close(); return mensaje("#abrir-mensaje", "Este navegador no permite guardar datos; no se pudo abrir el plan.", "error"); }
  const url = `./?abrir=${encodeURIComponent(r.folio)}`;
  if (pestana) { pestana.location.href = url; $("#dialogo-abrir").close(); $("#abrir-form").reset(); }
  else location.href = url;                      // si el navegador bloquea pestañas nuevas, se abre aquí mismo
});

// Si cierra la página con cambios sin guardar, el navegador pregunta antes
window.addEventListener("beforeunload", (e) => { if (hayCambios()) e.preventDefault(); });
// Al cerrar la pestaña se suelta el plan para que se pueda abrir en otro lugar
window.soltarPlan = () => {
  if (!folio() || !ficha()) return;
  const cuerpo = new Blob([JSON.stringify({ folio: folio(), ficha: ficha() })], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/planes/cerrar", cuerpo)) fetch("/api/planes/cerrar", { method: "POST", body: cuerpo, keepalive: true }).catch(() => {});
};
window.addEventListener("pagehide", window.soltarPlan);
// Mientras la pestaña está abierta, cada 4 minutos se avisa que el plan sigue en uso
setInterval(() => { if (folio()) consultarEstado().then(pintarBarra); }, 4 * 60 * 1000);

// ---------- al cargar ----------
async function alCargar() {
  document.documentElement.classList.remove("cargando");   // ya está todo listo: se muestra la página completa
  if (ss.leer("pd:foto") === "1") { ss.poner("pd:guardado", leerTexto()); ss.quitar("pd:foto"); }
  pintarBarra();
  await consultarEstado();
  pintarBarra();
}
// Botón desplegable «Herramientas»: se cierra al elegir una opción, al dar clic fuera o con Escape
const herramientas = $("#herramientas");
const modoPruebas = ss.leer("pd:pruebas") === "1";   // las pruebas automáticas lo dejan abierto
if (modoPruebas) herramientas.open = true;
const cerrarHerramientas = () => { if (!modoPruebas) herramientas.open = false; };
herramientas.querySelectorAll(".herramientas__menu > *").forEach((el) => el.addEventListener("click", cerrarHerramientas));
document.addEventListener("click", (e) => { if (!herramientas.contains(e.target)) cerrarHerramientas(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && herramientas.open) { cerrarHerramientas(); herramientas.querySelector("summary").focus(); } });

// Si el servidor no puede llegar a la nube (versión pública de prueba), se ocultan guardar/enviar/modificar
servicio = await fetch("datos/servicio.json").then((r) => r.json()).catch(() => ({ guardado: true }));
if (!servicio.guardado) {
  for (const sel of ["#barra-guardar", "#barra-enviar"]) { const e = $(sel); if (e) { e.hidden = true; e.style.display = "none"; } }
  const aviso = $("#aviso-plan");
  aviso.className = "aviso-plan";
  aviso.hidden = false;
  aviso.replaceChildren(crear("strong", { textContent: "Por ahora el guardado en línea no está disponible. " }),
    "Puedes llenar todo tu plan; para conservarlo, abre Herramientas → Hoja final del Plan y guárdalo en PDF antes de cerrar la página.");
  $("#barra-estado").replaceChildren(crear("span", { className: "chip chip--nuevo", textContent: "Versión de consulta" }));
}

// el formulario (app.js) avisa cuando está listo; si ya avisó antes de que este archivo terminara de cargar, se hace ya
if (window.planListo) alCargar(); else document.addEventListener("plan:listo", alCargar, { once: true });
