// Hoja final del Plan descriptivo: arma la hoja "Plan descriptivo" del Excel oficial (mismos renglones, columnas A–J
// y franjas de sección) con lo que la persona capturó en el formulario, lista para imprimir o guardar en PDF.
// Solo LEE lo guardado en este navegador; no cambia nada.
// la misma que usa el formulario (app.js); si viene de un plan abierto en otra pestaña, llega como ?clave=
const CLAVE = (() => {
  const c = new URLSearchParams(location.search).get("clave") || "";
  return /^plan-descriptivo:v1:PD-[A-Z0-9]{8}$/.test(c) ? c : "plan-descriptivo:v1";
})();

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
let datos = {};
try { datos = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { datos = {}; }

const campos = Object.fromEntries(formulario.secciones.flatMap((s) => s.campos).map((c) => [c.id, c]));
// Los prellenados que nunca se abrieron en el formulario se toman del Excel (igual que hace el formulario)
function prellenado(campo) {
  let v = guia.matriz.find((m) => m.fila === campo.fila)?.valor ?? "";
  const c = formulario.correcciones_prellenado?.[campo.fila];
  if (c) v = v.replace(c.buscar, c.reemplazar);
  return v;
}
function valor(id) {
  const campo = campos[id];
  let v = datos[id];
  if (v === undefined && campo?.prellenado) v = prellenado(campo);
  v = String(v ?? "").trim();
  if (campo?.inicial && v === campo.inicial.trim()) return "";   // solo la frase inicial no cuenta
  return v;
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fecha(id) {
  const m = valor(id).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : valor(id);
}

// ---------- temas ----------
const objetivos = (datos.objetivos_especificos ?? []).map((t) => String(t ?? "").trim());
const nTemas = objetivos[0] ? objetivos.length : 0;
const detalle = (i) => datos.temas_detalle?.[i] ?? {};
const nombreTema = (i) => String(detalle(i).nombre ?? "").trim();
const tituloTema = (i) => (nombreTema(i) ? `Tema ${i + 1}. ${nombreTema(i)}` : `Tema ${i + 1}`);
const porTema = (id, i, clave) => (datos[id]?.[i]?.[clave] ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
const final = (clave) => (datos.evaluacion_temas_final?.[clave] ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
const porcentaje = (v) => (v === "" || v === undefined ? "" : `${v} %`);

// ---------- armado de la tabla (10 columnas, como A–J del Excel) ----------
let vacios = 0;
const tabla = crear("table", { className: "plan" });
const colgroup = crear("colgroup");
for (const ancho of [5.5, 11.5, 8.43, 8.43, 8.43, 11.5, 11.5, 8.43, 8.43, 10.5]) colgroup.append(crear("col", { style: `width:${ancho}%` }));
tabla.append(colgroup);
let cuerpo = crear("tbody");
tabla.append(cuerpo);
// abre un grupo de renglones que no se separa entre páginas al imprimir
const juntos = () => { cuerpo = crear("tbody", { className: "plan__juntos" }); tabla.append(cuerpo); };
const sueltos = () => { cuerpo = crear("tbody"); tabla.append(cuerpo); };

// celda: { e: etiqueta en negritas } o { v: valor capturado (si está vacío se marca) } o { t: texto fijo }
function renglon(celdas, clase = "") {
  const tr = crear("tr", { className: clase });
  for (const c of celdas) {
    const td = crear("td", { colSpan: c.span ?? 1, className: c.clase ?? "" });
    if (c.filas) td.rowSpan = c.filas;
    if ("e" in c) { td.classList.add("plan__etiqueta"); td.textContent = c.e; }
    else if ("v" in c) {
      if (String(c.v ?? "").trim()) td.textContent = c.v;
      else if (!c.opcional) { vacios++; td.append(crear("span", { className: "plan__vacio", textContent: "Sin llenar" })); }
    } else td.textContent = c.t ?? "";
    tr.append(td);
  }
  cuerpo.append(tr);
}
const franja = (texto) => renglon([{ t: texto, span: 10, clase: "plan__franja" }], "plan__fila-franja");

// I. Datos generales
franja("I. Datos generales");
renglon([{ v: valor("nombre_actividad"), span: 7, clase: "plan__nombre" }, { v: fecha("fecha_elaboracion"), span: 3, clase: "plan__centro" }]);
renglon([{ e: "Nombre de la actividad de formación", span: 7, clase: "plan__centro" }, { e: "Fecha de elaboración", span: 3, clase: "plan__centro" }]);
renglon([{ e: "Enfoque", span: 2 }, { v: valor("enfoque"), span: 2, clase: "plan__centro" }, { e: "Modalidad" }, { v: valor("modalidad"), span: 2, clase: "plan__centro" },
  { e: "Duración total estimada (en horas)", span: 2 }, { v: valor("duracion_horas"), clase: "plan__centro" }]);
renglon([{ e: "Lugar o plataforma donde se impartirá", span: 3 }, { v: valor("plataforma"), span: 4 }, { e: "Universo total" }, { v: valor("universo_total"), span: 2, clase: "plan__centro" }]);
renglon([{ e: "Nombre de la Institución", span: 3 }, { v: valor("institucion"), span: 7 }]);
renglon([{ e: "Público objetivo o perfil del participante", span: 3 }, { v: valor("publico_objetivo"), span: 4 }, { e: "Número de participantes por grupo", span: 2 }, { v: valor("participantes_grupo"), clase: "plan__centro" }]);
renglon([{ e: "Responsable del diseño de la actividad", span: 4 }, { v: valor("responsable_diseno"), span: 6 }]);
renglon([{ e: "Correo de la persona responsable del diseño de la actividad", span: 6 }, { v: valor("correo_responsable"), span: 4 }]);
renglon([{ e: "Responsable de los contenidos del curso", span: 4 }, { v: valor("responsable_contenidos"), span: 6 }]);
renglon([{ e: "Fecha propuesta de pilotaje", span: 4 }, { v: fecha("fecha_pilotaje"), span: 6 }]);
renglon([{ e: "Recomendaciones en general para la persona participante", span: 5 }, { v: valor("recomendaciones"), span: 5 }]);

// II. Fundamentación pedagógica
franja("II. Fundamentación pedagógica");
renglon([{ e: "Propósito general", span: 2 }, { v: valor("proposito_general"), span: 8 }]);
renglon([{ e: "Justificación", span: 2 }, { v: valor("justificacion"), span: 8 }]);
const inicial = String(campos.objetivo_general?.inicial ?? "").trim();
const objGeneral = valor("objetivo_general");
renglon([{ e: "Objetivo general", span: 2 }, { v: objGeneral.startsWith(inicial) && inicial ? `${inicial}\n${objGeneral.slice(inicial.length).trim()}` : objGeneral, span: 8 }]);
if (nTemas) {
  for (let i = 0; i < nTemas; i++) {
    renglon([...(i === 0 ? [{ e: "Objetivos específicos", span: 2, filas: nTemas }] : []), { t: `Tema ${i + 1}`, clase: "plan__centro" }, { v: objetivos[i], span: 7 }]);
  }
} else renglon([{ e: "Objetivos específicos", span: 2 }, { v: "", span: 8 }]);
renglon([{ e: "Competencias relacionadas", span: 3 }, { v: valor("competencias"), span: 7, opcional: true }]);

// III. Estructura académica del contenido
franja("III. Estructura académica del contenido");
renglon([{ e: "Estructurado por", span: 2 }, { v: valor("estructura_tipo"), clase: "plan__negrita plan__centro" }, { e: "Subtemas", span: 6, clase: "plan__centro" }, { e: "Horas", clase: "plan__centro" }]);
let horasTotal = 0;
for (let i = 0; i < nTemas; i++) {
  const d = detalle(i);
  const subtemas = (d.subtemas ?? []).map((s, k) => (String(s ?? "").trim() ? `${i + 1}.${k + 1} ${String(s).trim()}` : "")).filter(Boolean).join("\n");
  horasTotal += Number(d.horas) || 0;
  renglon([{ v: nombreTema(i) ? tituloTema(i) : "", span: 3, clase: "plan__chica" }, { v: subtemas, span: 6, clase: "plan__chica" }, { v: d.horas ?? "", clase: "plan__centro" }]);
}
renglon([{ e: "Total:", span: 9, clase: "plan__derecha" }, { t: String(horasTotal), clase: "plan__centro plan__negrita" }]);

// IV. Estrategia didáctica
franja("IV. Estrategia didáctica");
renglon([{ e: "Tema", span: 2, clase: "plan__centro" }, { e: "Metodología de enseñanza y aprendizaje", span: 2, clase: "plan__centro" },
  { e: "Actividades de aprendizaje", span: 3, clase: "plan__centro" }, { e: "Recursos multimedia", span: 3, clase: "plan__centro" }]);
for (let i = 0; i < nTemas; i++) {
  renglon([{ t: tituloTema(i), span: 2, clase: "plan__chica" }, { v: porTema("estrategia_temas", i, "metodologia").join("\n"), span: 2 },
    { v: porTema("estrategia_temas", i, "actividades").join("\n"), span: 3 }, { v: porTema("estrategia_temas", i, "recursos").join("\n"), span: 3 }]);
}

// V. Evaluación del aprendizaje
franja("V. Evaluación del aprendizaje");
renglon([{ t: "", span: 2 }, { e: "Evidencias de aprendizaje", span: 3, clase: "plan__centro" }, { e: "Instrumentos de evaluación", span: 3, clase: "plan__centro" }, { e: "Ponderación", span: 2, clase: "plan__centro" }]);
let pondTotal = 0;
for (let i = 0; i < nTemas; i++) {
  const p = porTema("evaluacion_temas", i, "ponderacion")[0] ?? "";
  pondTotal += Number(p) || 0;
  renglon([{ t: `Tema ${i + 1}`, span: 2 }, { v: porTema("evaluacion_temas", i, "evidencia")[0], span: 3 }, { v: porTema("evaluacion_temas", i, "instrumento")[0], span: 3 }, { v: porcentaje(p), span: 2, clase: "plan__centro" }]);
}
if (["evidencia", "instrumento", "ponderacion"].some((k) => final(k).length)) {
  const p = final("ponderacion")[0] ?? "";
  pondTotal += Number(p) || 0;
  renglon([{ t: "Evaluación final", span: 2 }, { v: final("evidencia")[0], span: 3 }, { v: final("instrumento")[0], span: 3 }, { v: porcentaje(p), span: 2, clase: "plan__centro" }]);
}
renglon([{ t: "", span: 7, clase: "plan__sin-borde" }, { e: "Total", clase: "plan__centro" }, { t: `${Math.round(pondTotal * 100) / 100} %`, span: 2, clase: "plan__centro" }]);
renglon([{ t: "Criterios específicos de acreditación", span: 3 }, { v: valor("criterios_acreditacion"), span: 7 }]);
renglon([{ t: "Retroalimentación", span: 3 }, { v: valor("retroalimentacion"), span: 7 }]);

// VI. Material de apoyo y cierre
franja("VI. Material de apoyo y cierre");
renglon([{ e: "Encuesta de satisfacción", span: 3 }, { v: valor("encuesta_satisfaccion"), span: 7 }]);
juntos();
renglon([{ e: "Referencias iniciales", span: 10 }]);
renglon([{ v: valor("referencias"), span: 10, clase: "plan__referencias" }]);
sueltos();

// VII. Autorización: franja y firmas en un solo bloque (2 renglones de 3, como en el Excel) para que no se separen

const hoja = $("#hoja");
hoja.append(
  crear("header", { className: "hoja__encabezado" }, [
    crear("span", { className: "hoja__logo" }),
    crear("p", { className: "hoja__titulo", textContent: "Plan descriptivo" }),
    crear("span", { className: "hoja__logo hoja__logo--escuela" }),
  ]),
  tabla,
);
const firmas = crear("div", { className: "firmas" });
for (const [id, papel] of [["elaboro_di", "Elaboró diseño instruccional"], ["reviso_di", "Revisó diseño instruccional"], ["contenidos", "Elaboró y revisó contenidos"],
  ["identidad", "Elaboró diseño de identidad gráfica"], ["autorizo_di", "Autorizó diseño instruccional"], ["autorizo_contenidos", "Autorizó contenidos"]]) {
  const dato = (sufijo) => {
    const v = valor(`firma_${id}_${sufijo}`);
    if (v) return crear("p", { className: `firma__${sufijo}`, textContent: v });
    vacios++;
    return crear("p", { className: `firma__${sufijo}` }, crear("span", { className: "plan__vacio", textContent: "Sin llenar" }));
  };
  firmas.append(crear("div", { className: "firma" }, [crear("div", { className: "firma__espacio", ariaHidden: "true" }), dato("nombre"), dato("puesto"), crear("p", { className: "firma__papel", textContent: papel })]));
}
hoja.append(crear("section", { className: "autorizacion" }, [crear("p", { className: "plan__franja autorizacion__franja", textContent: "VII. Autorización" }), firmas]));

// ---------- aviso y botón ----------
const aviso = $("#aviso");
if (!Object.keys(datos).length) aviso.textContent = "Todavía no hay datos guardados en este navegador. Llena el formulario y vuelve a abrir esta hoja.";
else if (vacios) { aviso.textContent = `Hay ${vacios} dato(s) sin llenar (marcados en amarillo). Puedes imprimir así, pero en el papel quedarán en blanco.`; aviso.classList.add("herramientas__aviso--alerta"); }
else { aviso.textContent = "✓ Todos los datos están llenos."; aviso.classList.add("herramientas__aviso--ok"); }
$("#imprimir").addEventListener("click", () => window.print());

// «Volver al formulario»: la hoja se abre en su propia pestaña; se cierra y queda la del formulario
const volver = document.getElementById("volver-formulario");
volver?.addEventListener("click", (e) => {
  e.preventDefault();
  window.close();
  setTimeout(() => { volver.textContent = "Cierra esta pestaña para volver a tu plan"; }, 300);
});

