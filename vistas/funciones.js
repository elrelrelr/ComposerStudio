// ==================== ESTADO GLOBAL ====================
let secciones = [];
let historialUndo = [];
const MAX_UNDO = 50;
let paintMode = false;
let currentPaintColor = '#000000';
let currentBrushSize = 3;
let paintData = new Map();
let ultimaSeccionFocoId = null;
let ultimaLineaFocoIndice = 0;
let ultimoOffsetFoco = 0;
let secuenciaTransicion = [];
window._playbackTimers = [];

// ==================== SISTEMA DE TRANSICIONES (→) ====================
function abrirModalTransicion(callback) {
    const modalElement = document.getElementById('modalTransicion');
    const modal = new bootstrap.Modal(modalElement);
    const listaSecciones = document.getElementById('listaSeccionesTransicion');
    const inputRep = document.getElementById('repeticionesTransicion');
    const btnConfirmar = document.getElementById('btnConfirmarTransicion');
    const previewTexto = document.getElementById('previewTransicionTexto');
    const btnPuntos = document.getElementById('btnAgregarPuntosTransicion');
    const btnLimpiar = document.getElementById('btnLimpiarTransicion');
    
    // Limpiar estado
    secuenciaTransicion = [];
    inputRep.value = 1;

    const actualizarPreview = () => {
        let texto = '→ ';
        if (secuenciaTransicion.length > 0) {
            texto += secuenciaTransicion.join(', ');
            const rep = parseInt(inputRep.value) || 1;
            if (rep > 1) {
                texto += ` x${rep}`;
            }
        }
        previewTexto.textContent = texto;
    };

    actualizarPreview();
    
    // Poblar secciones únicas
    listaSecciones.innerHTML = '';
    const tiposUnicos = [...new Set(secciones.map(s => s.tipo))];
    tiposUnicos.forEach(tipo => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-primary btn-sm';
        btn.textContent = tipo;
        btn.onclick = () => {
            secuenciaTransicion.push(tipo);
            actualizarPreview();
        };
        listaSecciones.appendChild(btn);
    });

    btnPuntos.onclick = () => {
        secuenciaTransicion.push('...');
        actualizarPreview();
    };

    btnLimpiar.onclick = () => {
        secuenciaTransicion = [];
        actualizarPreview();
    };

    inputRep.oninput = actualizarPreview;

    // Manejar confirmación
    btnConfirmar.onclick = () => {
        actualizarPreview();
        const resultado = previewTexto.textContent;
        
        let hiddenHandler = () => {
            modalElement.removeEventListener('hidden.bs.modal', hiddenHandler);
            callback(resultado + ' ');
        };
        modalElement.addEventListener('hidden.bs.modal', hiddenHandler);
        modal.hide();
    };

    modal.show();
}

function abrirModalBadge(callback) {
    const modalElement = document.getElementById('modalBadge');
    const modal = new bootstrap.Modal(modalElement);
    const badgeTexto = document.getElementById('badgeTexto');
    const badgePreviewSpan = document.getElementById('badgePreviewSpan');
    const btnConfirmar = document.getElementById('btnConfirmarBadge');
    
    // Reset inputs
    badgeTexto.value = '';
    badgePreviewSpan.className = 'badge bg-primary';
    badgePreviewSpan.textContent = 'Badge';
    
    // Select default radio button (primary)
    const radioPrimary = document.getElementById('btnRadioPrimary');
    if (radioPrimary) radioPrimary.checked = true;

    const obtenerColorSeleccionado = () => {
        const radios = document.getElementsByName('badgeColorRadio');
        for (const r of radios) {
            if (r.checked) return r.value;
        }
        return 'primary';
    };

    const actualizarPreview = () => {
        const text = badgeTexto.value.trim() || 'Badge';
        const color = obtenerColorSeleccionado();
        
        let textColorClass = '';
        if (color === 'warning' || color === 'info' || color === 'light') {
            textColorClass = ' text-dark';
        }
        
        badgePreviewSpan.className = `badge bg-${color}${textColorClass}`;
        badgePreviewSpan.textContent = text;
    };

    // Listen to events
    badgeTexto.oninput = actualizarPreview;
    
    const radios = document.getElementsByName('badgeColorRadio');
    radios.forEach(radio => {
        radio.onchange = actualizarPreview;
    });

    btnConfirmar.onclick = () => {
        const text = badgeTexto.value.trim();
        if (!text) {
            mostrarNotificacion('Por favor, escribe un texto para el badge', 'warning');
            return;
        }
        const color = obtenerColorSeleccionado();
        const syntax = ` [badge-${color}:${text}] `;
        
        let hiddenHandler = () => {
            modalElement.removeEventListener('hidden.bs.modal', hiddenHandler);
            if (callback) {
                callback(syntax);
            } else {
                insertarEnSeccion(syntax);
            }
        };
        modalElement.addEventListener('hidden.bs.modal', hiddenHandler);
        modal.hide();
    };

    modal.show();
}


function detenerReproduccionPiano() {
    if (window._playbackTimers) {
        window._playbackTimers.forEach(timerId => clearTimeout(timerId));
        window._playbackTimers = [];
    }
    detenerMetronomo();
    limpiarMarcasPiano(false);
    const pianoDisplay = document.getElementById('pianoDisplay');
    if (pianoDisplay) {
        pianoDisplay.innerHTML = '<span class="text-danger fw-bold">DETENIDO</span>';
        setTimeout(() => { 
            if (pianoDisplay.textContent === 'DETENIDO') pianoDisplay.textContent = ''; 
        }, 1500);
    }
    
    // Resetear botón metrónomo
    const btnMet = document.getElementById('btnMetronomo');
    if (btnMet) {
        btnMet.classList.remove('btn-danger', 'active');
        btnMet.classList.add('btn-outline-primary');
        btnMet.innerHTML = '<i class="bi bi-metronome"></i>';
    }
}

// Escalas para sugerencia de tonalidad
const escalas = {
    "C": ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
    "G": ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
    "D": ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
    "A": ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
    "E": ["E", "F#m", "G#m", "A", "B", "C#m", "D#dim"],
    "B": ["B", "C#m", "D#m", "E", "F#", "G#m", "A#dim"],
    "F#": ["F#", "G#m", "A#m", "B", "C#", "D#m", "E#dim"],
    "Db": ["Db", "Ebm", "Fm", "Gb", "Ab", "Bbm", "Cdim"],
    "Ab": ["Ab", "Bbm", "Cm", "Db", "Eb", "Fm", "Gdim"],
    "Eb": ["Eb", "Fm", "Gm", "Ab", "Bb", "Cm", "Ddim"],
    "Bb": ["Bb", "Cm", "Dm", "Eb", "F", "Gm", "Adim"],
    "F": ["F", "Gm", "Am", "Bb", "C", "Dm", "Edim"],
    "Am": ["Am", "Bdim", "C", "Dm", "Em", "F", "G"],
    "Em": ["Em", "F#dim", "G", "Am", "Bm", "C", "D"],
    "Bm": ["Bm", "C#dim", "D", "Em", "F#m", "G", "A"],
    "F#m": ["F#m", "G#dim", "A", "Bm", "C#m", "D", "E"],
    "C#m": ["C#m", "D#dim", "E", "F#m", "G#m", "A", "B"],
    "G#m": ["G#m", "A#dim", "B", "C#m", "D#m", "E", "F#"],
    "Fm": ["Fm", "Gdim", "Ab", "Bbm", "Cm", "Db", "Eb"],
    "Cm": ["Cm", "Ddim", "Eb", "Fm", "Gm", "Ab", "Bb"],
    "Gm": ["Gm", "Adim", "Bb", "Cm", "Dm", "Eb", "F"],
    "D#m": ["D#m", "Fdim", "F#", "G#m", "A#m", "B", "C#"],
    "Bbm": ["Bbm", "Cm", "Db", "Ebm", "Fm", "Gb", "Ab"],
    "Dm": ["Dm", "Edim", "F", "Gm", "Am", "Bb", "C"]
};

// ==================== SISTEMA DESHACER (UNDO) ====================
function guardarHistorial() {
    // Guardar una copia profunda del estado actual de las secciones
    const estado = JSON.stringify(secciones);
    
    // Solo guardar si es diferente al último estado
    if (historialUndo.length === 0 || historialUndo[historialUndo.length - 1] !== estado) {
        historialUndo.push(estado);
        if (historialUndo.length > MAX_UNDO) {
            historialUndo.shift(); // Mantener límite de memoria
        }
    }
}

function deshacer() {
    if (historialUndo.length > 1) {
        // Eliminar el estado actual (que es el último guardado)
        historialUndo.pop();
        // Obtener el estado anterior
        const estadoAnterior = JSON.parse(historialUndo[historialUndo.length - 1]);
        
        secciones = estadoAnterior;
        actualizarVistaPrevia();
        mostrarNotificacion('Cambio revertido', 'info');
    } else if (historialUndo.length === 1) {
        // Caso especial: volver al estado inicial vacío o primer estado
        mostrarNotificacion('No hay más cambios para deshacer', 'warning');
    } else {
        mostrarNotificacion('No hay historial de cambios', 'warning');
    }
}

// Atajos de teclado
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        deshacer();
    }
});

// ==================== AUTO FORMATO DE ACORDES ====================
function formatearTextoAcordes(texto) {
    const acordePattern = '[CDEFGAB][#b]?m?(?:dim|aug|maj7|m7|7|9|11|13|sus2|sus4)?';
    
    // Regla 1: Unir bajos (quitar espacios alrededor de /)
    // Se ha flexibilizado para que una cualquier contenido no vacío separado por /
    const rule1Regex = /([^\s/|]+)\s*\/\s*([^\s/|]+)/gi;
    
    // Regla 2: Separar acordes en un compás con guion
    const rule2Regex = new RegExp(`(^|\\s|\\|\\s*)(${acordePattern}(?:\\/${acordePattern})?)\\s+(${acordePattern}(?:\\/${acordePattern})?)(?=\\s|$|\\|)`, 'gi');

    let lineas = texto.split('\n');
    
    // Regla: Si hay líneas consecutivas que son solo compases, juntarlas
    // Al juntar '| Am |' y '| G |', queremos '| Am | G |', no '| Am | | G |'
    let lineasProcesadas = [];
    for (let i = 0; i < lineas.length; i++) {
        let lineaActual = lineas[i].trim();
        let esSoloCompas = /^\|.*\|$/.test(lineaActual);
        
        if (esSoloCompas && lineasProcesadas.length > 0) {
            let ultimaPos = lineasProcesadas.length - 1;
            let ultimaLinea = lineasProcesadas[ultimaPos].trim();
            let ultimaEsSoloCompas = /^\|.*\|$/.test(ultimaLinea);
            
            if (ultimaEsSoloCompas) {
                // Combinamos eliminando la barra de apertura de la nueva línea si la anterior ya tiene barra de cierre
                // '| Am |' + '| G |' -> '| Am |' + ' G |'
                let contenidoNuevo = lineaActual.substring(1); 
                lineasProcesadas[ultimaPos] = ultimaLinea + contenidoNuevo;
                continue;
            }
        }
        lineasProcesadas.push(lineas[i]);
    }

    let nuevasLineas = lineasProcesadas.map(linea => {
        // Regla: 1 o 2 espacios entre barras -> compás doble (||)
        // Pero primero colapsamos espacios múltiples internos para que la regla de unión de líneas sea limpia
        linea = linea.replace(/\|\s{1,2}\|/g, '||');
        
        // Regla: 3 o más espacios entre barras -> normalizar a exactamente 3 espacios (|   |)
        linea = linea.replace(/\|\s{3,}\|/g, '|   |');

        // Regla: - - -> -- (silencio)
        linea = linea.replace(/-\s+-/g, '--');

        // Normalizar puntos dentro de compases (quitar espacios antes de los puntos)
        // Solo si están dentro de | ... | o || ... ||
        linea = linea.replace(/(\|\|?)(.*?)(\|\|?)/g, (match, p1, p2, p3) => {
            // Quitar espacios antes de puntos en el contenido del compás
            const contenidoProcesado = p2.replace(/(\S)\s+(\.+)/g, '$1$2');
            return p1 + contenidoProcesado + p3;
        });

        // Regla: Unir números solitarios con la barra anterior (ej: "| 2" -> "|2")
        // Solo si el número es un token independiente (separado por espacios)
        linea = linea.replace(/\|\s+(\d+)(?=\s|$)/g, '|$1');

        // Normalizar espacios alrededor de barras de compás y colapsar espacios múltiples
        linea = linea.replace(/\s{2,}/g, ' '); // Colapsar múltiples espacios a uno solo
        linea = linea.replace(/\|\s+/g, '| '); // Máximo un espacio después de |
        linea = linea.replace(/\s+\|/g, ' |'); // Máximo un espacio antes de |
        linea = linea.trim();

        // Aplicamos la unión de bajos
        linea = linea.replace(rule1Regex, '$1/$2');
        
        let antes = "";
        while (linea !== antes) {
            antes = linea;
            linea = linea.replace(rule2Regex, '$1$2 - $3');
        }
        return linea;
    });
    
    return nuevasLineas.join('\n');
}

function unformatearTextoAcordes(texto) {
    const acordePattern = '[CDEFGAB][#b]?m?(?:dim|aug|maj7|m7|7|9|11|13|sus2|sus4)?';
    
    // Invertir Regla 1: D#/Em -> D# / Em
    // También se flexibiliza para la inversión
    const rule1Regex = /([^\s/|]+)\/([^\s/|]+)/gi;
    
    // Invertir Regla 2: A - B -> A B
    const rule2Regex = new RegExp(`(${acordePattern}(?:\\/${acordePattern})?)\\s+-\\s+(${acordePattern}(?:\\/${acordePattern})?)`, 'gi');

    let lineas = texto.split('\n');
    let nuevasLineas = lineas.map(linea => {
        let antes = "";
        while (linea !== antes) {
            antes = linea;
            linea = linea.replace(rule2Regex, '$1 $2');
        }
        linea = linea.replace(rule1Regex, '$1 / $2');
        return linea;
    });
    
    return nuevasLineas.join('\n');
}

function aplicarFormatoGlobal() {
    const autoFormato = document.getElementById('autoFormato');
    if (autoFormato) {
        let hayCambios = false;
        guardarTodasLasSecciones();
        secciones.forEach(seccion => {
            const nuevoTexto = autoFormato.checked 
                ? formatearTextoAcordes(seccion.acordes) 
                : unformatearTextoAcordes(seccion.acordes);
                
            if (nuevoTexto !== seccion.acordes) {
                seccion.acordes = nuevoTexto;
                hayCambios = true;
            }
        });
        if (hayCambios) actualizarVistaPrevia();
    }
}

function formatearLineasConBadges(lineaTexto) {
    if (!lineaTexto || !lineaTexto.trim()) return '&nbsp;';
    let htmlEscapado = escapeHtml(lineaTexto);
    
    // Normalizar símbolos de música visualmente sin usar etiquetas span especiales
    htmlEscapado = htmlEscapado.replace(/#/g, '♯').replace(/b/g, '♭');
    
    // Soporte básico para etiquetas de badge heredadas (solo texto plano ahora)
    htmlEscapado = htmlEscapado.replace(/\[badge-([a-z]+):(.*?)\]/g, '$2');
    htmlEscapado = htmlEscapado.replace(/\[badge:(.*?)\]/g, '$1');
    
    return htmlEscapado;
}

function handleAcordeFocus(e) {
    const linea = e.target;
    // Ya no hay badges que quitar, solo nos aseguramos de que el texto sea editable libremente
    linea.dataset.editing = 'true';
}

function obtenerTextoPlanoLinea(lineaElement) {
    if (!lineaElement) return '';
    // Normalizar símbolos de música a texto plano para guardar
    return lineaElement.textContent.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/\u00A0/g, ' ').trim();
}

// ==================== FUNCIONES PRINCIPALES ====================
function agregarSeccion(tipo) {
    if (tipo === 'Melodía') {
        if (secciones.length === 0) {
            mostrarNotificacion('Primero agrega secciones con acordes para poder sugerirte una melodía', 'warning');
            return;
        }
        abrirModalMelodia();
        return;
    }

    const id = Date.now();
    secciones.push({
        id: id,
        tipo: tipo,
        acordes: '',
        paintData: null,
        tonalidadSugerida: null,
        tiempo: null, // null usa el global
        bpm: null,    // null usa el global
        modoPiano: 'acorde' // 'acorde' o 'nota'
    });

    // Forzar que la nueva sección sea el objetivo del foco
    ultimaSeccionFocoId = id;
    ultimaLineaFocoIndice = 0;
    ultimoOffsetFoco = 0;

    guardarTodasLasSecciones();
    actualizarVistaPrevia();
    mostrarBarraFlotante();
    guardarHistorial();
}

function abrirModalMelodia() {
    const modalElement = document.getElementById('modalMelodia');
    const modal = new bootstrap.Modal(modalElement);
    const listaBases = document.getElementById('listaSeccionesBaseMelodia');
    const sugerenciasContainer = document.getElementById('sugerenciasMelodiaContainer');
    const notasSugeridas = document.getElementById('notasSugeridasMelodia');
    const acordesSugeridos = document.getElementById('acordesSugeridosMelodia');
    const btnConfirmar = document.getElementById('btnConfirmarMelodia');

    let seccionesSeleccionadas = new Set();
    sugerenciasContainer.style.display = 'none';

    listaBases.innerHTML = '';
    secciones.forEach(s => {
        if (s.tipo === 'Melodía') return;
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-dark btn-sm';
        btn.textContent = s.tipo;
        btn.onclick = () => {
            if (seccionesSeleccionadas.has(s.id)) {
                seccionesSeleccionadas.delete(s.id);
                btn.classList.replace('btn-dark', 'btn-outline-dark');
            } else {
                seccionesSeleccionadas.add(s.id);
                btn.classList.replace('btn-outline-dark', 'btn-dark');
            }
            actualizarSugerenciasMelodia();
        };
        listaBases.appendChild(btn);
    });

    const actualizarSugerenciasMelodia = () => {
        if (seccionesSeleccionadas.size === 0) {
            sugerenciasContainer.style.display = 'none';
            return;
        }

        sugerenciasContainer.style.display = 'block';
        notasSugeridas.innerHTML = '';
        acordesSugeridos.innerHTML = '';

        // Recopilar acordes de las secciones seleccionadas
        let todosLosAcordes = "";
        seccionesSeleccionadas.forEach(id => {
            const s = secciones.find(sec => sec.id === id);
            if (s) todosLosAcordes += " " + s.acordes;
        });

        const tono = calcularTonalidad(todosLosAcordes);
        if (tono && escalas[tono]) {
            const escala = escalas[tono];

            // Notas de la escala (simplificado para sugerencia)
            escala.forEach(ac => {
                const nota = ac.match(/^[A-G][#b]?/)[0];
                const badge = document.createElement('span');
                badge.className = 'badge bg-success';
                badge.style.cursor = 'pointer';
                badge.textContent = nota;
                badge.onclick = () => {
                    insertarEnSeccion(` ${nota} `);
                    mostrarNotificacion(`Nota ${nota} añadida a la melodía`, 'info');
                };
                notasSugeridas.appendChild(badge);

                const badgeAc = document.createElement('span');
                badgeAc.className = 'badge bg-primary';
                badgeAc.style.cursor = 'pointer';
                badgeAc.textContent = ac;
                badgeAc.onclick = () => {
                    insertarEnSeccion(` ${ac} `);
                    mostrarNotificacion(`Acorde ${ac} añadido a la melodía`, 'info');
                };
                acordesSugeridos.appendChild(badgeAc);
            });
        }
    };

    btnConfirmar.onclick = () => {
        const id = Date.now();
        let tipoFinal = 'Melodía';
        if (seccionesSeleccionadas.size > 0) {
            const nombres = Array.from(seccionesSeleccionadas)
                .map(sid => secciones.find(s => s.id === sid).tipo);
            tipoFinal += ` (sobre ${nombres.join(', ')})`;
        }

        secciones.push({
            id: id,
            tipo: tipoFinal,
            acordes: '',
            paintData: null,
            tonalidadSugerida: null,
            tiempo: null,
            bpm: null,
            modoPiano: 'nota' // Por defecto para melodía
        });

        ultimaSeccionFocoId = id;
        ultimaLineaFocoIndice = 0;
        ultimoOffsetFoco = 0;

        guardarTodasLasSecciones();
        actualizarVistaPrevia();
        modal.hide();
        mostrarNotificacion('Sección de Melodía creada con éxito', 'success');
        guardarHistorial();
    };

    modal.show();
}
function cambiarModoPianoSeccion(id) {
    const seccion = secciones.find(s => String(s.id) === String(id));
    if (!seccion) return;

    seccion.modoPiano = seccion.modoPiano === 'acorde' ? 'nota' : 'acorde';
    mostrarNotificacion(`Modo de reproducción cambiado a: ${seccion.modoPiano === 'acorde' ? 'Acordes' : 'Notas individuales'}`, 'info');
    actualizarVistaPrevia();
    guardarHistorial();
}

function cambiarTiempoSeccion(id) {
    const seccion = secciones.find(s => String(s.id) === String(id));
    if (!seccion) return;

    const opciones = ["4/4", "3/4", "2/4", "6/8", "12/8", "Global"];
    const actual = seccion.tiempo || "Global";
    let siguienteIdx = (opciones.indexOf(actual) + 1) % opciones.length;
    let siguiente = opciones[siguienteIdx];

    seccion.tiempo = siguiente === "Global" ? null : siguiente;

    mostrarNotificacion(`Compás de la sección actualizado a: ${siguiente}`, 'info');
    actualizarVistaPrevia();
    guardarHistorial();
}

function cambiarBpmSeccion(id) {
    const seccion = secciones.find(s => String(s.id) === String(id));
    if (!seccion) return;

    const opciones = ["Global", 60, 80, 100, 120, 140, 160];
    const actual = seccion.bpm || "Global";
    let siguienteIdx = (opciones.indexOf(actual) + 1) % opciones.length;
    let siguiente = opciones[siguienteIdx];

    seccion.bpm = siguiente === "Global" ? null : siguiente;

    mostrarNotificacion(`BPM de la sección actualizado a: ${siguiente}`, 'info');
    actualizarVistaPrevia();
    guardarHistorial();
}
function eliminarSeccion(id) {
    guardarTodasLasSecciones();
    secciones = secciones.filter(s => String(s.id) !== String(id));
    paintData.delete(String(id));
    actualizarVistaPrevia();
    guardarHistorial(); // Guardar el nuevo estado después de eliminar
}

function actualizarVistaPrevia() {
    const nombre = document.getElementById('nombrePieza').value || 'Sin título';
    const artista = document.getElementById('artista').value || 'Artista desconocido';
    const album = document.getElementById('album').value;
    const genero = document.getElementById('genero').value;
    const tiempo = document.getElementById('tiempo').value;
    const tonalidad = document.getElementById('tonalidad').value;
    const letra = document.getElementById('letra').value;
    const incluirLetra = document.getElementById('incluirLetra').checked;
    
    let html = `<div id="preview-content">
        <h1 style="font-size: 28px; margin-bottom: 8px; font-weight: 700; text-align: center; color: #2c3e50;">${escapeHtml(nombre)}</h1>
        <div style="margin-bottom: 25px; text-align: center;">
            <div style="font-size: 18px; font-weight: 600; color: #34495e;">${escapeHtml(artista)}</div>`;
    
    if (album) html += `<div style="font-size: 16px; color: #555;">Álbum: ${escapeHtml(album)}</div>`;
    if (genero) html += `<div style="font-size: 16px; color: #555;">Género: ${escapeHtml(genero)}</div>`;
    
    let infoExtra = [];
    if (tiempo) infoExtra.push(`Compás: ${tiempo}`);
    if (tonalidad) infoExtra.push(`Tonalidad: ${tonalidad}`);
    
    if (infoExtra.length > 0) {
        html += `<div style="font-size: 16px; color: #555;">${infoExtra.join(' | ')}</div>`;
    }
    html += `</div>`;
    
    if (letra.trim() && incluirLetra) {
        html += `<div style="margin-bottom: 25px;">
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Letra</div>
            <div class="acordes" data-letra="true">
                <div class="acordes-content" contenteditable="true" data-letra="true">${escapeHtml(letra)}</div>
            </div>
        </div>`;
    }
    
    if (secciones.length === 0) {
        html += `<div class="text-center text-muted py-4">No hay secciones agregadas. Usa el botón "Agregar Sección Musical" para comenzar.</div>`;
    } else {
        const contadores = {};
        secciones.forEach((seccion) => {
            const tipo = seccion.tipo;
            contadores[tipo] = (contadores[tipo] || 0) + 1;
            const numeroMostrado = contadores[tipo] > 1 ? ` ${contadores[tipo]}` : '';
            
            html += `<div class="seccion" data-seccion-id="${seccion.id}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                        <div class="seccion-titulo" contenteditable="true" data-titulo="true" data-seccion-id="${seccion.id}">${escapeHtml(tipo)}${numeroMostrado}</div>
                        ${seccion.tonalidadSugerida ? `<span style="background-color: #ffeb3b; border: 1px solid #fbc02d; color: #000; padding: 2px 10px; border-radius: 12px; font-size: 13px; font-weight: bold; margin-left: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); -webkit-print-color-adjust: exact; print-color-adjust: exact;">Tono: ${seccion.tonalidadSugerida}</span>` : ''}
                        <button class="btn-duplicar-instrumento no-print" onclick="duplicarSeccionParaInstrumento(${seccion.id})" title="Agregar otro instrumento para esta sección">=</button>
                        <button class="btn-duplicar-instrumento no-print" onclick="transponerSeccion(${seccion.id}, 1)" title="Subir un semitono">+</button>
                        <button class="btn-duplicar-instrumento no-print" onclick="transponerSeccion(${seccion.id}, -1)" title="Bajar un semitono">-</button>
                        <button class="btn-duplicar-instrumento no-print text-primary" onclick="sugerirTonalidadSeccion(${seccion.id})" title="Detectar tonalidad de esta sección">
                            <i class="bi bi-magic"></i>
                        </button>
                        <button class="btn-duplicar-instrumento no-print text-info" onclick="cambiarTiempoSeccion(${seccion.id})" title="Cambiar compás de esta sección">
                            <span style="font-size: 10px; font-weight: bold;">${seccion.tiempo || 'G'}</span>
                        </button>
                        <button class="btn-duplicar-instrumento no-print text-danger" onclick="cambiarBpmSeccion(${seccion.id})" title="Cambiar velocidad (BPM) de esta sección">
                            <span style="font-size: 10px; font-weight: bold;">${seccion.bpm || 'B'}</span>
                        </button>
                        <button class="btn-duplicar-instrumento no-print text-success" onclick="cambiarModoPianoSeccion(${seccion.id})" title="Alternar entre modo Acorde y modo Nota">
                            <span style="font-size: 10px; font-weight: bold;">${seccion.modoPiano === 'acorde' ? 'A' : 'N'}</span>
                        </button>
                        <button class="btn-duplicar-instrumento no-print text-warning" onclick="tocarSeccionEnPiano(${seccion.id})" title="Tocar esta sección en el piano">
                            <i class="bi bi-play-fill"></i>
                        </button>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="eliminarSeccion(${seccion.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>`;

            if (tipo.toLowerCase() === 'break') {
                html += `
                <div class="seccion-break" data-seccion-id="${seccion.id}">
                    <div class="break-line"></div>
                    <div class="break-label">BREAK</div>
                    <div class="break-line"></div>
                </div>`;
            } else {
                html += `
                <div class="acordes" data-seccion-id="${seccion.id}">
                    <div class="acordes-content" contenteditable="true" data-seccion-id="${seccion.id}">`;
                
                if (seccion.acordes.trim()) {
                    const lineas = seccion.acordes.split('\n');
                    lineas.forEach(linea => {
                        const lTrim = linea.trim() || ' ';
                        html += `<div class="acorde-linea">${formatearLineasConBadges(lTrim)}</div>`;
                    });
                } else {
                    html += `<div class="acorde-linea">&nbsp;</div>`;
                }
                
                html += `</div>
                </div>`;
            }
            
            html += `</div>`;
        });
    }
    
    html += `</div>`;
    document.getElementById('contenidoVistaPrevia').innerHTML = html;
    agregarEventListenersEditables();
    
    // Restaurar dibujos guardados
    document.querySelectorAll('.acordes').forEach(element => {
        const seccionId = String(element.dataset.seccionId);
        // Si hay datos de dibujo o el modo está activo, inicializar canvas
        if (paintData.has(seccionId) || paintMode) {
            inicializarPaintCanvas(element);
        }
    });

    restaurarFoco();
    guardarEnLocalStorage();
}

// ==================== INSERCIÓN DE TEXTO ====================
function insertarEnSeccion(texto, omitirModal = false) {
    if (secciones.length === 0) {
        mostrarNotificacion('Primero agrega una sección musical', 'warning');
        return;
    }

    let textoAInsertar = texto;
    const esRepeticion = texto.trim().match(/^x\d+$/) || texto.trim() === 'x2';

    // 1. Intentar obtener la posición actual (ya sea foco real o memoria)
    let selection = window.getSelection();
    let range = null;
    let acordeLinea = null;

    // Verificar si hay una selección activa dentro de una línea de acordes
    if (selection.rangeCount > 0) {
        const tempRange = selection.getRangeAt(0);
        const container = tempRange.startContainer.nodeType === Node.TEXT_NODE ?
                         tempRange.startContainer.parentElement : tempRange.startContainer;
        acordeLinea = container.closest('.acorde-linea');
        if (acordeLinea) {
            range = tempRange;
        }
    }

    // 2. Si no hay selección activa en una línea, usar la memoria
    if (!acordeLinea && ultimaSeccionFocoId !== null) {
        const seccionDiv = document.querySelector(`.seccion[data-seccion-id="${ultimaSeccionFocoId}"]`);
        if (seccionDiv) {
            const lineas = seccionDiv.querySelectorAll('.acorde-linea');
            acordeLinea = lineas[ultimaLineaFocoIndice] || lineas[lineas.length - 1];

            if (acordeLinea) {
                acordeLinea.focus();
                range = document.createRange();
                let totalOffset = 0;
                const walk = document.createTreeWalker(acordeLinea, NodeFilter.SHOW_TEXT, null, false);
                let n;
                let found = false;
                while (n = walk.nextNode()) {
                    const len = n.textContent.length;
                    if (totalOffset + len >= ultimoOffsetFoco) {
                        range.setStart(n, ultimoOffsetFoco - totalOffset);
                        found = true;
                        break;
                    }
                    totalOffset += len;
                }
                if (!found) {
                    range.selectNodeContents(acordeLinea);
                    range.collapse(false);
                }
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    // 3. Fallback final: última línea de la última sección
    if (!acordeLinea) {
        const todasLasLineas = document.querySelectorAll('.acorde-linea');
        if (todasLasLineas.length > 0) {
            acordeLinea = todasLasLineas[todasLasLineas.length - 1];
            acordeLinea.focus();
            range = document.createRange();
            range.selectNodeContents(acordeLinea);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            return;
        }
    }

    // Asegurar que la línea no tenga badges activos mientras insertamos
    if (acordeLinea.hasAttribute('data-raw')) {
        acordeLinea.textContent = acordeLinea.getAttribute('data-raw');
        acordeLinea.removeAttribute('data-raw');
        // Re-obtener range tras limpiar HTML
        range = document.createRange();
        range.selectNodeContents(acordeLinea);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Lógica especial para el símbolo de transición "→"
    if (texto.trim() === '→' && !omitirModal) {
        abrirModalTransicion((nuevoTexto) => {
            insertarEnSeccion(nuevoTexto, true);
        });
        return;
    }
        
    if (esRepeticion) {
        let container = range.startContainer;
        let offset = range.startOffset;
        let textNode = null;
        
        if (container.nodeType === Node.TEXT_NODE) {
            textNode = container;
        } else if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
            const prevNode = container.childNodes[offset - 1];
            if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
                textNode = prevNode;
                offset = textNode.length;
            }
        }
        
        if (textNode) {
            const textBefore = textNode.textContent.substring(0, offset);
            const match = textBefore.match(/ x(\d+)$/);
            
            if (match) {
                const numAnterior = parseInt(match[1]);
                const nuevoNum = numAnterior + 1;
                textoAInsertar = ` x${nuevoNum}`;
                
                const startPos = match.index;
                const beforeMatch = textNode.textContent.substring(0, startPos);
                const afterCursor = textNode.textContent.substring(offset);
                
                textNode.textContent = beforeMatch + textoAInsertar + afterCursor;
                
                const newRange = document.createRange();
                newRange.setStart(textNode, beforeMatch.length + textoAInsertar.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                const seccionDiv = acordeLinea.closest('.seccion');
                if (seccionDiv) {
                    const seccionId = seccionDiv.dataset.seccionId;
                    const seccion = secciones.find(s => String(s.id) === String(seccionId));
                    if (seccion) {
                        const lineas = Array.from(seccionDiv.querySelectorAll('.acorde-linea')).map(l => obtenerTextoPlanoLinea(l));
                        seccion.acordes = lineas.join('\n');
                        guardarPosicionFoco();
                        actualizarVistaPrevia();
                        restaurarFoco();
                        guardarEnLocalStorage();
                        guardarHistorial();
                    }
                }
                return;
            }
        }
        textoAInsertar = " x2";
    }

    const seccionDiv = acordeLinea.closest('.seccion');
    if (seccionDiv) {
        const seccionId = seccionDiv.dataset.seccionId;
        const seccion = secciones.find(s => String(s.id) === String(seccionId));

        if (seccion) {
            // Insertar el texto en el DOM directamente
            range.deleteContents();
            const textNode = document.createTextNode(textoAInsertar);
            range.insertNode(textNode);
            
            // Mover el cursor al final de lo insertado
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);

            // Sincronizar el contenido de toda la sección al array de secciones desde el DOM
            const contentDiv = seccionDiv.querySelector('.acordes-content');
            if (contentDiv) {
                const lineas = Array.from(contentDiv.querySelectorAll('.acorde-linea')).map(l => obtenerTextoPlanoLinea(l));
                seccion.acordes = lineas.join('\n');
            }
            
            // NO llamar a actualizarVistaPrevia() para no destruir lo que el usuario ve
            guardarPosicionFoco();
            guardarEnLocalStorage();
            guardarHistorial();
        }
    }
}
window.insertarEnSeccion = insertarEnSeccion;

// Alias para compatibilidad con botones de creandoPieza.html
function insertarSimbolo(texto) {
    insertarEnSeccion(texto);
}

function insertarAcorde(texto) {
    insertarEnSeccion(texto);
}

// ==================== SISTEMA DE DIBUJO ====================
function togglePaintMode() {
    paintMode = !paintMode;
    const paintControls = document.getElementById('paintControlsBarra');
    
    if (paintMode) {
        paintControls.style.display = 'block';
        document.querySelectorAll('.acordes').forEach(el => {
            el.classList.add('drawing-mode');
            inicializarPaintCanvas(el);
        });
        mostrarNotificacion('Modo dibujo ACTIVADO - Dibuja sobre los acordes', 'success');
    } else {
        paintControls.style.display = 'none';
        document.querySelectorAll('.acordes').forEach(el => {
            el.classList.remove('drawing-mode');
            // NO guardamos/limpiamos aquí, simplemente quitamos la clase de interacción
        });
        mostrarNotificacion('Modo dibujo DESACTIVADO', 'info');
    }
}

function inicializarPaintCanvas(acordesElement) {
    let canvas = acordesElement.querySelector('.acordes-paint-canvas');
    let overlay = acordesElement.querySelector('.acordes-paint-overlay');
    let content = acordesElement.querySelector('.acordes-content');
    
    if (!content) {
        content = document.createElement('div');
        content.className = 'acordes-content';
        content.setAttribute('contenteditable', 'true');
        content.setAttribute('data-seccion-id', acordesElement.dataset.seccionId);
        content.innerHTML = acordesElement.innerHTML;
        acordesElement.innerHTML = '';
        acordesElement.appendChild(content);
    }
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'acordes-paint-overlay';
        acordesElement.appendChild(overlay);
    }
    
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'acordes-paint-canvas';
        overlay.appendChild(canvas);
        
        const resizeCanvas = () => {
            const rect = content.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            
            const seccionId = String(acordesElement.dataset.seccionId);
            if (seccionId && paintData.has(seccionId)) {
                const img = new Image();
                img.onload = () => {
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                };
                img.src = paintData.get(seccionId);
            }
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let lastX = 0, lastY = 0;
        
        const updateDrawingStyle = () => {
            ctx.strokeStyle = currentPaintColor;
            ctx.lineWidth = currentBrushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };
        
        const getCoordinates = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            let clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            
            return {
                x: Math.max(0, Math.min(canvas.width, (clientX - rect.left) * scaleX)),
                y: Math.max(0, Math.min(canvas.height, (clientY - rect.top) * scaleY))
            };
        };
        
        const startDrawing = (e) => {
            if (!paintMode) return;
            e.preventDefault();
            isDrawing = true;
            updateDrawingStyle();
            const pos = getCoordinates(e);
            lastX = pos.x;
            lastY = pos.y;
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(lastX, lastY);
            ctx.stroke();
        };
        
        const draw = (e) => {
            if (!isDrawing || !paintMode) return;
            e.preventDefault();
            updateDrawingStyle();
            const pos = getCoordinates(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            lastX = pos.x;
            lastY = pos.y;
        };
        
        const stopDrawing = () => {
            if (isDrawing) {
                isDrawing = false;
                ctx.beginPath();
                guardarPaintData(acordesElement);
            }
        };
        
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);
    }
}

function guardarPaintData(acordesElement) {
    const canvas = acordesElement.querySelector('.acordes-paint-canvas');
    if (canvas) {
        const seccionId = String(acordesElement.dataset.seccionId);
        if (seccionId) {
            const dataURL = canvas.toDataURL();
            paintData.set(seccionId, dataURL);
            const seccion = secciones.find(s => String(s.id) === String(seccionId));
            if (seccion) seccion.paintData = dataURL;
            guardarEnLocalStorage();
            guardarHistorial();
        }
    }
}

function limpiarPaint(seccionId) {
    const acordesElement = document.querySelector(`.acordes[data-seccion-id="${seccionId}"]`);
    if (acordesElement) {
        const canvas = acordesElement.querySelector('.acordes-paint-canvas');
        if (canvas) {
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            // IMPORTANTE: Limpiar los datos guardados para que no se restauren
            paintData.delete(seccionId);
            const seccion = secciones.find(s => String(s.id) === String(seccionId));
            if (seccion) seccion.paintData = null;
            
            mostrarNotificacion('Dibujo eliminado de esta sección', 'info');
            guardarTodasLasSecciones();
            actualizarVistaPrevia();
            guardarHistorial();
        }
    }
}

function limpiarPaintActual() {
    let seccionActiva = null;
    const activeElement = document.activeElement;
    const acordesElement = activeElement?.closest?.('.acordes');
    
    if (acordesElement) {
        const seccionId = String(acordesElement.dataset.seccionId);
        seccionActiva = secciones.find(s => String(s.id) === String(seccionId));
    }
    
    if (!seccionActiva && secciones.length > 0) {
        seccionActiva = secciones[secciones.length - 1];
    }
    
    if (seccionActiva) limpiarPaint(seccionActiva.id);
}

function cambiarColorPaint(color) {
    currentPaintColor = color;
}

function cambiarTamanioPincel(tamanio) {
    currentBrushSize = parseInt(tamanio);
}

// ==================== SUGERENCIA DE TONALIDAD ====================
function calcularTonalidad(acordesTexto) {
    const acordesEncontrados = [];
    const palabras = acordesTexto.split(/[\s|()[\]{},\-]/);
    
    for (const palabra of palabras) {
        if (!palabra) continue;
        const m = palabra.match(/^([CDEFGAB][#b]?m?)(dim|aug|maj7|m7|7|9|11|13|sus2|sus4)?$/i);
        if (m) {
            let acordeBase = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
            acordesEncontrados.push(acordeBase);
        }
    }

    if (acordesEncontrados.length === 0) {
        return null;
    }

    const primerAcorde = acordesEncontrados[0];
    let puntuaciones = {};
    
    for (const [tono, acordesEscala] of Object.entries(escalas)) {
        puntuaciones[tono] = 0;
        for (const acorde of acordesEncontrados) {
            if (acordesEscala.includes(acorde)) {
                puntuaciones[tono] += 1;
            }
        }
        if (tono === primerAcorde) {
            puntuaciones[tono] += 3;
        }
    }
    
    let mejorTono = null;
    let maxPuntuacion = -1;
    for (const [tono, puntos] of Object.entries(puntuaciones)) {
        if (puntos > maxPuntuacion) {
            maxPuntuacion = puntos;
            mejorTono = tono;
        }
    }
    
    return mejorTono;
}

function sugerirTonalidad() {
    const acordesTexto = Array.from(document.querySelectorAll('.acorde-linea'))
        .map(linea => obtenerTextoPlanoLinea(linea)).join(' ');
        
    const tonalidadGanadora = calcularTonalidad(acordesTexto);
    
    if (!tonalidadGanadora) {
        mostrarNotificacion('Escribe algunos acordes válidos primero para detectar la tonalidad', 'warning');
        return;
    }
    
    const selectTonalidad = document.getElementById('tonalidad');
    let optionExiste = Array.from(selectTonalidad.options).some(opt => opt.value === tonalidadGanadora);
    
    if (optionExiste) {
        selectTonalidad.value = tonalidadGanadora;
    } else {
        const newOption = new Option(tonalidadGanadora, tonalidadGanadora);
        selectTonalidad.add(newOption);
        selectTonalidad.value = tonalidadGanadora;
    }
    mostrarNotificacion(`Tonalidad global sugerida: ${tonalidadGanadora}`, 'success');
}

function sugerirTonalidadSeccion(seccionId) {
    const seccion = secciones.find(s => String(s.id) === String(seccionId));
    if (!seccion || !seccion.acordes) {
        mostrarNotificacion('Esta sección no tiene acordes', 'warning');
        return;
    }
    
    if (seccion.tonalidadSugerida) {
        seccion.tonalidadSugerida = null;
        actualizarVistaPrevia();
        guardarHistorial();
        return;
    }
    
    const tonalidadGanadora = calcularTonalidad(seccion.acordes);
    if (!tonalidadGanadora) {
        mostrarNotificacion('No se detectaron acordes en esta sección', 'warning');
        return;
    }
    
    seccion.tonalidadSugerida = tonalidadGanadora;
    actualizarVistaPrevia();
    guardarHistorial();
}

function buscarLetraEnLinea() {
    const nombre = document.getElementById('nombrePieza').value;
    const artista = document.getElementById('artista').value;
    
    if (!nombre) {
        mostrarNotificacion('Por favor, ingresa al menos el nombre de la pieza', 'warning');
        return;
    }
    
    const query = `${nombre} ${artista}`.trim();
    // Usamos Letras.com que es más directo para música
    const url = `https://www.letras.com/?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
}

// ==================== DUPLICACIÓN DE SECCIÓN ====================
function duplicarSeccionParaInstrumento(seccionId) {
    if (confirm('¿Deseas agregar otro instrumento para esta sección?')) {
        const seccionOriginal = secciones.find(s => String(s.id) === String(seccionId));
        if (seccionOriginal) {
            agregarSeccion(`=${seccionOriginal.tipo}`);
        }
    }
}

// ==================== TRANSPOSICIÓN ====================
function transponerSeccion(seccionId, pasos) {
    // Primero guardamos lo que el usuario haya escrito en la interfaz
    guardarTodasLasSecciones();

    const seccion = secciones.find(s => String(s.id) === String(seccionId));
    if (!seccion) return;
    
    if (!seccion.acordes.trim()) return;

    function esAcordeValido(palabra) {
        // Expresión regular robusta para detectar acordes sin depender del diccionario de escalas
        const regexAcorde = /^([CDEFGAB][#b]?)(m|dim|aug)?(maj7|m7|7|9|11|13|sus2|sus4)?$/;
        
        if (regexAcorde.test(palabra)) return true;
        
        if (palabra.includes('/')) {
            const partes = palabra.split('/');
            if (partes.length === 2 && regexAcorde.test(partes[0]) && /^([CDEFGAB][#b]?)$/.test(partes[1])) {
                return true;
            }
        }
        
        return false;
    }

    const lineas = seccion.acordes.split('\n');
    const nuevasLineas = lineas.map(linea => {
        let nuevaLinea = "";
        let palabraActual = "";
        
        for (let i = 0; i < linea.length; i++) {
            const char = linea[i];
            if (char.match(/[\s|()[\]{},\-]/)) {
                if (palabraActual.length > 0) {
                    if (esAcordeValido(palabraActual)) {
                        nuevaLinea += transponerAcorde(palabraActual, pasos);
                    } else {
                        nuevaLinea += palabraActual;
                    }
                    palabraActual = "";
                }
                nuevaLinea += char;
            } else {
                palabraActual += char;
            }
        }
        
        if (palabraActual.length > 0) {
            if (esAcordeValido(palabraActual)) {
                nuevaLinea += transponerAcorde(palabraActual, pasos);
            } else {
                nuevaLinea += palabraActual;
            }
        }
        
        return nuevaLinea;
    });
    
    seccion.acordes = nuevasLineas.join('\n');
    actualizarVistaPrevia();
    guardarHistorial();
}

function transponerAcorde(acorde, pasos) {
    const notasSostenidos = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const notasBemoles = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    
    const equivalencias = {
        "Cb": "B",
        "Fb": "E",
        "E#": "F",
        "B#": "C"
    };
    
    function transponerNota(notaStr) {
        const regexNota = /^([CDEFGAB][#b]?)(.*)$/;
        const match = notaStr.match(regexNota);
        
        if (!match) return notaStr;
        
        let notaBase = match[1];
        let resto = match[2] || "";
        
        if (equivalencias[notaBase]) {
            notaBase = equivalencias[notaBase];
        }
        
        let indice = notasSostenidos.indexOf(notaBase);
        let usaSostenidos = true;
        
        if (indice === -1) {
            indice = notasBemoles.indexOf(notaBase);
            usaSostenidos = false;
        }
        
        if (indice === -1) return notaStr;
        
        let nuevoIndice = (indice + pasos) % 12;
        if (nuevoIndice < 0) nuevoIndice += 12;
        
        let nuevaNota = usaSostenidos ? notasSostenidos[nuevoIndice] : notasBemoles[nuevoIndice];
        return nuevaNota + resto;
    }

    if (acorde.includes('/')) {
        const partes = acorde.split('/');
        return transponerNota(partes[0]) + '/' + transponerNota(partes[1]);
    } else {
        return transponerNota(acorde);
    }
}

// ==================== EVENTOS EDITABLES ====================
function agregarEventListenersEditables() {
    // Manejar líneas de acordes
    document.querySelectorAll('.acorde-linea').forEach(linea => {
        linea.removeEventListener('input', handleAcordeInput);
        linea.addEventListener('input', handleAcordeInput);
        
        // Guardar posición al hacer clic o escribir
        linea.removeEventListener('click', guardarPosicionFoco);
        linea.addEventListener('click', guardarPosicionFoco);
        
        linea.removeEventListener('keyup', guardarPosicionFoco);
        linea.addEventListener('keyup', guardarPosicionFoco);
        
        // Agregar blur para formatear
        linea.removeEventListener('blur', handleAcordeBlur);
        linea.addEventListener('blur', handleAcordeBlur);

        // Agregar focus para desformatear (volver a texto plano)
        linea.removeEventListener('focus', handleAcordeFocus);
        linea.addEventListener('focus', handleAcordeFocus);
    });
    
    // Manejar títulos de sección
    document.querySelectorAll('.seccion-titulo[data-titulo="true"]').forEach(titulo => {
        titulo.removeEventListener('input', handleTituloInput);
        titulo.addEventListener('input', handleTituloInput);
    });
    
    // Manejar letra
    const letraDiv = document.querySelector('.acordes-content[data-letra="true"]');
    if (letraDiv) {
        letraDiv.removeEventListener('input', handleLetraInput);
        letraDiv.addEventListener('input', handleLetraInput);
    }
}

// Guardar el contenido actual de todas las secciones antes de reconstruir
function guardarTodasLasSecciones() {
    document.querySelectorAll('.seccion').forEach(seccionDiv => {
        const seccionId = seccionDiv.dataset.seccionId;
        const seccion = secciones.find(s => String(s.id) === String(seccionId));

        if (seccion) {            const contentDiv = seccionDiv.querySelector('.acordes-content');
            if (contentDiv) {
                const lineas = Array.from(contentDiv.querySelectorAll('.acorde-linea')).map(l => obtenerTextoPlanoLinea(l));
                seccion.acordes = lineas.join('\n');
            }
            
            const tituloDiv = seccionDiv.querySelector('.seccion-titulo[data-titulo="true"]');
            if (tituloDiv) {
                const texto = tituloDiv.textContent.trim();
                const partes = texto.split(' ');
                const numero = partes[partes.length - 1];
                seccion.tipo = isNaN(numero) ? texto : partes.slice(0, -1).join(' ');
            }
        }
    });
}

function handleAcordeInput(e) {
    const target = e.target;
    const contentDiv = target.closest('.acordes-content');
    const seccionDiv = target.closest('.seccion');
    const linea = target.closest('.acorde-linea');
    
    // Si el usuario está editando manualmente, el data-raw queda invalidado
    if (linea && linea.hasAttribute('data-raw')) {
        linea.removeAttribute('data-raw');
    }

    if (contentDiv && seccionDiv) {
        // Detectar si se acaba de escribir → (o si se pegó)
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textNode = range.startContainer;
            if (textNode.nodeType === Node.TEXT_NODE) {
                const offset = range.startOffset;
                const lastChar = textNode.textContent.substring(offset - 1, offset);
                
                if (lastChar === '→') {
                    // Quitar el símbolo recién escrito para manejarlo vía modal
                    const before = textNode.textContent.substring(0, offset - 1);
                    const after = textNode.textContent.substring(offset);
                    textNode.textContent = before + after;
                    
                    // Reposicionar cursor donde estaba el símbolo
                    range.setStart(textNode, offset - 1);
                    range.collapse(true);
                    
                    abrirModalTransicion((nuevoTexto) => {
                        insertarEnSeccion(nuevoTexto, true);
                    });
                }
            }
        }

        const seccionId = seccionDiv.dataset.seccionId;
        const seccion = secciones.find(s => String(s.id) === String(seccionId));
        if (seccion) {
            const lineas = Array.from(contentDiv.querySelectorAll('.acorde-linea')).map(l => obtenerTextoPlanoLinea(l));
            seccion.acordes = lineas.join('\n');
            guardarEnLocalStorage(); // Asegurar persistencia en cada cambio
        }
    }
}

function handleTituloInput(e) {
    const titulo = e.target;
    const seccionDiv = titulo.closest('.seccion');
    if (seccionDiv) {
        const seccionId = seccionDiv.dataset.seccionId;
        const seccion = secciones.find(s => String(s.id) === String(seccionId));
        if (seccion) {
            const texto = titulo.textContent.trim();
            const partes = texto.split(' ');
            const numero = partes[partes.length - 1];
            seccion.tipo = isNaN(numero) ? texto : partes.slice(0, -1).join(' ');
        }
    }
    guardarHistorial();
}

function handleAcordeBlur(e) {
    const linea = e.target;
    const contentDiv = linea.closest('.acordes-content');
    const seccionDiv = linea.closest('.seccion');

    if (contentDiv && seccionDiv) {
        linea.removeAttribute('data-editing');
        const seccionId = seccionDiv.dataset.seccionId;
        const seccion = secciones.find(s => String(s.id) === String(seccionId));
        if (seccion) {
            // Sincronizar estado actual
            const lineas = Array.from(contentDiv.querySelectorAll('.acorde-linea')).map(l => obtenerTextoPlanoLinea(l));
            seccion.acordes = lineas.join('\n');
            
            const btnFormato = document.getElementById('autoFormato');
            if (btnFormato && btnFormato.checked) {
                seccion.acordes = formatearTextoAcordes(seccion.acordes);
            }
            
            guardarHistorial();
            guardarEnLocalStorage();
        }
    }
}

function handleLetraInput(e) {
    document.getElementById('letra').value = e.target.textContent;
}

function guardarPosicionFoco() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        let node = range.startContainer;
        
        let linea = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (!linea.classList.contains('acorde-linea')) {
            linea = linea.closest('.acorde-linea');
        }
        
        if (linea) {
            const seccionDiv = linea.closest('.seccion');
            if (seccionDiv) {
                ultimaSeccionFocoId = String(seccionDiv.dataset.seccionId);
                const lineas = Array.from(seccionDiv.querySelectorAll('.acorde-linea'));
                ultimaLineaFocoIndice = lineas.indexOf(linea);
                
                // Calcular offset total respecto al texto de la línea
                let offset = 0;
                const walk = document.createTreeWalker(linea, NodeFilter.SHOW_TEXT, null, false);
                let n;
                while ((n = walk.nextNode()) && n !== node) {
                    offset += n.textContent.length;
                }
                offset += range.startOffset;
                ultimoOffsetFoco = offset;
            }
        }
    }
}

function restaurarFoco() {
    if (ultimaSeccionFocoId === null) return;
    
    const seccionDiv = document.querySelector(`.seccion[data-seccion-id="${ultimaSeccionFocoId}"]`);
    if (seccionDiv) {
        const lineas = seccionDiv.querySelectorAll('.acorde-linea');
        const linea = lineas[ultimaLineaFocoIndice] || lineas[lineas.length - 1];
        
        if (linea) {
            linea.focus();
            const selection = window.getSelection();
            const range = document.createRange();
            
            // Encontrar el nodo de texto y offset correspondiente al offset global
            let totalOffset = 0;
            let targetNode = linea;
            let targetOffset = 0;
            let found = false;

            const walk = document.createTreeWalker(linea, NodeFilter.SHOW_TEXT, null, false);
            let n;
            while (n = walk.nextNode()) {
                const len = n.textContent.length;
                if (totalOffset + len >= ultimoOffsetFoco) {
                    targetNode = n;
                    targetOffset = ultimoOffsetFoco - totalOffset;
                    found = true;
                    break;
                }
                totalOffset += len;
            }

            if (found) {
                range.setStart(targetNode, targetOffset);
            } else {
                // Si no se encontró (ej: al final), poner al final del último nodo de texto o del contenedor
                range.selectNodeContents(linea);
                range.collapse(false);
            }
            
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

// ==================== EXPORTACIONES ====================
function validarContenidoExportacion() {
    const hayTextoFormulario = [
        'nombrePieza', 'artista', 'album', 'genero', 'letra'
    ].some(id => document.getElementById(id)?.value.trim() !== '');

    const hayConfiguracion = [
        'tiempo', 'tonalidad'
    ].some(id => document.getElementById(id)?.value !== '');

    const haySeccionesConContenido = secciones.some(s => s.acordes.trim() !== '');
    
    const hayDibujos = typeof paintData !== 'undefined' && paintData.size > 0;

    if (!hayTextoFormulario && !hayConfiguracion && !haySeccionesConContenido && !hayDibujos) {
        mostrarNotificacion('No se puede exportar: la partitura está vacía.', 'warning');
        return false;
    }
    return true;
}

function exportarMarkdown() {
    if (!validarContenidoExportacion()) return;
    
    const nombre = document.getElementById('nombrePieza').value || 'Sin_titulo';
    const incluirLetra = document.getElementById('incluirLetra').checked;
    
    let contenido = `# ${nombre.replace(/_/g, ' ')}\n\n`;
    contenido += `**Artista:** ${document.getElementById('artista').value || 'Desconocido'}\n`;
    
    const album = document.getElementById('album').value;
    if (album) contenido += `**Álbum:** ${album}\n`;
    
    const genero = document.getElementById('genero').value;
    if (genero) contenido += `**Género:** ${genero}\n`;
    
    const tiempo = document.getElementById('tiempo').value;
    if (tiempo) contenido += `**Compás:** ${tiempo}\n`;
    
    contenido += `**Tonalidad:** ${document.getElementById('tonalidad').value}\n\n---\n\n`;
    
    const letra = document.getElementById('letra').value;
    if (letra.trim() && incluirLetra) contenido += `### Letra\n\n${letra}\n\n`;
    
    secciones.forEach((seccion, index) => {
        contenido += `### ${seccion.tipo} ${index + 1}\n`;
        
        // Agregar metadatos de sección si existen
        let meta = [];
        if (seccion.tiempo) meta.push(`**Compás:** ${seccion.tiempo}`);
        if (seccion.bpm) meta.push(`**BPM:** ${seccion.bpm}`);
        if (seccion.tonalidadSugerida) meta.push(`**Tonalidad:** ${seccion.tonalidadSugerida}`);
        if (seccion.modoPiano) meta.push(`**Reproducción:** ${seccion.modoPiano}`);

        if (meta.length > 0) {
            contenido += meta.join(' | ') + '\n';
        }
        contenido += '\n';

        if (seccion.acordes.trim()) {
            contenido += "```text\n" + seccion.acordes.trim() + "\n```\n\n";
        }
    });
    
    descargarArchivo(contenido, `${nombre.replace(/[^a-z0-9]/gi, '_')}.md`, 'text/markdown');
    mostrarNotificacion('Archivo Markdown exportado correctamente', 'success');
}

async function exportarImagen() {
    if (!validarContenidoExportacion()) return;
    await exportarComoImagen('image/png', '.png');
}

async function exportarPDF() {
    if (!validarContenidoExportacion()) return;
    const element = document.getElementById('vistaPrevia');
    const exportarCompleta = document.getElementById('exportarCompleta').checked;
    
    await withExportMode(element, exportarCompleta, async () => {
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const finalImgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = finalImgHeight;
        let position = 0;
        
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, finalImgHeight);
        heightLeft -= pdfHeight;
        
        while (heightLeft >= 0) {
            position -= pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, finalImgHeight);
            heightLeft -= pdfHeight;
        }
        
        pdf.save(`partitura_${Date.now()}.pdf`);
        mostrarNotificacion('PDF exportado correctamente', 'success');
    });
}

async function exportarComoImagen(type, extension) {
    const element = document.getElementById('vistaPrevia');
    const exportarCompleta = document.getElementById('exportarCompleta').checked;
    
    await withExportMode(element, exportarCompleta, async () => {
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = `partitura_${Date.now()}${extension}`;
        link.href = canvas.toDataURL(type);
        link.click();
        mostrarNotificacion('Imagen exportada correctamente', 'success');
    });
}

async function withExportMode(element, exportarCompleta, callback) {
    const originalHeight = element.style.height;
    const originalOverflow = element.style.overflow;
    const originalMaxHeight = element.style.maxHeight;
    
    document.body.classList.add('export-mode');
    
    if (exportarCompleta) {
        element.style.overflow = 'visible';
        element.style.height = element.scrollHeight + 'px';
        element.style.maxHeight = 'none';
        window.scrollTo(0, 0);
    }
    
    try {
        await callback();
    } catch (error) {
        console.error('Error en exportación:', error);
        mostrarNotificacion('Error al exportar', 'error');
    } finally {
        if (exportarCompleta) {
            element.style.overflow = originalOverflow;
            element.style.height = originalHeight;
            element.style.maxHeight = originalMaxHeight;
        }
        document.body.classList.remove('export-mode');
    }
}

// ==================== IMPORTACIÓN ====================
document.getElementById('importarMarkdown').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const contenido = e.target.result;
        const lines = contenido.split('\n');
        
        let nombre = '', artista = '', album = '', genero = '', tiempo = '', tonalidad = '', letra = '';
        let seccionesImportadas = [];
        let lineaActual = '', tipoSeccion = '';
        let enLetra = false, enSeccion = false;
        let seccionMetaActual = { tiempo: null, bpm: null, tonalidad: null, modoPiano: 'acorde' };
        
        for (const line of lines) {
            if (line.startsWith('# ') && !nombre) {
                nombre = line.replace('# ', '').trim();
            } else if (line.startsWith('**Artista:**')) {
                artista = line.replace('**Artista:**', '').trim();
            } else if (line.startsWith('**Álbum:**')) {
                album = line.replace('**Álbum:**', '').trim();
            } else if (line.startsWith('**Género:**')) {
                genero = line.replace('**Género:**', '').trim();
            } else if (line.startsWith('**Compás:**')) {
                tiempo = line.replace('**Compás:**', '').trim();
            } else if (line.startsWith('**Tonalidad:**')) {
                tonalidad = line.replace('**Tonalidad:**', '').trim();
            } else if (line.startsWith('### Letra')) {
                enLetra = true;
                enSeccion = false;
            } else if (line.startsWith('### ') && !enLetra) {
                if (lineaActual.trim() && tipoSeccion) {
                    const newId = Date.now() + seccionesImportadas.length + Math.floor(Math.random() * 1000);
                    seccionesImportadas.push({
                        id: newId,
                        tipo: tipoSeccion,
                        acordes: lineaActual.trim(),
                        paintData: null,
                        tiempo: seccionMetaActual.tiempo,
                        bpm: seccionMetaActual.bpm,
                        tonalidadSugerida: seccionMetaActual.tonalidad,
                        modoPiano: seccionMetaActual.modoPiano || 'acorde'
                    });
                }
                tipoSeccion = line.replace('### ', '').trim().replace(/\s+\d+$/, '');
                lineaActual = '';
                seccionMetaActual = { tiempo: null, bpm: null, tonalidad: null, modoPiano: 'acorde' };
                enSeccion = true;
                enLetra = false;
            } else if (enSeccion && (line.includes('**Compás:**') || line.includes('**BPM:**') || line.includes('**Tonalidad:**') || line.includes('**Reproducción:**'))) {
                // Leer metadatos de la sección
                const matchCompas = line.match(/\*\*Compás:\*\*\s*([^\s|]+)/);
                const matchBpm = line.match(/\*\*BPM:\*\*\s*(\d+)/);
                const matchTon = line.match(/\*\*Tonalidad:\*\*\s*([^\s|]+)/);
                const matchModo = line.match(/\*\*Reproducción:\*\*\s*([^\s|]+)/);
                
                if (matchCompas) seccionMetaActual.tiempo = matchCompas[1];
                if (matchBpm) seccionMetaActual.bpm = parseInt(matchBpm[1]);
                if (matchTon) seccionMetaActual.tonalidad = matchTon[1];
                if (matchModo) seccionMetaActual.modoPiano = matchModo[1];
            } else if (line.startsWith('```text')) {
                lineaActual = '';
            } else if (line.startsWith('```') && line.trim() !== '```text') {
                enSeccion = false;
            } else if (enSeccion && line.trim() && !line.startsWith('```')) {
                lineaActual += (lineaActual ? '\n' : '') + line;
            } else if (enLetra && line.trim() && !line.startsWith('#') && !line.startsWith('**')) {
                letra += (letra ? '\n' : '') + line;
            }
        }
        
        if (lineaActual.trim() && tipoSeccion) {
            const finalId = Date.now() + seccionesImportadas.length + Math.floor(Math.random() * 1000);
            seccionesImportadas.push({
                id: finalId,
                tipo: tipoSeccion,
                acordes: lineaActual.trim(),
                paintData: null,
                tiempo: seccionMetaActual.tiempo,
                bpm: seccionMetaActual.bpm,
                tonalidadSugerida: seccionMetaActual.tonalidad,
                modoPiano: seccionMetaActual.modoPiano || 'acorde'
            });
        }
        
        // Aplicar datos importados
        if (nombre) document.getElementById('nombrePieza').value = nombre;
        if (artista) document.getElementById('artista').value = artista;
        if (album) document.getElementById('album').value = album;
        if (genero) document.getElementById('genero').value = genero;
        if (letra) document.getElementById('letra').value = letra;
        
        if (tiempo) {
            const selectTiempo = document.getElementById('tiempo');
            const option = Array.from(selectTiempo.options).find(opt => opt.value === tiempo);
            if (option) selectTiempo.value = tiempo;
        }
        
        if (tonalidad) {
            const selectTonalidad = document.getElementById('tonalidad');
            const option = Array.from(selectTonalidad.options).find(opt => opt.value === tonalidad);
            if (option) selectTonalidad.value = tonalidad;
        }
        
        secciones = seccionesImportadas;
        actualizarVistaPrevia();
        guardarEnLocalStorage();
        mostrarNotificacion('Archivo importado correctamente', 'success');
    };
    
    reader.readAsText(file);
    event.target.value = '';
});

// ==================== LOCAL STORAGE ====================
function guardarEnLocalStorage() {
    const data = {
        nombre: document.getElementById('nombrePieza')?.value || '',
        artista: document.getElementById('artista')?.value || '',
        album: document.getElementById('album')?.value || '',
        genero: document.getElementById('genero')?.value || '',
        tiempo: document.getElementById('tiempo')?.value || '',
        tonalidad: document.getElementById('tonalidad')?.value || '',
        letra: document.getElementById('letra')?.value || '',
        incluirLetra: document.getElementById('incluirLetra')?.checked || false,
        autoFormato: document.getElementById('autoFormato')?.checked || false,
        exportarCompleta: document.getElementById('exportarCompleta')?.checked || false,
        secciones: secciones,
        paintData: Array.from(paintData.entries())
    };
    localStorage.setItem('composerStudio_save', JSON.stringify(data));
}

function cargarDesdeLocalStorage() {
    const saved = localStorage.getItem('composerStudio_save');
    if (!saved) return;

    try {
        const data = JSON.parse(saved);
        
        if (data.nombre !== undefined) document.getElementById('nombrePieza').value = data.nombre;
        if (data.artista !== undefined) document.getElementById('artista').value = data.artista;
        if (data.album !== undefined) document.getElementById('album').value = data.album;
        if (data.genero !== undefined) document.getElementById('genero').value = data.genero;
        if (data.tiempo !== undefined) document.getElementById('tiempo').value = data.tiempo;
        if (data.tonalidad !== undefined) document.getElementById('tonalidad').value = data.tonalidad;
        if (data.letra !== undefined) document.getElementById('letra').value = data.letra;
        if (data.incluirLetra !== undefined) document.getElementById('incluirLetra').checked = data.incluirLetra;
        if (data.autoFormato !== undefined) document.getElementById('autoFormato').checked = data.autoFormato;
        if (data.exportarCompleta !== undefined) document.getElementById('exportarCompleta').checked = data.exportarCompleta;
        
        if (data.secciones) secciones = data.secciones;
        if (data.paintData) paintData = new Map(data.paintData);
        
        actualizarVistaPrevia();
    } catch (e) {
        console.error("Error cargando de LocalStorage:", e);
    }
}

function limpiarTodo() {
    if (!confirm('¿Estás seguro de que quieres limpiar todo? Esta acción borrará todos los datos y no se puede deshacer.')) {
        return;
    }

    // Limpiar campos del formulario
    document.getElementById('nombrePieza').value = '';
    document.getElementById('artista').value = '';
    document.getElementById('album').value = '';
    document.getElementById('genero').value = '';
    document.getElementById('tiempo').value = '';
    document.getElementById('tonalidad').value = '';
    document.getElementById('letra').value = '';
    document.getElementById('incluirLetra').checked = false;
    document.getElementById('autoFormato').checked = false;
    document.getElementById('exportarCompleta').checked = true;

    // Limpiar arrays y datos
    secciones = [];
    paintData.clear();
    historialUndo = [];

    // Limpiar localStorage
    localStorage.removeItem('composerStudio_save');

    // Actualizar vista
    actualizarVistaPrevia();
    mostrarNotificacion('Todo ha sido limpiado correctamente', 'success');
}

// ==================== UTILIDADES ====================
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function descargarArchivo(contenido, nombreArchivo, tipo) {
    const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nombreArchivo;
    link.click();
    URL.revokeObjectURL(link.href);
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const colores = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    const notification = document.createElement('div');
    notification.textContent = mensaje;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colores[tipo] || colores.info};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10001;
        animation: fadeOut 2s ease-out forwards;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// ==================== BARRA FLOTANTE ====================
function mostrarBarraFlotante() {
    const barra = document.getElementById('barraFlotanteContainer');
    barra.style.display = 'block';
    setTimeout(() => barra.classList.add('show'), 10);
    inicializarDragBarra(barra);
}

function inicializarDragBarra(element) {
    if (element.dataset.dragInitialized) return;
    element.dataset.dragInitialized = 'true';
    
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    
    const dragStart = (e) => {
        if (e.target.closest('.btn-toggle-flotante') || e.target.closest('button') || e.target.closest('input')) return;
        
        isDragging = true;
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        startX = clientX;
        startY = clientY;
        
        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        element.style.position = 'fixed';
        element.style.left = initialLeft + 'px';
        element.style.top = initialTop + 'px';
        element.style.bottom = 'auto';
        element.style.right = 'auto';
        element.style.transform = 'none';
        element.style.transition = 'none';
        element.classList.add('dragging');
        
        if (e.type === 'mousedown') e.preventDefault();
    };
    
    const drag = (e) => {
        if (!isDragging) return;
        
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        let newLeft = initialLeft + (clientX - startX);
        let newTop = initialTop + (clientY - startY);
        
        const margin = 10;
        newLeft = Math.min(Math.max(newLeft, margin), window.innerWidth - element.offsetWidth - margin);
        newTop = Math.min(Math.max(newTop, margin), window.innerHeight - element.offsetHeight - margin);
        
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    };
    
    const dragEnd = () => {
        isDragging = false;
        element.style.transition = '';
        element.classList.remove('dragging');
    };
    
    element.addEventListener('mousedown', dragStart);
    element.addEventListener('touchstart', dragStart, { passive: false });
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
}

function cerrarBarraFlotante() {
    const barra = document.getElementById('barraFlotanteContainer');
    barra.classList.remove('show');
    setTimeout(() => barra.style.display = 'none', 400);
}

function toggleFlotanteOrden() {
    const section = document.querySelector('.flotante-orden');
    const btn = section.querySelector('.btn-toggle-flotante i');
    section.classList.toggle('collapsed');
    
    if (section.classList.contains('collapsed')) {
        btn.classList.replace('bi-chevron-up', 'bi-chevron-down');
    } else {
        btn.classList.replace('bi-chevron-down', 'bi-chevron-up');
    }
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    const inputs = ['nombrePieza', 'artista', 'album', 'genero', 'letra', 'tiempo', 'tonalidad', 'incluirLetra', 'exportarCompleta'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.addEventListener('input', () => {
            actualizarVistaPrevia();
            guardarEnLocalStorage();
            guardarHistorial();
        });
    });
    
    const autoFormato = document.getElementById('autoFormato');
    if (autoFormato) autoFormato.addEventListener('change', () => {
        aplicarFormatoGlobal();
        guardarEnLocalStorage();
        guardarHistorial();
    });
    
    const colorPicker = document.getElementById('paintColorPickerBarra');
    if (colorPicker) colorPicker.addEventListener('change', (e) => cambiarColorPaint(e.target.value));
    
    const brushSize = document.getElementById('paintBrushSizeBarra');
    if (brushSize) brushSize.addEventListener('change', (e) => cambiarTamanioPincel(e.target.value));

    // Mostrar barra flotante al hacer clic o tocar secciones de acordes
    const handleShowBarra = (e) => {
        const acordeDiv = e.target.closest('.acordes');
        if (acordeDiv) {
            console.log('Mostrando barra flotante...');
            mostrarBarraFlotante();
            
            // Actualizar siempre el foco a la sección donde se hizo clic
            const seccionDiv = acordeDiv.closest('.seccion');
            if (seccionDiv) {
                const newId = String(seccionDiv.dataset.seccionId);
                if (ultimaSeccionFocoId !== newId) {
                    ultimaSeccionFocoId = newId;
                    ultimaLineaFocoIndice = 0;
                    ultimoOffsetFoco = 0;
                }
            }
        }
    };

    document.addEventListener('click', handleShowBarra);
    
    // Evitar que los botones de la barra flotante roben el foco del input
    const barraFlotante = document.getElementById('barraFlotanteContainer');
    if (barraFlotante) {
        barraFlotante.addEventListener('mousedown', e => {
            const btn = e.target.closest('button');
            if (btn) {
                e.preventDefault();
            }
        });
    }

    // Inicializar piano si existe
    const pianoContainer = document.getElementById('pianoContainer');
    if (pianoContainer) {
        // Configurar teclas del piano para reproducción simple (sin modificar el modo)
        document.querySelectorAll('.piano-key').forEach(key => {
            key.addEventListener('click', (e) => {
                // Si no estamos en modo selección de acorde, solo tocar y no insertar
                if (!acordePendiente && acordePendiente !== '') {
                    const nota = key.dataset.note;
                    const octava = parseInt(key.dataset.octave) || 4;
                    tocarNota(nota, octava);
                    key.classList.add('active');
                    setTimeout(() => key.classList.remove('active'), 150);
                }
            });
        });
    }

    cargarDesdeLocalStorage();
    guardarHistorial();
});

// ==================== PIANO VIRTUAL ====================
let audioContext = null;
let acordePendiente = null; // null = reproducción simple, '' = acorde mayor, 'm' = menor, etc.
let metronomoTimer = null;
let metronomoActivo = false;
let bpmActual = 120;
let beatActual = 0;
let beatsPorCompasMetronomo = 4;

function initAudio() {
// ... (omitiendo para brevedad, pero se mantiene el cuerpo real)
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive'
        });
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// ==================== METRÓNOMO ====================
function actualizarBPM(valor) {
    bpmActual = parseInt(valor);
    document.getElementById('bpmLabel').textContent = `${bpmActual} BPM`;
    if (metronomoActivo) {
        detenerMetronomo();
        iniciarMetronomo();
    }
}

function toggleMetronomo() {
    initAudio();
    const btn = document.getElementById('btnMetronomo');
    if (metronomoActivo) {
        detenerMetronomo();
        if (btn) {
            btn.classList.remove('btn-danger', 'active');
            btn.classList.add('btn-outline-primary');
            btn.innerHTML = '<i class="bi bi-metronome"></i>';
        }
    } else {
        iniciarMetronomo();
        if (btn) {
            btn.classList.remove('btn-outline-primary');
            btn.classList.add('btn-danger', 'active');
            btn.innerHTML = '<i class="bi bi-stop-circle"></i>';
        }
    }
}

function iniciarMetronomo() {
    metronomoActivo = true;
    const tiempoPorBeat = 60000 / bpmActual;
    const compasGlobal = document.getElementById('tiempo').value.split('/');
    beatsPorCompasMetronomo = parseInt(compasGlobal[0]) || 4;
    
    beatActual = 0;
    
    metronomoTimer = setInterval(() => {
        const light = document.getElementById('metronomeLight');
        const esAcento = beatActual % beatsPorCompasMetronomo === 0;
        
        // Sonido de metrónomo
        tocarClickMetronomo(esAcento);
        
        // Visual
        light.classList.add('active');
        if (esAcento) light.classList.add('strong');
        
        setTimeout(() => {
            if (light) light.classList.remove('active', 'strong');
        }, 100);
        
        beatActual++;
    }, tiempoPorBeat);
}

function detenerMetronomo() {
    metronomoActivo = false;
    clearInterval(metronomoTimer);
    metronomoTimer = null;
    
    const btn = document.getElementById('btnMetronomo');
    if (btn) {
        btn.classList.remove('btn-danger', 'active');
        btn.classList.add('btn-outline-primary');
        btn.innerHTML = '<i class="bi bi-metronome"></i>';
    }
}

function tocarClickMetronomo(acento) {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(acento ? 1000 : 800, audioContext.currentTime);
    
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.05);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.05);
}

function togglePiano() {
    const pianoContainer = document.getElementById('pianoContainer');
    const btnToggle = document.getElementById('btnTogglePiano');
    
    initAudio(); // Inicializar audio al hacer clic

    if (pianoContainer.style.display === 'none') {
        pianoContainer.style.display = 'block';
        if (btnToggle) btnToggle.classList.add('active');
        
        // Sincronizar eventos del piano una sola vez de forma robusta
        prepararEventosPiano();
    } else {
        pianoContainer.style.display = 'none';
        if (btnToggle) btnToggle.classList.remove('active');
    }
}

function prepararEventosPiano() {
    const piano = document.getElementById('piano');
    if (!piano || piano.dataset.eventosListos) return;

    // Delegación de eventos para mayor eficiencia y evitar clones
    ['pointerdown'].forEach(evtType => {
        piano.addEventListener(evtType, (e) => {
            const key = e.target.closest('.piano-key');
            if (!key) return;
            
            e.preventDefault();
            initAudio(); // Asegurar audio activo en cada toque

            const nota = key.dataset.note;
            const octava = parseInt(key.dataset.octave) || 4;

            // 1. Tocar sonido inmediatamente
            tocarNota(nota, octava);
            
            // 2. Efecto visual de pulsación
            key.classList.add('active');
            setTimeout(() => key.classList.remove('active'), 150);

            // 3. Si estamos en modo inserción de acorde
            if (acordePendiente !== null) {
                const notaCompleta = nota + (acordePendiente || '');
                insertarEnSeccion(` ${notaCompleta} `);
                
                // Mostrar en el display
                const pianoDisplay = document.getElementById('pianoDisplay');
                if (pianoDisplay) pianoDisplay.textContent = notaCompleta;
            } else {
                // Modo reproducción simple: mostrar nota en display
                const pianoDisplay = document.getElementById('pianoDisplay');
                if (pianoDisplay) {
                    pianoDisplay.textContent = nota + octava;
                    setTimeout(() => { 
                        if (pianoDisplay.textContent === nota + octava) pianoDisplay.textContent = ''; 
                    }, 1000);
                }
            }
        });
    });

    piano.dataset.eventosListos = 'true';
}

// Frecuencias base de las notas (Octava 0)
const notasFrecuenciasBase = {
    'C': 16.35, 'C#': 17.32, 'D': 18.35, 'D#': 19.45, 'E': 20.60, 'F': 21.83, 'F#': 23.12, 'G': 24.50, 'G#': 25.96, 'A': 27.50, 'A#': 29.14, 'B': 30.87
};

function tocarNota(nota, octava = 4) {
    initAudio();
    
    const frecuenciaBase = notasFrecuenciasBase[nota];
    if (!frecuenciaBase) return;
    
    const frecuencia = frecuenciaBase * Math.pow(2, octava);
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frecuencia, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01); // Ataque rápido
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1.2); // Decaimiento
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1.2);
}

function insertarAcordePiano(modificador = '') {
    initAudio();
    acordePendiente = modificador;
    mostrarNotificacion(`Modo: Insertar acorde ${modificador || 'mayor'} - Toca una tecla`, 'info');
}

// ==================== REPRODUCCIÓN EN PIANO ====================
const INTERVALOS_ACORDES = {
    '': [0, 4, 7],
    'm': [0, 3, 7],
    '7': [0, 4, 7, 10],
    'maj7': [0, 4, 7, 11],
    'm7': [0, 3, 7, 10],
    'dim': [0, 3, 6],
    'aug': [0, 4, 8],
    'sus2': [0, 2, 7],
    'sus4': [0, 5, 7],
    'maj9': [0, 4, 7, 11, 14],
    'm9': [0, 3, 7, 10, 14],
    '9': [0, 4, 7, 10, 14],
    '11': [0, 4, 7, 10, 14, 17],
    '13': [0, 4, 7, 10, 14, 17, 21]
};

const MAPA_NOTAS_INDICE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const INDICE_NOTAS_MAPA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function expandirRepeticiones(linea) {
    // Reemplaza bloques || ... || [xN] por el contenido repetido N veces
    // Soporta || A | E || (repite 2 veces por defecto)
    // Soporta || A | E || x3 (repite 3 veces)
    return linea.replace(/\|\|(.*?)\|\|(?:\s*x\s*(\d+))?/g, (match, contenido, multiplicador) => {
        const veces = multiplicador ? parseInt(multiplicador) : 2;
        const contenidoLimpio = contenido.trim();
        if (!contenidoLimpio) return "";
        
        let expandido = [];
        for (let i = 0; i < veces; i++) {
            expandido.push(contenidoLimpio);
        }
        // Unimos con | para que el split posterior funcione bien
        return " | " + expandido.join(" | ") + " | ";
    });
}

function tocarSeccionEnPiano(seccionId, inicioRetraso = 0) {
    const seccion = secciones.find(s => String(s.id) === String(seccionId));
    if (!seccion || !seccion.acordes.trim()) {
        if (inicioRetraso === 0) mostrarNotificacion('La sección está vacía', 'warning');
        return 0;
    }

    const pianoContainer = document.getElementById('pianoContainer');
    if (pianoContainer.style.display === 'none') togglePiano();
    if (inicioRetraso === 0) pianoContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const bpmEfectivo = seccion.bpm || bpmActual;
    const tiempoPorBeat = 60000 / bpmEfectivo;
    const compasEfectivo = (seccion.tiempo || document.getElementById('tiempo').value).split('/');
    const beatsPorCompasEfectivo = parseInt(compasEfectivo[0]) || 4;

    setTimeout(() => {
        const pianoDisplay = document.getElementById('pianoDisplay');
        if (pianoDisplay) {
            pianoDisplay.innerHTML = `<span class="badge bg-primary me-2">${seccion.tipo}</span>`;
        }

        if (metronomoActivo) {
            beatsPorCompasMetronomo = beatsPorCompasEfectivo;
            beatActual = 0;
            if (seccion.bpm) {
                detenerMetronomo();
                const originalBpm = bpmActual;
                bpmActual = seccion.bpm;
                iniciarMetronomo();
                bpmActual = originalBpm;
            }
        } else if (inicioRetraso === 0) {
            initAudio();
        }
    }, inicioRetraso);

    const lineas = seccion.acordes.split('\n');
    let tiempoRelativo = 0;
    const pianoDisplay = document.getElementById('pianoDisplay');

    lineas.forEach(linea => {
        if (!linea.trim()) return;

        // Lógica de transición →
        if (linea.includes('→')) {
            const partes = linea.split('→');
            const transicion = partes[partes.length - 1].trim();
            
            // Si hay contenido estructural (nombres de secciones)
            if (transicion && !transicion.match(/^[A-G#b|]+$/i)) {
                // Analizar secuencia: Voz, Coro x2, ...
                const secuencia = transicion.split(',').map(s => s.trim());
                let subTiempoAcumulado = tiempoRelativo;

                secuencia.forEach(item => {
                    const match = item.match(/^(.+?)(?:\s+x(\d+))?$/);
                    let nombreSeccion = match ? match[1].trim() : item.trim();
                    const reps = match && match[2] ? parseInt(match[2]) : 1;
                    
                    if (nombreSeccion === '...') {
                        // Tocar todo lo que falta de la canción
                        const idxActual = secciones.indexOf(seccion);
                        const siguientes = secciones.slice(idxActual + 1);
                        siguientes.forEach(s => {
                            const dur = tocarSeccionEnPiano(s.id, inicioRetraso + subTiempoAcumulado);
                            subTiempoAcumulado += dur + 500;
                        });
                    } else {
                        // Buscar sección por tipo
                        const destino = secciones.find(s => s.tipo.toLowerCase() === nombreSeccion.toLowerCase());
                        if (destino) {
                            for (let r = 0; r < reps; r++) {
                                const dur = tocarSeccionEnPiano(destino.id, inicioRetraso + subTiempoAcumulado);
                                subTiempoAcumulado += dur + 500;
                            }
                        }
                    }
                });
                // No sumamos tiempoRelativo aquí porque las llamadas recursivas ya usan el inicioRetraso
                return; 
            }
        }

        const esAcordeModo = linea.includes('|');
        
        if (esAcordeModo) {
            // Expandir repeticiones || ... || [xN]
            const lineaExpandida = expandirRepeticiones(linea);

            // Dividir por compases | C G | Am |
            const compases = lineaExpandida.split('|').map(c => c.trim()).filter(c => c !== '');
            
            let ultimoCompasReal = null;

            // Función auxiliar para procesar un compás individual
            const procesarCompas = (compas, tiempoOffset) => {
                // Tokens que no son guiones decorativos individuales, pero permiten -- (silencio)
                const tokensRaw = compas.split(/\s+/).filter(t => t.trim() !== '' && t !== '-');
                if (tokensRaw.length === 0) return 0;

                // Mapear tokens a objetos con peso (1 + cantidad de puntos)
                const tokensProcesados = tokensRaw.map(t => {
                    const matchDots = t.match(/^([^\.]+)(\.*)$/);
                    const limpio = matchDots ? matchDots[1] : t;
                    const puntos = matchDots ? matchDots[2].length : 0;
                    return { texto: limpio, peso: 1 + puntos, original: t };
                });

                const pesoTotalCompas = tokensProcesados.reduce((sum, t) => sum + t.peso, 0);
                let tiempoLocal = tiempoOffset;
                
                tokensProcesados.forEach((tokenObj) => {
                    const numBeatsToken = (tokenObj.peso / pesoTotalCompas) * beatsPorCompasEfectivo;
                    
                    for (let b = 0; b < numBeatsToken; b++) {
                        const tiempoDeEsteBeat = inicioRetraso + tiempoLocal;

                        if (tokenObj.texto !== '--') {
                            const match = tokenObj.texto.match(/^([CDEFGAB][#b♭♯]?)(m|maj|min|dim|aug|sus|add|no)?\d*(maj7|m7|maj9|m9|7|9|11|13|sus2|sus4|sus|add9|no5|b5|#5|b9|#9|#11|b13)?(?:\/([CDEFGAB][#b♭♯]?))?$/i);
                            
                            if (match) {
                                const notaBase = match[1].toUpperCase();
                                const sufijo = (match[2] || '') + (match[3] || '');
                                const bajo = match[4] ? match[4].toUpperCase() : null;

                                const tId = setTimeout(() => {
                                    limpiarMarcasPiano(false);
                                    if (pianoDisplay) {
                                        pianoDisplay.innerHTML = `<span class="badge bg-primary me-2">${seccion.tipo}</span> <span class="text-primary">${tokenObj.original}</span>`;
                                    }
                                    
                                    if (seccion.modoPiano === 'nota' && !sufijo && !bajo) {
                                        tocarNota(notaBase, 4);
                                        resaltarTeclaPiano(notaBase, 4, tiempoPorBeat / 1.5);
                                    } else {
                                        tocarAcordeCompleto(notaBase, sufijo, bajo);
                                    }
                                }, tiempoDeEsteBeat);
                                window._playbackTimers.push(tId);
                            }
                        } else {
                            const tId = setTimeout(() => {
                                limpiarMarcasPiano(false);
                                if (pianoDisplay) {
                                    pianoDisplay.innerHTML = `<span class="badge bg-primary me-2">${seccion.tipo}</span> <span class="text-muted">(silencio)</span>`;
                                }
                            }, tiempoDeEsteBeat);
                            window._playbackTimers.push(tId);
                        }
                        
                        tiempoLocal += tiempoPorBeat;
                    }
                });
                
                return pesoTotalCompas * tiempoPorBeat;
            };

            compases.forEach(compas => {
                // Lógica de repetición de compás (%)
                if (compas === '%' && ultimoCompasReal) {
                    compas = ultimoCompasReal;
                } else if (compas !== '%') {
                    // Lógica de repetición por número (ej: "1", "2", "6")
                    // Si el compás es solo un número, repite el anterior esa cantidad de veces
                    const matchNumero = compas.match(/^(\d+)$/);
                    if (matchNumero && ultimoCompasReal) {
                        const repeticiones = parseInt(matchNumero[1]);
                        // Repetir el último compás real N veces
                        for (let r = 0; r < repeticiones; r++) {
                            const duracion = procesarCompas(ultimoCompasReal, tiempoRelativo);
                            tiempoRelativo += duracion;
                        }
                        return; // Saltar el procesamiento normal de este compás
                    }
                    ultimoCompasReal = compas;
                }

                const duracion = procesarCompas(compas, tiempoRelativo);
                tiempoRelativo += duracion;
            });
        } else {
            // Modo notas sueltas (1 beat cada una)
            const tokens = linea.split(/\s+/).filter(t => t.trim() !== '');
            tokens.forEach(token => {
                const match = token.match(/^([CDEFGAB][#b]?)(m|dim|aug|maj7|m7|7|9|11|13|sus2|sus4)?(maj7|m7|7|9|11|13)?(?:\/([CDEFGAB][#b]?))?$/i);
                if (match) {
                    const notaBase = match[1].toUpperCase();
                    const sufijo = (match[2] || '') + (match[3] || '');
                    const bajo = match[4] ? match[4].toUpperCase() : null;

                    const tId = setTimeout(() => {
                        limpiarMarcasPiano(false);
                        if (pianoDisplay) {
                            pianoDisplay.innerHTML = `<span class="badge bg-primary me-2">${seccion.tipo}</span> <span class="text-primary">${token}</span>`;
                        }
                        
                        if (seccion.modoPiano === 'nota' && !sufijo && !bajo) {
                            tocarNota(notaBase, 4);
                            resaltarTeclaPiano(notaBase, 4, tiempoPorBeat / 1.5);
                        } else {
                            tocarAcordeCompleto(notaBase, sufijo, bajo);
                        }
                    }, inicioRetraso + tiempoRelativo);
                    window._playbackTimers.push(tId);
                    tiempoRelativo += tiempoPorBeat;
                }
            });
        }
    });

    return tiempoRelativo;
}

function tocarCancionCompletaEnPiano() {
    if (secciones.length === 0) {
        mostrarNotificacion('Agrega secciones musicales primero', 'warning');
        return;
    }

    detenerReproduccionPiano(); // Limpiar previas
    mostrarNotificacion('Iniciando reproducción de la canción completa...', 'success');
    
    // Scroll al piano al empezar
    const pianoContainer = document.getElementById('pianoContainer');
    if (pianoContainer.style.display === 'none') togglePiano();
    pianoContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    let tiempoAcumulado = 0;
    const pausaEntreSecciones = 500; // Pequeña pausa de medio segundo entre secciones

    secciones.forEach((seccion) => {
        const duracionSeccion = tocarSeccionEnPiano(seccion.id, tiempoAcumulado);
        if (duracionSeccion > 0) {
            tiempoAcumulado += duracionSeccion + pausaEntreSecciones;
        }
    });

    // Limpiar el display al terminar toda la canción
    const endId = setTimeout(() => {
        const pianoDisplay = document.getElementById('pianoDisplay');
        if (pianoDisplay) pianoDisplay.textContent = 'FIN';
        setTimeout(() => { if (pianoDisplay) pianoDisplay.textContent = ''; }, 2000);
        detenerMetronomo();
        const btn = document.getElementById('btnMetronomo');
        if (btn) {
            btn.classList.remove('btn-danger', 'active');
            btn.classList.add('btn-outline-primary');
            btn.innerHTML = '<i class="bi bi-metronome"></i>';
        }
    }, tiempoAcumulado);
    window._playbackTimers.push(endId);
}

function tocarAcordeCompleto(notaBase, sufijo, bajo = null) {
    const baseIdx = MAPA_NOTAS_INDICE[notaBase];
    if (baseIdx === undefined) return;

    // Buscar el mejor ajuste de intervalos
    let intervalos = INTERVALOS_ACORDES['']; // Default mayor
    for (const [key, value] of Object.entries(INTERVALOS_ACORDES)) {
        if (key && sufijo.toLowerCase().includes(key)) {
            intervalos = value;
            break;
        }
    }

    // Duración de la iluminación (sincronizada con el beat)
    const duracionLuz = 60000 / (bpmActual * 1.5); // Un poco menos que un beat para que parpadee

    intervalos.forEach(intervalo => {
        const totalSemitonos = baseIdx + intervalo;
        const octavaOffset = Math.floor(totalSemitonos / 12);
        const notaFinalIdx = totalSemitonos % 12;
        const notaFinal = INDICE_NOTAS_MAPA[notaFinalIdx];
        const octavaFinal = 4 + octavaOffset;

        tocarNota(notaFinal, octavaFinal);
        resaltarTeclaPiano(notaFinal, octavaFinal, duracionLuz);
    });

    // Tocar el bajo si existe
    if (bajo) {
        const bajoIdx = MAPA_NOTAS_INDICE[bajo];
        if (bajoIdx !== undefined) {
            // El bajo suele tocarse una octava por debajo (Octava 3)
            tocarNota(bajo, 3);
            resaltarTeclaPiano(bajo, 3, duracionLuz);
        }
    }
}

function resaltarTeclaPiano(nota, octava, duracionMs) {
    const selector = `.piano-key[data-note="${nota}"][data-octave="${octava}"]`;
    const tecla = document.querySelector(selector);
    
    if (tecla) {
        tecla.classList.add('marked-persistent');
        // El temporizador de 20s se mantiene como fallback o para clics manuales,
        // pero tocarSeccionEnPiano limpiará antes de la siguiente nota.
        const timerId = setTimeout(() => {
            tecla.classList.remove('marked-persistent');
        }, duracionMs);
        
        if (!window._pianoTimers) window._pianoTimers = [];
        window._pianoTimers.push(timerId);
    }
}

function limpiarMarcasPiano(mostrarNotif = true) {
    document.querySelectorAll('.piano-key').forEach(tecla => {
        tecla.classList.remove('marked-persistent');
    });
    
    if (window._pianoTimers) {
        window._pianoTimers.forEach(timerId => clearTimeout(timerId));
        window._pianoTimers = [];
    }
    
    if (mostrarNotif) {
        mostrarNotificacion('Piano limpiado', 'info');
        const pianoDisplay = document.getElementById('pianoDisplay');
        if (pianoDisplay) pianoDisplay.textContent = '';
    }
}