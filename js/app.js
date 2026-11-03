// Asistente "Plan descriptivo": menú de secciones, formulario en bloques y Guía del campo activo.
// Lo escrito se guarda solo en este navegador (localStorage) mientras se conecta la nube institucional.
const CLAVE = "plan-descriptivo:v1";

const $ = (sel) => document.querySelector(sel);
const crear = (etiqueta, props = {}, hijos = []) => {
  const el = Object.assign(document.createElement(etiqueta), props);
  for (const h of [].concat(hijos)) if (h !== null && h !== undefined && h !== false) el.append(h);
  return el;
};

const [guia, formulario, video] = await Promise.all([
  fetch("datos/guia.json").then((r) => r.json()),
  fetch("datos/formulario.json").then((r) => r.json()),
  fetch("datos/video.json").then((r) => r.json()),
]);
const secciones = formulario.secciones;

const rubroGuia = (nombre) => guia.rubros.find((r) => r.rubro === nombre);
const valorPrellenado = (fila) => {
  let v = guia.matriz.find((m) => m.fila === fila)?.valor ?? "";
  const c = formulario.correcciones_prellenado?.[fila];
  if (c) v = v.replace(c.buscar, c.reemplazar);
  return v;
};

// ---------- datos guardados ----------
let datos = {};
try { datos = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { datos = {}; }
// los prellenados y los textos iniciales se ponen una sola vez
for (const s of secciones) for (const c of s.campos) {
  if (datos[c.id] !== undefined) continue;
  if (c.prellenado) datos[c.id] = valorPrellenado(c.fila);
  else if (c.inicial) datos[c.id] = c.inicial;
  else if (c.predeterminado) datos[c.id] = c.predeterminado;
  else if (c.tipo === "detalle_temas" || c.tipo === "por_tema") datos[c.id] = [];
  else if (c.tipo === "temas") datos[c.id] = [""];
}
let actual = 0;

// ¿El campo tiene algo escrito? (el texto inicial solo no cuenta; en los temas basta el primero)
function lleno(campo) {
  const v = datos[campo.id];
  if (campo.tipo === "temas") return Array.isArray(v) && String(v[0] ?? "").trim() !== "";
  if (campo.tipo === "detalle_temas") return erroresDetalle(campo).length === 0;
  if (campo.tipo === "por_tema") return erroresPorTema(campo).length === 0;
  const texto = String(v ?? "").trim();
  return texto !== "" && texto !== String(campo.inicial ?? "").trim();
}

function guardar() {
  const estado = $("#estado-guardado");
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    const hora = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    estado.textContent = `✓ Guardado en este equipo · ${hora}`;
    estado.classList.remove("estado--alerta");
  } catch {
    estado.textContent = "No se pudo guardar en este navegador";
    estado.classList.add("estado--alerta");
  }
}

// ---------- estado de cada sección ----------
const disponible = (s) => s.campos.length > 0;
const completa = (s) => disponible(s) && s.campos.every((c) => !c.obligatorio || lleno(c));

function pintarMenu() {
  const ol = $("#menu-secciones");
  ol.replaceChildren();
  secciones.forEach((s, i) => {
    const clase = i === actual ? "menu__item--activo" : !disponible(s) ? "menu__item--pendiente" : completa(s) ? "menu__item--completo" : "";
    const icono = completa(s) ? "✓" : disponible(s) ? "○" : "";
    const boton = crear("button", { type: "button", className: "menu__boton", title: disponible(s) ? s.titulo : `${s.titulo} (próximamente)` }, [
      crear("span", { className: "menu__num", textContent: s.numero }),
      crear("span", { textContent: s.titulo }),
      crear("span", { className: "menu__estado", textContent: icono, ariaHidden: "true" }),
    ]);
    if (i === actual) boton.setAttribute("aria-current", "step");
    if (disponible(s)) boton.addEventListener("click", () => irA(i));
    else boton.setAttribute("aria-disabled", "true");
    ol.append(crear("li", { className: `menu__item ${clase}` }, boton));
  });
  const hechas = secciones.filter(completa).length;
  $("#avance-texto").textContent = `Avance: ${hechas} de ${secciones.length} secciones`;
  $("#avance-relleno").style.width = `${(hechas / secciones.length) * 100}%`;
}

// ---------- panel de la Guía ----------
function mostrarGuia(campo) {
  const r = rubroGuia(campo.guia);
  $("#guia-titulo").textContent = campo.etiqueta;
  const cont = $("#guia-contenido");
  cont.replaceChildren();
  if (campo.prellenado) {
    cont.append(crear("p", { className: "guia__aviso", textContent: campo.soloLectura
      ? "Este rubro viene definido por la Escuela de Buen Gobierno y no se modifica."
      : "Este rubro viene prellenado. Revísalo y ajústalo si tu curso lo requiere." }));
  }
  if (!r) {
    cont.append(crear("p", { className: "guia__vacia", textContent: "Este rubro no tiene ayuda en la Guía." }));
    return;
  }
  const bloque = (titulo, texto, clase = "") =>
    texto && cont.append(crear("div", { className: `guia__bloque ${clase}` }, [crear("h4", { textContent: titulo }), crear("p", { textContent: texto })]));
  bloque("Descripción", r.descripcion);
  bloque("Recomendación", r.recomendacion);
  bloque("Ejemplo", r.ejemplo, "guia__ejemplo");
}

// Mueve la Guía para que quede a la altura del campo seleccionado (solo cuando va en la columna derecha)
function alinearGuia(caja) {
  const panel = $(".guia");
  const enColumna = getComputedStyle(panel).gridColumnStart !== "2" && window.innerWidth > 1200;
  if (!enColumna) { panel.style.marginTop = "0px"; panel.classList.remove("guia--con-flecha"); return; }
  const base = $(".contenido").getBoundingClientRect().top;
  const campo = caja.getBoundingClientRect().top - base;
  const limite = Math.max(0, $(".contenido").offsetHeight - panel.offsetHeight);   // que no se salga por abajo
  const desplazamiento = Math.min(Math.max(0, campo - 12), limite);
  panel.style.marginTop = `${desplazamiento}px`;
  panel.style.setProperty("--flecha", `${Math.max(18, Math.min(campo - desplazamiento + 14, panel.offsetHeight - 30))}px`);
  panel.classList.add("guia--con-flecha");
}

// ---------- formulario ----------
function crearControl(campo) {
  const comunes = { id: campo.id, name: campo.id };
  let control;
  if (campo.tipo === "lista") {
    control = crear("select", comunes, [crear("option", { value: "", textContent: "Selecciona una opción" })]);
    for (const op of guia.listas[campo.lista]) control.append(crear("option", { value: op, textContent: op }));
  } else if (campo.tipo === "area") {
    control = crear("textarea", { ...comunes, rows: campo.filas ?? 4 });
  } else {
    const tipos = { texto: "text", numero: "number", fecha: "date", correo: "email" };
    control = crear("input", { ...comunes, type: tipos[campo.tipo] || "text" });
    if (campo.min !== undefined) control.min = campo.min;
  }
  if (campo.soloLectura) control.readOnly = true;
  if (campo.obligatorio) control.required = true;
  control.value = datos[campo.id] ?? "";
  return control;
}

// Al entrar a un campo: se resalta y la Guía se coloca a su lado
function activar(caja, campo) {
  document.querySelectorAll(".campo--activo").forEach((c) => c.classList.remove("campo--activo"));
  caja.classList.add("campo--activo");
  mostrarGuia(campo);
  alinearGuia(caja);
}

function cambio(caja) {
  caja.classList.remove("campo--error");
  caja.querySelector(".campo__error")?.remove();
  guardar();
  pintarMenu();
}

const marcaObligatorio = (campo) =>
  campo.obligatorio ? crear("span", { className: "obligatorio", textContent: " *", title: "Obligatorio" }) : null;

function crearCampo(campo) {
  if (campo.tipo === "temas") return crearTemas(campo);
  if (campo.tipo === "detalle_temas") return crearDetalleTemas(campo);
  if (campo.tipo === "por_tema") return crearPorTema(campo);
  const control = crearControl(campo);
  const etiqueta = crear("label", { htmlFor: campo.id }, [campo.etiqueta, marcaObligatorio(campo)]);
  const caja = crear("div", { className: `campo campo--${campo.ancho ?? 6}` }, [etiqueta, control]);
  control.addEventListener("focus", () => activar(caja, campo));
  control.addEventListener("input", () => { datos[campo.id] = control.value; cambio(caja); });
  return caja;
}

// ---------- Detalle de cada tema (sección III): nombre, horas y subtemas ----------
const numeroTemas = (campo) => (datos[campo.origen] ?? []).length;
function detalle(campo, i) {
  datos[campo.id] ??= [];
  datos[campo.id][i] ??= { nombre: "", horas: "", subtemas: [""] };
  return datos[campo.id][i];
}

// Lista de lo que falta: [{ id de la casilla, mensaje }]
function erroresDetalle(campo) {
  const lista = [];
  const n = numeroTemas(campo);
  if (!n || !String(datos[campo.origen][0] ?? "").trim()) return [{ id: `${campo.id}_sin_temas`, mensaje: "Primero escribe los objetivos específicos de tus temas en la sección II." }];
  for (let i = 0; i < n; i++) {
    const d = detalle(campo, i);
    if (!d.nombre.trim()) lista.push({ id: `${campo.id}_${i}_nombre`, mensaje: "Escribe el nombre del tema." });
    if (!(Number(d.horas) > 0)) lista.push({ id: `${campo.id}_${i}_horas`, mensaje: "Indica las horas (mayor a 0)." });
    if (!String(d.subtemas[0] ?? "").trim()) lista.push({ id: `${campo.id}_${i}_sub_0`, mensaje: "Escribe al menos el primer subtema." });
  }
  return lista;
}

function crearDetalleTemas(campo) {
  const caja = crear("div", { className: "campo campo--6 detalle", id: campo.id });
  const n = numeroTemas(campo);
  const guiaDe = (clave) => ({ ...campo, etiqueta: { nombre: "Nombre del tema", horas: "Tiempo estimado en horas", subtemas: "Nombre de los subtemas" }[clave], guia: campo.guias[clave] });
  const resumen = crear("p", { className: "detalle__resumen", role: "status" });

  function actualizarResumen() {
    const suma = Array.from({ length: n }, (_, i) => Number(detalle(campo, i).horas) || 0).reduce((a, b) => a + b, 0);
    const total = Number(datos.duracion_horas) || 0;
    resumen.className = "detalle__resumen";
    if (!total) resumen.textContent = `Suma de horas de los temas: ${suma}. Escribe la duración total en la sección I para compararla.`;
    else if (suma === total) { resumen.textContent = `✓ La suma de los temas (${suma} h) coincide con la duración total del curso (${total} h).`; resumen.classList.add("detalle__resumen--ok"); }
    else { resumen.textContent = `La suma de los temas es ${suma} h y la duración total del curso es ${total} h. Ajusta las horas para que coincidan.`; resumen.classList.add("detalle__resumen--aviso"); }
  }

  if (!n || !String(datos[campo.origen][0] ?? "").trim()) {
    const ir = crear("button", { type: "button", className: "boton boton--secundario", textContent: "Ir a la sección II" });
    ir.addEventListener("click", () => irA(secciones.findIndex((s) => s.campos.some((c) => c.id === campo.origen))));
    caja.append(crear("div", { className: "detalle__vacio", id: `${campo.id}_sin_temas` }, [
      crear("p", { textContent: "Todavía no hay temas. Escribe primero los objetivos específicos en la sección II; aquí aparecerá una tarjeta por cada tema." }), ir,
    ]));
    return caja;
  }

  for (let i = 0; i < n; i++) {
    const d = detalle(campo, i);
    const num = i + 1;
    const tarjeta = crear("section", { className: "tema" });
    tarjeta.setAttribute("aria-label", `Tema ${num}`);
    const objetivo = String(datos[campo.origen][i] ?? "").trim();

    const nombre = crear("textarea", { id: `${campo.id}_${i}_nombre`, rows: 2, value: d.nombre });
    const horas = crear("input", { id: `${campo.id}_${i}_horas`, type: "number", min: 0, step: 0.5, value: d.horas });
    const subLista = crear("ol", { className: "tema__subtemas" });
    const agregar = crear("button", { type: "button", className: "boton boton--secundario temas__agregar" });

    const enfocar = (control, clave) => control.addEventListener("focus", () => activar(tarjeta, guiaDe(clave)));
    enfocar(nombre, "nombre");
    enfocar(horas, "horas");
    nombre.addEventListener("input", () => { d.nombre = nombre.value; cambio(tarjeta); });
    horas.addEventListener("input", () => { d.horas = horas.value; cambio(tarjeta); actualizarResumen(); });

    function pintarSubtemas() {
      subLista.replaceChildren();
      d.subtemas.forEach((texto, k) => {
        const idSub = `${campo.id}_${i}_sub_${k}`;
        const entrada = crear("input", { id: idSub, type: "text", value: texto });
        enfocar(entrada, "subtemas");
        entrada.addEventListener("input", () => { d.subtemas[k] = entrada.value; cambio(tarjeta); });
        const quitar = k === 0 ? crear("span") : crear("button", { type: "button", className: "boton boton--fantasma temas__quitar", textContent: "Quitar", title: `Quitar el subtema ${num}.${k + 1}` });
        if (k > 0) quitar.addEventListener("click", () => { d.subtemas.splice(k, 1); pintarSubtemas(); cambio(tarjeta); });
        subLista.append(crear("li", { className: "tema__subtema" }, [crear("label", { htmlFor: idSub, className: "temas__etiqueta", textContent: `${num}.${k + 1}` }), entrada, quitar]));
      });
      agregar.textContent = `+ Agregar subtema ${num}.${d.subtemas.length + 1}`;
      agregar.hidden = d.subtemas.length >= (campo.maxSubtemas ?? 15);
    }
    agregar.addEventListener("click", () => {
      d.subtemas.push("");
      pintarSubtemas();
      cambio(tarjeta);
      subLista.querySelector("li:last-child input")?.focus();
    });
    pintarSubtemas();

    tarjeta.append(
      crear("h4", { className: "tema__titulo", textContent: `Tema ${num}` }),
      objetivo ? crear("p", { className: "tema__objetivo" }, [crear("strong", { textContent: "Objetivo: " }), objetivo]) : null,
      crear("div", { className: "tema__fila" }, [
        crear("div", { className: "tema__nombre" }, [crear("label", { htmlFor: nombre.id }, ["Nombre del tema", marcaObligatorio(campo)]), nombre]),
        crear("div", { className: "tema__horas" }, [crear("label", { htmlFor: horas.id }, ["Horas", marcaObligatorio(campo)]), horas]),
      ]),
      crear("p", { className: "tema__subtitulo" }, ["Nombre de los subtemas", marcaObligatorio(campo)]),
      subLista, agregar,
    );
    caja.append(tarjeta);
  }
  caja.append(resumen);
  actualizarResumen();
  return caja;
}

// Aviso cuando todavía no hay temas (secciones IV y V; igual al de la sección III)
function avisoSinTemas(campo) {
  const ir = crear("button", { type: "button", className: "boton boton--secundario", textContent: "Ir a la sección II" });
  ir.addEventListener("click", () => irA(secciones.findIndex((s) => s.campos.some((c) => c.id === campo.origen))));
  return crear("div", { className: "detalle__vacio", id: `${campo.id}_sin_temas` }, [
    crear("p", { textContent: "Todavía no hay temas. Escribe primero los objetivos específicos en la sección II; aquí aparecerá una tarjeta por cada tema." }), ir,
  ]);
}

// ---------- Datos por tema (secciones IV y V): listas desplegables y porcentajes ----------
function seleccion(campo, i) {
  datos[campo.id] ??= [];
  datos[campo.id][i] ??= {};
  for (const el of campo.elementos) datos[campo.id][i][el.clave] ??= Array(el.cantidad).fill("");
  return datos[campo.id][i];
}

// La tarjeta opcional del final (ej. evaluación final, fila propia en el Excel) se guarda aparte: <id>_final
function seleccionExtra(campo) {
  const clave = `${campo.id}_final`;
  datos[clave] ??= {};
  for (const el of campo.elementos) datos[clave][el.clave] ??= Array(el.cantidad).fill("");
  return datos[clave];
}

const sinValor = (v) => String(v ?? "").trim() === "";
const porcentajeValido = (v) => !sinValor(v) && Number(v) >= 0 && Number(v) <= 100;
const redondear = (x) => Math.round(x * 100) / 100;

// Suma de la clave indicada en 'suma' (todos los temas + la tarjeta final)
function sumaPorTema(campo) {
  const valores = Array.from({ length: numeroTemas(campo) }, (_, i) => seleccion(campo, i)[campo.suma.clave][0]);
  if (campo.extra) valores.push(seleccionExtra(campo)[campo.suma.clave][0]);
  return redondear(valores.reduce((a, v) => a + (Number(v) || 0), 0));
}

function erroresElementos(campo, d, prefijo, lista) {
  for (const el of campo.elementos) for (let k = 0; k < el.minimo; k++) {
    const v = d[el.clave][k];
    const id = `${prefijo}_${el.clave}_${k}`;
    if (el.tipo === "porcentaje") {
      if (sinValor(v)) lista.push({ id, mensaje: "Escribe el porcentaje (puede ser 0)." });
      else if (!porcentajeValido(v)) lista.push({ id, mensaje: "Debe ser un número de 0 a 100." });
    } else if (!v) lista.push({ id, mensaje: `Elige ${el.cantidad > 1 ? "al menos una opción" : "una opción"}.` });
  }
}

function erroresPorTema(campo) {
  const lista = [];
  const n = numeroTemas(campo);
  if (!n || !String(datos[campo.origen][0] ?? "").trim()) return [{ id: `${campo.id}_sin_temas`, mensaje: "Primero escribe los objetivos específicos de tus temas en la sección II." }];
  for (let i = 0; i < n; i++) erroresElementos(campo, seleccion(campo, i), `${campo.id}_${i}`, lista);
  if (campo.extra) {
    const f = seleccionExtra(campo);
    if (campo.elementos.some((el) => !sinValor(f[el.clave][0]))) {   // si se empezó a llenar, se piden los tres datos
      erroresElementos(campo, f, `${campo.id}_final`, lista);
      const p = f[campo.suma?.clave]?.[0];
      if (campo.suma && porcentajeValido(p) && Number(p) === 0) lista.push({ id: `${campo.id}_final_${campo.suma.clave}_0`, mensaje: "Si usas la evaluación final, su porcentaje debe ser mayor a 0." });
    }
  }
  if (campo.suma) {
    const s = sumaPorTema(campo);
    if (s !== campo.suma.total) lista.push({ id: `${campo.id}_suma`, mensaje: `La ponderación suma ${s} %; debe sumar exactamente ${campo.suma.total} %.` });
  }
  return lista;
}

// Una tarjeta con las listas (y casillas de %) de un tema
function tarjetaPorTema(campo, d, prefijo, titulo, nota, obligatoria, alCambiar, clase = "") {
  const tarjeta = crear("section", { className: `tema ${clase}` });
  tarjeta.setAttribute("aria-label", titulo);
  tarjeta.append(crear("h4", { className: "tema__titulo", textContent: titulo }));
  if (nota) tarjeta.append(nota);
  const opciones = crear("div", { className: `tema__opciones${campo.enLinea ? " tema__opciones--linea" : ""}` });
  for (const el of campo.elementos) {
    const grupo = crear("div", { className: `tema__eleccion tema__eleccion--${el.cantidad}` });
    const selects = [];
    // en el mismo rubro no se puede repetir la opción (ej. dos veces la misma actividad)
    const bloquearRepetidas = () => selects.forEach((s, k) => {
      for (const op of s.options) op.disabled = op.value !== "" && selects.some((otro, j) => j !== k && otro.value === op.value);
    });
    for (let k = 0; k < el.cantidad; k++) {
      const id = `${prefijo}_${el.clave}_${k}`;
      const pedida = obligatoria && k < el.minimo;
      let control;
      let texto;
      if (el.tipo === "porcentaje") {
        texto = `${el.etiqueta} (%)`;
        control = crear("input", { id, type: "number", min: 0, max: 100, step: "any", inputMode: "decimal", value: d[el.clave][k] ?? "" });
        control.addEventListener("input", () => { d[el.clave][k] = control.value; cambio(tarjeta); alCambiar(); });
      } else {
        texto = el.cantidad === 1 ? el.etiqueta : `${el.corto} ${k + 1}${k < el.minimo ? "" : " (opcional)"}`;
        control = crear("select", { id }, [crear("option", { value: "", textContent: "Selecciona una opción" })]);
        for (const op of guia.listas[el.lista]) control.append(crear("option", { value: op, textContent: op }));
        control.value = d[el.clave][k] ?? "";
        control.addEventListener("change", () => { d[el.clave][k] = control.value; bloquearRepetidas(); cambio(tarjeta); alCambiar(); });
        selects.push(control);
      }
      control.addEventListener("focus", () => activar(tarjeta, { ...campo, etiqueta: el.etiqueta, guia: el.guia }));
      grupo.append(crear("div", { className: "tema__lista" }, [crear("label", { htmlFor: id }, [texto, pedida ? marcaObligatorio(campo) : null]), control]));
    }
    bloquearRepetidas();
    opciones.append(grupo);
  }
  tarjeta.append(opciones);
  return tarjeta;
}

function crearPorTema(campo) {
  const caja = crear("div", { className: "campo campo--6 detalle", id: campo.id });
  const n = numeroTemas(campo);
  if (!n || !String(datos[campo.origen][0] ?? "").trim()) {
    caja.append(avisoSinTemas(campo));
    return caja;
  }

  // renglón con la suma (ej. ponderación = 100 %), se actualiza al escribir
  const resumen = campo.suma ? crear("p", { className: "detalle__resumen", id: `${campo.id}_suma`, role: "status" }) : null;
  const actualizarSuma = () => {
    if (!resumen) return;
    const s = sumaPorTema(campo);
    const total = campo.suma.total;
    resumen.className = "detalle__resumen";
    if (s === total) { resumen.textContent = `✓ La ponderación suma ${total} %.`; resumen.classList.add("detalle__resumen--ok"); }
    else { resumen.textContent = `La ponderación suma ${s} %. ${s < total ? `Faltan ${redondear(total - s)}` : `Sobran ${redondear(s - total)}`} % para llegar a ${total} %.`; resumen.classList.add("detalle__resumen--aviso"); }
  };

  for (let i = 0; i < n; i++) {
    const num = i + 1;
    const nombreTema = String(datos[campo.nombres]?.[i]?.nombre ?? "").trim();
    const nota = nombreTema ? null : crear("p", { className: "tema__objetivo" }, [crear("strong", { textContent: "Objetivo: " }), String(datos[campo.origen][i] ?? "").trim()]);
    caja.append(tarjetaPorTema(campo, seleccion(campo, i), `${campo.id}_${i}`, nombreTema ? `Tema ${num}. ${nombreTema}` : `Tema ${num}`, nota, true, actualizarSuma));
  }
  if (campo.extra) {
    const nota = crear("p", { className: "tema__objetivo", textContent: campo.extra.nota });
    caja.append(tarjetaPorTema(campo, seleccionExtra(campo), `${campo.id}_final`, campo.extra.titulo, nota, false, actualizarSuma, "tema--extra"));
  }
  if (resumen) { caja.append(resumen); actualizarSuma(); }
  return caja;
}

// Lista de un renglón por tema (Tema 1, Tema 2…), con botones para agregar y quitar
function crearTemas(campo) {
  const caja = crear("fieldset", { className: `campo campo--${campo.ancho ?? 6} temas`, id: campo.id });
  const lista = crear("ol", { className: "temas__lista" });
  const agregar = crear("button", { type: "button", className: "boton boton--secundario temas__agregar" });

  function pintar() {
    const valores = datos[campo.id];
    lista.replaceChildren();
    valores.forEach((texto, i) => {
      const idTema = `${campo.id}_${i + 1}`;
      const area = crear("textarea", { id: idTema, rows: 2, value: texto });
      area.addEventListener("focus", () => activar(caja, campo));
      area.addEventListener("input", () => { datos[campo.id][i] = area.value; cambio(caja); });
      const quitar = i === 0 ? null : crear("button", {
        type: "button", className: "boton boton--fantasma temas__quitar", textContent: "Quitar",
        title: `Quitar el ${campo.prefijo} ${i + 1}`,
      });
      quitar?.addEventListener("click", () => {
        datos[campo.id].splice(i, 1);
        for (const v of campo.vinculados ?? []) if (Array.isArray(datos[v])) datos[v].splice(i, 1);   // ej. el detalle del tema en la sección III
        pintar();
        cambio(caja);
      });
      lista.append(crear("li", { className: "temas__item" }, [
        crear("label", { htmlFor: idTema, className: "temas__etiqueta" }, [`${campo.prefijo} ${i + 1}`, i === 0 ? marcaObligatorio(campo) : null]),
        area, quitar,
      ]));
    });
    const n = valores.length;
    agregar.textContent = `+ Agregar ${campo.prefijo.toLowerCase()} ${n + 1}`;
    agregar.hidden = n >= (campo.maximo ?? 8);
  }

  agregar.addEventListener("click", () => {
    datos[campo.id].push("");
    pintar();
    cambio(caja);
    lista.querySelector("li:last-child textarea")?.focus();
  });
  pintar();
  caja.append(
    crear("legend", {}, [campo.etiqueta, marcaObligatorio(campo)]),
    campo.ayuda ? crear("p", { className: "temas__ayuda", textContent: campo.ayuda }) : null,
    lista, agregar,
  );
  return caja;
}

function pintarSeccion() {
  const s = secciones[actual];
  $("#numero-seccion").textContent = `Sección ${s.numero} de ${secciones.length}`;
  $("#titulo-seccion").textContent = s.titulo;
  const form = $("#formulario");
  form.replaceChildren();
  const grupos = s.grupos ?? [{ id: "_", titulo: s.titulo }];
  for (const g of grupos) {
    const campos = s.campos.filter((c) => (c.grupo ?? "_") === g.id);
    if (!campos.length) continue;
    const cuerpo = crear("div", { className: "bloque__cuerpo" }, [
      g.nota ? crear("p", { className: "bloque__nota", textContent: g.nota }) : null,
      ...campos.map(crearCampo),
    ]);
    if (g.plegable) {
      const titulo = crear("summary", { className: "bloque__titulo" }, [
        g.titulo, crear("span", { className: "bloque__contador", textContent: `(${campos.length} ${campos.length === 1 ? "rubro" : "rubros"})` }),
      ]);
      form.append(crear("details", { className: "bloque", id: `grupo-${g.id}` }, [titulo, cuerpo]));
    } else {
      form.append(crear("section", { className: "bloque", id: `grupo-${g.id}` }, [crear("h3", { className: "bloque__titulo", textContent: g.titulo }), cuerpo]));
    }
  }
  // Botón "Ver esta parte en el video" si la sección tiene capítulo
  const cap = video.capitulos.find((c) => c.seccion === s.id);
  $("#ver-video").hidden = !cap;
  $("#ver-video").onclick = cap ? () => abrirVideo(cap.inicio) : null;
  // Botones: solo se avanza a secciones que ya existen
  const siguienteDisp = secciones.findIndex((x, i) => i > actual && disponible(x));
  $("#anterior").disabled = actual === 0;
  $("#siguiente").disabled = siguienteDisp === -1;
  $("#siguiente").title = siguienteDisp === -1 ? "Las siguientes secciones estarán disponibles pronto" : "";
  pintarMenu();
}

function irA(i) {
  cerrarVideo();
  actual = i;
  pintarSeccion();
  $(".guia").style.marginTop = "0px";
  $(".guia").classList.remove("guia--con-flecha");
  $("#guia-titulo").textContent = "Selecciona un campo";
  $("#guia-contenido").replaceChildren(crear("p", { className: "guia__vacia", textContent: "Haz clic en cualquier campo del formulario para ver su descripción, una recomendación y un ejemplo." }));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- revisión de la sección ----------
function revisar() {
  const s = secciones[actual];
  let faltan = 0;
  document.querySelectorAll(".subcampo--error").forEach((e) => e.classList.remove("subcampo--error"));
  document.querySelectorAll(".subcampo__error").forEach((e) => e.remove());
  for (const campo of s.campos) {
    if (campo.tipo === "detalle_temas" || campo.tipo === "por_tema") {
      for (const { id, mensaje } of (campo.tipo === "por_tema" ? erroresPorTema(campo) : erroresDetalle(campo))) {
        faltan++;
        const el = document.getElementById(id);
        if (!el) continue;
        el.classList.add("subcampo--error");
        el.insertAdjacentElement("afterend", crear("p", { className: "campo__error subcampo__error", textContent: mensaje }));
      }
      continue;
    }
    const control = document.getElementById(campo.id);
    const caja = control.closest(".campo");
    caja.querySelector(".campo__error")?.remove();
    caja.classList.remove("campo--error");
    let error = "";
    if (campo.obligatorio && !lleno(campo)) {
      error = campo.tipo === "temas" ? `Escribe al menos el objetivo del ${campo.prefijo} 1.`
        : campo.inicial ? "Completa el texto después de la frase inicial."
        : "Este campo es obligatorio.";
    } else if (campo.tipo !== "temas" && control.value && !control.checkValidity()) {
      error = campo.tipo === "correo" ? "Escribe un correo válido." : "Revisa este dato.";
    }
    if (error) {
      faltan++;
      caja.classList.add("campo--error");
      caja.append(crear("p", { className: "campo__error", textContent: error }));
      caja.closest("details")?.setAttribute("open", "");   // si el error está en un bloque plegado, se abre
    }
  }
  const estado = $("#estado-guardado");
  estado.textContent = faltan ? `Faltan ${faltan} dato(s) por completar o corregir` : "✓ Sección completa";
  estado.classList.toggle("estado--alerta", faltan > 0);
  if (faltan) document.querySelector(".campo--error input, .campo--error select, .campo--error textarea")?.focus();
}

// ---------- video tutorial ----------
const reproductor = $("#reproductor");
reproductor.src = video.archivo;
reproductor.poster = video.portada;
const mmss = (seg) => `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, "0")}`;

function pintarCapitulos() {
  const ol = $("#lista-capitulos");
  ol.replaceChildren();
  video.capitulos.forEach((c, i) => {
    if (c.parte) ol.append(crear("li", { className: "capitulos__parte", textContent: c.parte }));
    const b = crear("button", { type: "button", className: "capitulos__boton" }, [
      crear("span", { className: "capitulos__tiempo", textContent: mmss(c.inicio) }), crear("span", { textContent: c.titulo }),
    ]);
    b.dataset.indice = i;
    b.addEventListener("click", () => { reproductor.currentTime = c.inicio; reproductor.play().catch(() => {}); });
    ol.append(crear("li", {}, b));
  });
}

function marcarCapitulo() {
  const t = reproductor.currentTime;
  let i = 0;
  video.capitulos.forEach((c, k) => { if (t >= c.inicio - 0.2) i = k; });
  document.querySelectorAll(".capitulos__boton").forEach((b) => b.classList.toggle("capitulos__boton--actual", Number(b.dataset.indice) === i));
  $("#capitulo-actual").replaceChildren("Estás viendo: ", crear("strong", { textContent: video.capitulos[i].titulo }));
}

function abrirVideo(inicio) {
  $("#vista-seccion").hidden = true;
  $(".guia").hidden = true;
  $("#vista-video").hidden = false;
  $("#panel-capitulos").hidden = false;
  $("#menu-video").classList.add("menu__video--activo");
  $("#volver-seccion").textContent = `‹ Volver a la sección ${secciones[actual].numero}. ${secciones[actual].titulo}`;
  if (typeof inicio === "number") {
    reproductor.currentTime = inicio;
    reproductor.play().catch(() => {});
  }
  marcarCapitulo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cerrarVideo() {
  reproductor.pause();
  $("#vista-video").hidden = true;
  $("#panel-capitulos").hidden = true;
  $("#vista-seccion").hidden = false;
  $(".guia").hidden = false;
  $("#menu-video").classList.remove("menu__video--activo");
}

reproductor.addEventListener("timeupdate", marcarCapitulo);
$("#menu-video").addEventListener("click", () => abrirVideo());
$("#volver-seccion").addEventListener("click", () => irA(actual));
pintarCapitulos();

$("#revisar").addEventListener("click", revisar);
$("#anterior").addEventListener("click", () => actual > 0 && irA(actual - 1));
$("#siguiente").addEventListener("click", () => {
  const i = secciones.findIndex((x, k) => k > actual && disponible(x));
  if (i !== -1) irA(i);
});

pintarSeccion();
guardar();
