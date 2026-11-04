// Se ejecuta antes que todo. Decide qué plan ve esta pestaña:
//   · Pestaña nueva → el formulario de siempre, VACÍO, para un plan nuevo. Se borra cualquier plan que
//     haya quedado en el navegador, para que nadie vea el plan de otra persona.
//   · Pestaña abierta con «Modificar un plan guardado» (/?abrir=FOLIO) → ese plan, que la otra pestaña
//     ya trajo de la nube con el folio y el correo correctos (lo deja en localStorage con un pase de un solo uso).
// Cada pestaña guarda su plan en su propia clave (sessionStorage "pd:clave"), para que dos planes abiertos no se mezclen.
(function () {
  // Mientras se arma el formulario no se muestra a medias: solo «Cargando…» (nube.js lo quita; por si acaso, a los 8 s)
  var raiz = document.documentElement;
  raiz.classList.add("cargando");
  setTimeout(function () { raiz.classList.remove("cargando"); }, 8000);
  var BASE = "plan-descriptivo:v1";
  try {
    var ss = window.sessionStorage, ls = window.localStorage;
    var abrir = new URLSearchParams(location.search).get("abrir") || "";
    if (/^PD-[A-Z0-9]{8}$/.test(abrir) && ls.getItem("pd:abrir") === abrir && ls.getItem(BASE + ":" + abrir)) {
      ss.setItem("pd:ficha", ls.getItem("pd:abrir-ficha") || "");   // la ficha que aparta el plan para esta pestaña
      ls.removeItem("pd:abrir");                       // el pase solo sirve una vez
      ls.removeItem("pd:abrir-ficha");
      ss.setItem("pd:clave", BASE + ":" + abrir);
      ss.setItem("pd:folio", abrir);
      ss.setItem("pd:foto", "1");                      // nube.js toma la "foto" de lo guardado al terminar de cargar
      ss.setItem("pd:pestana", "1");
      history.replaceState(null, "", location.pathname);
    } else if (!ss.getItem("pd:pestana")) {
      for (var i = ls.length - 1; i >= 0; i--) {
        var k = ls.key(i);
        if (k === BASE || k.indexOf(BASE + ":") === 0 || k === "plan-descriptivo:folio" || k === "pd:abrir" || k === "pd:abrir-ficha") ls.removeItem(k);
      }
      ss.setItem("pd:pestana", "1");
    }
  } catch (e) { /* sin almacenamiento: el formulario funciona igual, sin recordar nada */ }
})();
