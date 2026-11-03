// "Pregúntale a la Guía": asistente que responde SOLO con el texto de la Guía de llenado (datos/guia.json):
// los 37 rubros, las 73 definiciones del anexo y las opciones de las listas.
// No usa inteligencia artificial ni sale a internet: busca las palabras de la pregunta en los rubros y definiciones
// (sin importar acentos, mayúsculas ni plurales) y muestra lo que más coincide, con un botón para ir a su campo.
// No lee lo que la persona escribió en su plan.
const $ = (sel) => document.querySelector(sel);
const crear = (etiqueta, props = {}, hijos = []) => {
  const el = Object.assign(document.createElement(etiqueta), props);
  for (const h of [].concat(hijos)) if (h !== null && h !== undefined && h !== false) el.append(h);
  return el;
};

const [guia, formulario] = await Promise.all([
  fetch("datos/guia.json").then((r) => r.json()),
  fetch("datos/formulario.json").then((r) => r.json()),
]);

// ---------- palabras ----------
// Palabras que no ayudan a encontrar el rubro ("¿qué pongo en la justificación?" → "justificacion")
const VACIAS = new Set(("a al como con cual cuales cuando cuanto cuantos cuantas de del donde e el ella en entre es esta este esto hay la las " +
  "le lo los me mi mis o para pero por que quien se sea ser si sin sobre su sus te tu un una uno unos unas y ya " +
  "pongo poner escribo escribir lleno llenar debo debe tengo hago hacer puedo puede significa quiere decir dame dime " +
  "explica explicame ayuda necesito saber favor campo rubro seccion apartado").split(" "));

const sinAcentos = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const raiz = (p) => (p.length > 5 && p.endsWith("es") ? p.slice(0, -2) : p.length > 4 && p.endsWith("s") ? p.slice(0, -1) : p);
const palabras = (t) => sinAcentos(t).split(/[^a-z0-9ñ]+/).filter((p) => p.length > 1 && !VACIAS.has(p)).map(raiz);

// ---------- dónde está cada rubro en el formulario ----------
const ubicaciones = new Map();   // rubro → { seccion (índice), id del control o del bloque, etiqueta que ve la persona }
formulario.secciones.forEach((s, i) => {
  for (const c of s.campos) {
    const lugar = (rubro, etiqueta) => !ubicaciones.has(rubro) && ubicaciones.set(rubro, { seccion: i, id: c.id, grupo: c.grupo, etiqueta });
    if (c.guia) lugar(c.guia, c.etiqueta);
    for (const e of c.elementos ?? []) if (e.guia) lugar(e.guia, e.etiqueta);
    for (const r of Object.values(c.guias ?? {})) lugar(r, c.etiqueta);
  }
});

// ---------- qué lista de opciones usa cada rubro (Enfoque, Metodología, Instrumentos…) ----------
const listaDe = new Map();   // rubro → nombre de la lista en guia.listas
for (const s of formulario.secciones) for (const c of s.campos) {
  if (c.lista && c.guia) listaDe.set(c.guia, c.lista);
  for (const e of c.elementos ?? []) if (e.lista && e.guia) listaDe.set(e.guia, e.lista);
}
const clave = (t) => palabras(t).join(" ");   // "Tutorías" y "Tutoría" dan lo mismo
// Cada grupo del anexo va con el rubro cuya lista comparte más opciones con él (ej. "Recursos complementarios" → "Recursos multimedia")
function rubroDelAnexo(opciones) {
  const claves = new Set(opciones.map((o) => clave(o.opcion)));
  let mejor = null, maximo = 0;
  for (const [rubro, lista] of listaDe) {
    const comunes = guia.listas[lista].filter((op) => claves.has(clave(op))).length;
    if (comunes > maximo) { mejor = rubro; maximo = comunes; }
  }
  return mejor;
}

// ---------- índice de búsqueda: los 37 rubros y las 73 definiciones del anexo ----------
// Cada documento: { tipo, titulo, subtitulo, rubro (para "Ir al campo"), datos, partes (palabras por parte) }
const PESOS = { titulo: 4, seccion: 1, descripcion: 1.5, recomendacion: 0.6, ejemplo: 0.4 };
const documentos = guia.rubros.map((r) => ({
  tipo: "rubro", titulo: r.rubro, subtitulo: r.seccion, rubro: r.rubro, datos: r,
  partes: {
    titulo: palabras(`${r.rubro} ${ubicaciones.get(r.rubro)?.etiqueta ?? ""}`),
    seccion: palabras(r.seccion),
    descripcion: palabras(r.descripcion),
    recomendacion: palabras(r.recomendacion),
    ejemplo: palabras(r.ejemplo),
  },
}));
for (const [grupo, opciones] of Object.entries(guia.anexo)) {
  const rubro = rubroDelAnexo(opciones);
  const nombreGrupo = grupo.replace(/[:\s]+$/, "");
  for (const o of opciones) {
    documentos.push({
      tipo: "definicion", titulo: o.opcion, subtitulo: `Anexo de la Guía · ${nombreGrupo}`, grupo: nombreGrupo, rubro, datos: o,
      partes: { titulo: palabras(o.opcion), seccion: palabras(nombreGrupo), descripcion: palabras(o.definicion), recomendacion: [], ejemplo: palabras(o.ejemplo) },
    });
  }
}
for (const d of documentos) d.todas = new Set(Object.values(d.partes).flat());
// Opciones con el mismo nombre en dos grupos (ej. "Mapas conceptuales"): en los botones se dice de qué grupo es
const repetidos = new Set(documentos.filter((d, i) => documentos.findIndex((x) => x.titulo === d.titulo) !== i).map((d) => d.titulo));
const nombreBoton = (d) => (repetidos.has(d.titulo) && d.grupo ? `${d.titulo} (${d.grupo})` : d.titulo);

// Las palabras que salen en muchos documentos ("curso", "tema") pesan menos que las raras ("ponderacion")
const enCuantos = new Map();
for (const d of documentos) for (const p of d.todas) enCuantos.set(p, (enCuantos.get(p) ?? 0) + 1);
const rareza = (p) => Math.log(1 + documentos.length / (enCuantos.get(p) ?? 1));

// ¿Coincide la palabra? Igual, una empieza con la otra (≥ 5 letras: "evalua" ↔ "evaluacion")
// o comparten las primeras 6 letras ("autoriza" ↔ "autorizo")
const coincide = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a) || (a.length >= 6 && b.length >= 6 && a.slice(0, 6) === b.slice(0, 6))));

// Orden: más palabras de la pregunta en el título, contando más las raras ("horas" pesa más que "curso");
// luego el título más "completo" ("Cuestionario" antes que "Cuestionarios con retroalimentación inmediata");
// luego los puntos de todo el texto
function buscar(pregunta) {
  const pedidas = [...new Set(palabras(pregunta))];
  if (!pedidas.length) return [];
  return documentos.map((d) => {
    let puntos = 0, enTitulo = 0, pesoTitulo = 0;
    for (const p of pedidas) {
      let mejor = 0;
      for (const [parte, lista] of Object.entries(d.partes)) {
        const hallada = lista.find((x) => coincide(p, x));
        if (hallada) mejor = Math.max(mejor, PESOS[parte] * rareza(hallada));
      }
      const enElTitulo = d.partes.titulo.find((x) => coincide(p, x));
      if (enElTitulo) { enTitulo++; pesoTitulo += rareza(enElTitulo); }
      puntos += mejor;
    }
    const cubierto = d.partes.titulo.filter((x) => pedidas.some((p) => coincide(p, x))).length / Math.max(1, d.partes.titulo.length);
    return { doc: d, puntos, enTitulo, pesoTitulo: Math.round(pesoTitulo * 10) / 10, cubierto };
  }).filter((r) => r.puntos > 0).sort((a, b) => b.pesoTitulo - a.pesoTitulo || b.cubierto - a.cubierto || b.puntos - a.puntos);
}

// ---------- ventana ----------
const panel = $("#asistente");
const conversacion = $("#asistente-conversacion");
const entrada = $("#asistente-pregunta");
const SUGERENCIAS = ["¿Qué pongo en la justificación?", "Ejemplo de objetivo general", "¿Qué es aula invertida?"];

const burbuja = (quien, hijos) => {
  const b = crear("div", { className: `asistente__msj asistente__msj--${quien}` }, hijos);
  conversacion.append(b);
  conversacion.scrollTop = b.offsetTop - conversacion.offsetTop - 8;   // se ve el inicio de la respuesta, sin mover la página
  return b;
};
const chips = (textos, alElegir) => crear("div", { className: "asistente__chips" },
  textos.map((t, i) => { const b = crear("button", { type: "button", className: "asistente__chip", textContent: t }); b.addEventListener("click", () => alElegir(t, i)); return b; }));

// Lleva a la persona al campo del rubro: cambia de sección con el menú y enfoca el campo (así la Guía se abre a su lado)
function irAlCampo(rubro) {
  const u = ubicaciones.get(rubro);
  if (!u) return;
  $(`#menu-secciones li:nth-child(${u.seccion + 1}) button`)?.click();
  cerrar();
  setTimeout(() => {
    const destino = document.getElementById(u.id) ?? document.getElementById(`grupo-${u.grupo}`);
    if (!destino) return;
    const plegado = destino.closest("details");
    if (plegado) plegado.open = true;
    destino.scrollIntoView({ behavior: "smooth", block: "center" });
    if (destino.matches("input, select, textarea")) destino.focus({ preventScroll: true });
  }, 60);
}

const bloque = (titulo, texto, clase = "") => texto && crear("div", { className: `guia__bloque ${clase}` }, [crear("h4", { textContent: titulo }), crear("p", { textContent: texto })]);

// Opciones de la lista del rubro; las que tienen definición en el anexo se pueden abrir
function opcionesDe(rubro) {
  const lista = guia.listas[listaDe.get(rubro)];
  if (!lista) return null;
  return crear("div", { className: "guia__bloque" }, [
    crear("h4", { textContent: `Opciones de la lista (${lista.length})` }),
    crear("div", { className: "asistente__chips" }, lista.map((op) => {
      const def = documentos.find((d) => d.tipo === "definicion" && d.rubro === rubro && clave(d.titulo) === clave(op));
      if (!def) return crear("span", { className: "asistente__opcion", textContent: op });
      const b = crear("button", { type: "button", className: "asistente__chip", textContent: op });
      b.addEventListener("click", () => mostrarDoc(def));
      return b;
    })),
  ]);
}

function respuesta(d, otros) {
  const r = d.datos;
  const ir = d.rubro && ubicaciones.has(d.rubro) && crear("button", { type: "button", className: "boton boton--secundario asistente__ir", textContent: "Ir al campo" });
  ir?.addEventListener("click", () => irAlCampo(d.rubro));
  const contenido = d.tipo === "rubro" ? [
    r.prellenado ? crear("p", { className: "guia__aviso", textContent: "Este rubro viene prellenado. Revísalo y ajústalo si tu curso lo requiere." }) : null,
    bloque("Descripción", r.descripcion),
    bloque("Recomendación", r.recomendacion),
    bloque("Ejemplo", r.ejemplo, "guia__ejemplo"),
    opcionesDe(d.rubro),
  ] : [
    bloque("Definición", r.definicion),
    bloque("Ejemplo", r.ejemplo, "guia__ejemplo"),
    d.rubro ? crear("p", { className: "asistente__donde", textContent: `Se elige en el rubro «${d.rubro}».` }) : null,
  ];
  burbuja("guia", [
    crear("p", { className: "asistente__rubro" }, [crear("strong", { textContent: d.titulo }), crear("small", { textContent: d.subtitulo })]),
    ...contenido,
    ir,
    otros.length ? crear("p", { className: "asistente__tambien", textContent: "También te puede servir:" }) : null,
    otros.length ? chips(otros.map(nombreBoton), (_t, i) => mostrarDoc(otros[i])) : null,
  ]);
}

// Muestra un documento elegido de un botón (sin volver a buscar)
function mostrarDoc(d) {
  burbuja("persona", crear("p", { textContent: nombreBoton(d) }));
  respuesta(d, []);
}

// Responde una pregunta escrita
function mostrar(pregunta) {
  burbuja("persona", crear("p", { textContent: pregunta }));
  const hallados = buscar(pregunta);
  const [primero, ...resto] = hallados;
  if (!primero || primero.enTitulo === 0) {
    // Nada en el nombre de un rubro o de una opción: no se adivina; solo se sugieren los que mencionan esas palabras
    const sugeridos = hallados.slice(0, 3).map((h) => h.doc);
    burbuja("guia", [
      crear("p", { textContent: "No encontré eso en la Guía. Prueba con otras palabras, por ejemplo el nombre del rubro o de la opción." }),
      sugeridos.length ? crear("p", { className: "asistente__tambien", textContent: "Quizá buscas alguno de estos:" }) : null,
      sugeridos.length ? chips(sugeridos.map(nombreBoton), (_t, i) => mostrarDoc(sugeridos[i])) : chips(SUGERENCIAS, (t) => mostrar(t)),
    ]);
    return;
  }
  respuesta(primero.doc, resto.filter((h) => h.enTitulo > 0).slice(0, 3).map((h) => h.doc));
}

function abrir() {
  panel.hidden = false;
  $("#asistente-abrir").setAttribute("aria-expanded", "true");
  if (!conversacion.childElementCount) {
    burbuja("guia", [
      crear("p", { textContent: "Hola. Pregúntame sobre cualquier rubro del Plan descriptivo o sobre las opciones de las listas (metodologías, actividades, recursos, evidencias e instrumentos) y te respondo con lo que dice la Guía de llenado." }),
      chips(SUGERENCIAS, (t) => mostrar(t)),
    ]);
  }
  entrada.focus();
}
function cerrar() {
  panel.hidden = true;
  $("#asistente-abrir").setAttribute("aria-expanded", "false");
}

$("#asistente-abrir").addEventListener("click", () => (panel.hidden ? abrir() : cerrar()));
$("#asistente-cerrar").addEventListener("click", cerrar);
panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { cerrar(); $("#asistente-abrir").focus(); } });
$("#asistente-formulario").addEventListener("submit", (e) => {
  e.preventDefault();
  const pregunta = entrada.value.trim();
  if (!pregunta) return;
  entrada.value = "";
  mostrar(pregunta.slice(0, 300));
});
