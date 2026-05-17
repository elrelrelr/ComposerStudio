// ==================== ESTADO GLOBAL ====================
let secciones = [];
let paintMode = false;
let currentPaintColor = '#000000';
let currentBrushSize = 3;
let paintData = new Map();
let ultimaSeccionFocoId = null;
let ultimaLineaFocoIndice = 0;
let ultimoOffsetFoco = 0;

// Escalas para sugerencia de tonalidad
const escalas = {
    "C": ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
    "G": ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
    "D": ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
    "A": ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
    "E": ["E", "F#m", "G#m", "A", "B", "C#m", "D#dim"],
    "B": ["B", "C#m", "D#m", "E", "F#", "G#m", "A#dim"],
    "F#": ["F#", "G#dim", "A", "B", "C#", "D#m", "E"],
    "C#": ["C#", "D#dim", "E", "F#", "G#", "A#m", "B"],
    "Cb": ["Cb", "D", "E", "F", "G", "A", "B"],
    "F": ["F", "Gm", "Am", "Bb", "C", "Dm", "Edim"],
    "Bb": ["Bb", "Cm", "Dm", "Eb", "F", "Gm", "Adim"],
    "Eb": ["Eb", "Fm", "Gm", "Ab", "Bb", "Cm", "Ddim"],
    "Db": ["Db", "Edim", "F", "Gb", "Ab", "Bbm", "Cm"],
    "Gb": ["Gb", "Abm", "Bbm", "Cb", "Db", "Ebm", "Fm"],
    "Am": ["Am", "Bdim", "C", "Dm", "Em", "F", "G"],
    "Em": ["Em", "F#dim", "G", "Am", "Bm", "C", "D"],
    "Bm": ["Bm", "C#dim", "D", "Em", "F#m", "G", "A"],
    "F#m": ["F#m", "G#dim", "A", "Bm", "C#m", "D", "E"],
    "C#m": ["C#m", "D#dim", "E", "F#m", "G#m", "A", "B"],
    "G#m": ["G#m", "A#dim", "B", "C#m", "D#m", "E", "F#"],
    "D#m": ["D#m", "E#dim", "F#", "G#m", "A#m", "B", "C#"],
    "A#m": ["A#m", "B#dim", "C#", "D#m", "E#m", "F#", "G#"],
    "Fm": ["Fm", "Gdim", "Ab", "Bbm", "Cm", "Db", "Edim"],
    "Cm": ["Cm", "Ddim", "Eb", "Fm", "Gm", "Ab", "Bb"],
    "Gm": ["Gm", "Adim", "Bb", "Cm", "Dm", "Eb", "F"],
    "Abm": ["Abm", "Bdim", "Cb", "Dbm", "Ebm", "Fb", "Gb"],
    "Ebm": ["Ebm", "Fm", "Gb", "Abm", "Bbm", "Cb", "Db"],
    "Bbm": ["Bbm", "Cm", "Db", "Ebm", "Fm", "Gb", "Ab"]
};

// ==================== AUTO FORMATO DE ACORDES ====================
function formatearTextoAcordes(texto) {
    const acordePattern = '[CDEFGAB][#b]?m?(?:dim|aug|maj7|m7|7|9|11|13|sus2|sus4)?';
    
    // Regla 1: Unir bajos (quitar espacios alrededor de /)
    const rule1Regex = new RegExp(`(${acordePattern})\\s*\\/\\s*(${acordePattern})`, 'gi');
    
    // Regla 2: Separar acordes en un compás con guion
    const rule2Regex = new RegExp(`(^|\\s|\\|\\s*)(${acordePattern}(?:\\/${acordePattern})?)\\s+(${acordePattern}(?:\\/${acordePattern})?)(?=\\s|$|\\|)`, 'gi');

    let lineas = texto.split('\n');
    let nuevasLineas = lineas.map(linea => {
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
    const rule1Regex = new RegExp(`(${acordePattern})\\/(${acordePattern})`, 'gi');
    
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

// ==================== FUNCIONES PRINCIPALES ====================
function agregarSeccion(tipo) {
    const id = Date.now();
    secciones.push({ 
        id: id, 
        tipo: tipo, 
        acordes: '', 
        paintData: null,
        tonalidadSugerida: null
    });
    
    // Forzar que la nueva sección sea el objetivo del foco
    ultimaSeccionFocoId = id;
    ultimaLineaFocoIndice = 0;
    ultimoOffsetFoco = 0;
    
    guardarTodasLasSecciones();
    actualizarVistaPrevia();
    mostrarBarraFlotante();
}

function eliminarSeccion(id) {
    guardarTodasLasSecciones();
    secciones = secciones.filter(s => s.id !== id);
    paintData.delete(id);
    actualizarVistaPrevia();
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
    html += `<div style="font-size: 16px; color: #555;">Compás: ${tiempo} | Tonalidad: ${tonalidad}</div></div>`;
    
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
                        html += `<div class="acorde-linea">${escapeHtml(linea.trim() || ' ')}</div>`;
                    });
                } else {
                    html += `<div class="acorde-linea"></div>`;
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
        const seccionId = parseInt(element.dataset.seccionId);
        // Si hay datos de dibujo o el modo está activo, inicializar canvas
        if (paintData.has(seccionId) || paintMode) {
            inicializarPaintCanvas(element);
        }
    });

    restaurarFoco();
}

// ==================== INSERCIÓN DE TEXTO ====================
function insertarEnSeccion(texto) {
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
            // Si encontramos la línea por selección real, actualizamos la memoria
            guardarPosicionFoco();
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
                // Restaurar offset de memoria
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
                range.collapse(true);
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
            guardarPosicionFoco();
        } else {
            return;
        }
    }
        
        if (esRepeticion) {
            // Lógica robusta para detectar repetición anterior
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
                    
                    // Reemplazar en el nodo de texto
                    const startPos = match.index;
                    const beforeMatch = textNode.textContent.substring(0, startPos);
                    const afterCursor = textNode.textContent.substring(offset);
                    
                    textNode.textContent = beforeMatch + textoAInsertar + afterCursor;
                    
                    // Reposicionar cursor
                    const newRange = document.createRange();
                    newRange.setStart(textNode, beforeMatch.length + textoAInsertar.length);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    
                    // Sincronizar con los datos de la sección
                    const seccionDiv = acordeLinea.closest('.seccion');
                    if (seccionDiv) {
                        const seccionId = parseInt(seccionDiv.dataset.seccionId);
                        const seccion = secciones.find(s => s.id === seccionId);
                        const contentDiv = acordeLinea.closest('.acordes-content');
                        if (seccion && contentDiv) {
                            const lineas = [];
                            contentDiv.querySelectorAll('.acorde-linea').forEach(linea => {
                                lineas.push(linea.textContent);
                            });
                            seccion.acordes = lineas.join('\n');
                        }
                    }

                    guardarTodasLasSecciones();
                    actualizarVistaPrevia();
                    return;
                }
            }
            // Si no se encontró repetición previa, usamos " x2" por defecto
            textoAInsertar = " x2";
        }

        const seccionDiv = acordeLinea.closest('.seccion');
        if (seccionDiv) {
            const seccionId = parseInt(seccionDiv.dataset.seccionId);
            const seccion = secciones.find(s => s.id === seccionId);
            
            if (seccion) {
                range.deleteContents();
                const textNode = document.createTextNode(textoAInsertar);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Actualizar el contenido de la sección
                const contentDiv = acordeLinea.closest('.acordes-content');
                if (contentDiv) {
                    const lineas = [];
                    contentDiv.querySelectorAll('.acorde-linea').forEach(linea => {
                        lineas.push(linea.textContent);
                    });
                    seccion.acordes = lineas.join('\n');
                }
                
                // Forzar guardado de la nueva posición después de insertar
                guardarPosicionFoco();
                
                // Guardar todas las secciones antes de reconstruir
                guardarTodasLasSecciones();
                
                // Aplicar auto-formato condicionalmente
                const btnFormato = document.getElementById('autoFormato');
                if (btnFormato && btnFormato.checked) {
                    seccion.acordes = formatearTextoAcordes(seccion.acordes);
                }
                
                actualizarVistaPrevia();
            }
        }
}

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
            
            const seccionId = parseInt(acordesElement.dataset.seccionId);
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
        const seccionId = parseInt(acordesElement.dataset.seccionId);
        if (seccionId) {
            const dataURL = canvas.toDataURL();
            paintData.set(seccionId, dataURL);
            const seccion = secciones.find(s => s.id === seccionId);
            if (seccion) seccion.paintData = dataURL;
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
            const seccion = secciones.find(s => s.id === seccionId);
            if (seccion) seccion.paintData = null;
            
            mostrarNotificacion('Dibujo eliminado de esta sección', 'info');
            guardarTodasLasSecciones();
            actualizarVistaPrevia();
        }
    }
}

function limpiarPaintActual() {
    let seccionActiva = null;
    const activeElement = document.activeElement;
    const acordesElement = activeElement?.closest?.('.acordes');
    
    if (acordesElement) {
        const seccionId = parseInt(acordesElement.dataset.seccionId);
        seccionActiva = secciones.find(s => s.id === seccionId);
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
        .map(linea => linea.textContent).join(' ');
        
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
    const seccion = secciones.find(s => s.id === seccionId);
    if (!seccion || !seccion.acordes) {
        mostrarNotificacion('Esta sección no tiene acordes', 'warning');
        return;
    }
    
    if (seccion.tonalidadSugerida) {
        seccion.tonalidadSugerida = null;
        actualizarVistaPrevia();
        return;
    }
    
    const tonalidadGanadora = calcularTonalidad(seccion.acordes);
    if (!tonalidadGanadora) {
        mostrarNotificacion('No se detectaron acordes en esta sección', 'warning');
        return;
    }
    
    seccion.tonalidadSugerida = tonalidadGanadora;
    actualizarVistaPrevia();
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
        const seccionOriginal = secciones.find(s => s.id === seccionId);
        if (seccionOriginal) {
            agregarSeccion(`=${seccionOriginal.tipo}`);
        }
    }
}

// ==================== TRANSPOSICIÓN ====================
function transponerSeccion(seccionId, pasos) {
    // Primero guardamos lo que el usuario haya escrito en la interfaz
    guardarTodasLasSecciones();

    const seccion = secciones.find(s => s.id === seccionId);
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
        const seccionId = parseInt(seccionDiv.dataset.seccionId);
        const seccion = secciones.find(s => s.id === seccionId);
        
        if (seccion) {
            const contentDiv = seccionDiv.querySelector('.acordes-content');
            if (contentDiv) {
                const lineas = Array.from(contentDiv.querySelectorAll('.acorde-linea')).map(l => l.textContent);
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
    const linea = e.target;
    const contentDiv = linea.closest('.acordes-content');
    const seccionDiv = linea.closest('.seccion');
    
    if (contentDiv && seccionDiv) {
        const seccionId = parseInt(seccionDiv.dataset.seccionId);
        const seccion = secciones.find(s => s.id === seccionId);
        if (seccion) {
            const lineas = Array.from(contentDiv.querySelectorAll('.acorde-linea')).map(l => l.textContent);
            seccion.acordes = lineas.join('\n');
        }
    }
}

function handleTituloInput(e) {
    const titulo = e.target;
    const seccionDiv = titulo.closest('.seccion');
    if (seccionDiv) {
        const seccionId = parseInt(seccionDiv.dataset.seccionId);
        const seccion = secciones.find(s => s.id === seccionId);
        if (seccion) {
            const texto = titulo.textContent.trim();
            const partes = texto.split(' ');
            const numero = partes[partes.length - 1];
            seccion.tipo = isNaN(numero) ? texto : partes.slice(0, -1).join(' ');
        }
    }
}

function handleAcordeBlur(e) {
    const linea = e.target;
    const contentDiv = linea.closest('.acordes-content');
    const seccionDiv = linea.closest('.seccion');
    
    if (contentDiv && seccionDiv) {
        const seccionId = parseInt(seccionDiv.dataset.seccionId);
        const seccion = secciones.find(s => s.id === seccionId);
        if (seccion) {
            // Guardar estado actual
            guardarTodasLasSecciones();
            
            const btnFormato = document.getElementById('autoFormato');
            if (btnFormato && btnFormato.checked) {
                const formateado = formatearTextoAcordes(seccion.acordes);
                if (formateado !== seccion.acordes) {
                    seccion.acordes = formateado;
                    
                    // Re-renderizar solo esta sección para no perder el foco global
                    const nuevasLineas = formateado.split('\n');
                    contentDiv.innerHTML = '';
                    nuevasLineas.forEach(l => {
                        const div = document.createElement('div');
                        div.className = 'acorde-linea';
                        div.textContent = l || ' ';
                        contentDiv.appendChild(div);
                    });
                    agregarEventListenersEditables();
                }
            }
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
                ultimaSeccionFocoId = parseInt(seccionDiv.dataset.seccionId);
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
function exportarMarkdown() {
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
        contenido += `### ${seccion.tipo} ${index + 1}\n\n`;
        if (seccion.acordes.trim()) {
            contenido += "```text\n" + seccion.acordes.trim() + "\n```\n\n";
        }
    });
    
    descargarArchivo(contenido, `${nombre.replace(/[^a-z0-9]/gi, '_')}.md`, 'text/markdown');
    mostrarNotificacion('Archivo Markdown exportado correctamente', 'success');
}

async function exportarImagen() {
    await exportarComoImagen('image/png', '.png');
}

async function exportarPDF() {
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
                    seccionesImportadas.push({
                        id: Date.now() + seccionesImportadas.length,
                        tipo: tipoSeccion,
                        acordes: lineaActual.trim(),
                        paintData: null
                    });
                }
                tipoSeccion = line.replace('### ', '').trim().replace(/\s+\d+$/, '');
                lineaActual = '';
                enSeccion = true;
                enLetra = false;
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
            seccionesImportadas.push({
                id: Date.now() + seccionesImportadas.length,
                tipo: tipoSeccion,
                acordes: lineaActual.trim(),
                paintData: null
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
        mostrarNotificacion('Archivo importado correctamente', 'success');
    };
    
    reader.readAsText(file);
    event.target.value = '';
});

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
        if (element) element.addEventListener('input', actualizarVistaPrevia);
    });
    
    const autoFormato = document.getElementById('autoFormato');
    if (autoFormato) autoFormato.addEventListener('change', aplicarFormatoGlobal);
    
    const colorPicker = document.getElementById('paintColorPickerBarra');
    if (colorPicker) colorPicker.addEventListener('change', (e) => cambiarColorPaint(e.target.value));
    
    const brushSize = document.getElementById('paintBrushSizeBarra');
    if (brushSize) brushSize.addEventListener('change', (e) => cambiarTamanioPincel(e.target.value));

    // Mostrar barra flotante al hacer clic o tocar secciones de acordes
    const handleShowBarra = (e) => {
        if (e.target.closest('.acordes')) {
            console.log('Mostrando barra flotante...');
            mostrarBarraFlotante();
        }
    };

    document.addEventListener('click', handleShowBarra);
    
    // Evitar que los botones de la barra flotante roben el foco del input
    document.querySelectorAll('.barra-flotante button').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
    });
});