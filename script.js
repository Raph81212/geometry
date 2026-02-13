import * as compass from './tool-compass.js';
import * as ruler from './tool-ruler.js';
import * as protractor from './tool-protractor.js';
import * as setsquare from './tool-setsquare.js';
import * as snap from './snap.js';
import * as utils from './utils.js';
import * as grid from './grid.js';
import * as drawing from './drawing.js';
import { calculateLineCanvasIntersections } from './line-utils.js'; // Keep this for temporary drawing in script.js
import * as lineTool from './tool-line-and-segment.js'; // Re-import the line tool module
import * as shapeInteraction from './shape-interaction.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Initialisation ---
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');

    // Références aux boutons
    const toolButtons = document.querySelectorAll('.tool-btn');
    const clearButton = document.getElementById('btn-clear');
    const saveButton = document.getElementById('btn-save');
    const loadButton = document.getElementById('btn-load');
    const fileLoader = document.getElementById('file-loader');
    const undoButton = document.getElementById('btn-undo');
    const redoButton = document.getElementById('btn-redo');
    const recordButton = document.getElementById('btn-record');
    const playButton = document.getElementById('btn-play');
    const replayLoopCheckbox = document.getElementById('replay-loop');
    const saveRecordingButton = document.getElementById('btn-save-recording');
    const loadRecordingButton = document.getElementById('btn-load-recording');
    const recordingLoader = document.getElementById('recording-loader');
    const colorPickerWrapper = document.getElementById('color-picker-wrapper');
    const currentColorDisplay = document.getElementById('current-color-display');
    const colorSwatches = document.querySelectorAll('#color-palette-popup .color-swatch');
    const rulerOptions = document.getElementById('ruler-options');
    const rulerLengthInput = document.getElementById('ruler-length');
    const gridButton = document.getElementById('btn-grid');

    // --- État de l'application ---
    const PIXELS_PER_CM = 37.8; // Constante pour un écran à 96 DPI
    let shapes = []; // Notre "modèle", la liste de toutes les formes dessinées
    let gridType = 'none'; // 'none', 'cm', 'orthonormal'
    let currentGridIndex = 0;

    const gridStates = [
        {
            type: 'none',
            title: 'Grille : Aucune'
        },
        {
            type: 'cm',
            title: 'Grille : Carreaux'
        },
        {
            type: 'orthonormal',
            title: 'Grille : Repère'
        }
    ];

    // Piles pour l'historique des actions
    let undoStack = [];
    let redoStack = [];
    let pointNameCounter = 0; // Pour nommer les points A, B, C...
    let currentColor = '#000000'; // Couleur de dessin actuelle (noir par défaut)

    let currentTool = null;
    let lineToolState = { // Renamed from lineState to lineToolState to avoid conflict with local lineStartPoint
        mode: 'segment', // 'segment' or 'line'
        isDrawing: false,
        startPoint: null,
    };
    let isDrawingOnTool = false; // Pour tracer une ligne le long d'un outil
    let toolDrawingInfo = null; // { tool: 'ruler'|'setsquare', startPos: {x,y}, edge?: 'h'|'v' }
    // --- État du compas persistant ---
    let compassState = {
        center: null, // {x, y} - La pointe
        pencil: null, // {x, y} - Le crayon
        radius: 0,
    };
    let isDraggingCompass = false;
    let compassDragMode = null; // 'moving', 'resizing', 'rotating'
    let compassDragStart = {}; // Pour stocker les offsets de glissement

    // --- État de la règle persistante ---
    let rulerState = {
        visible: false,
        zeroX: 150, // '0' point x
        zeroY: 200, // '0' point y
        maxLengthCm: 10,
        height: 50,
        angle: 0, // in radians
    };
    let isDraggingRuler = false;
    let rulerDragMode = null; // 'moving', 'rotating'
    let rulerDragStart = {};

    // --- État du rapporteur persistant ---
    let protractorState = {
        visible: false,
        centerX: 400,
        centerY: 300,
        radius: 150,
        angle: 0, // in radians
    };
    let isDraggingProtractor = false;
    let protractorDragMode = null; // 'moving', 'rotating'
    let protractorDragStart = {};

    // --- État de l'équerre persistante ---
    let setSquareState = {
        visible: false,
        cornerX: 200,
        cornerY: 200,
        size: 300, // Longueur des côtés de l'angle droit en pixels
        angle: 0, // in radians
    };
    let isDraggingSetSquare = false;
    let setSquareDragMode = null; // 'moving', 'rotating', 'horizontal-moving'
    let setSquareDragStart = {};

    // --- État de l'enregistrement ---
    let isRecording = false;
    let isReplaying = false;
    let recording = [];
    let replayTimeoutId = null;
    let recordingStartTime = 0;

    let arcState = { startAngle: 0, endAngle: 0 };
    let currentMousePos = null; // Pour le dessin en temps réel
    let snapInfo = null; // Pour magnétiser les outils

    // --- État du déplacement de formes ---
    let isDraggingShape = false;
    let draggedShape = null;
    let dragOffset = { x: 0, y: 0 };

    // --- Helper for recording ---
    function recordEvent(type, data) {
        if (!isRecording) return;
        recording.push({
            type: type,
            data: data,
            timestamp: Date.now() - recordingStartTime
        });
    }

    // --- Fonctions de dessin ---

    /**
     * Efface et redessine tout le canvas à partir de la liste `shapes`.
     */
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid based on gridType
        if (gridType === 'cm') {
            grid.drawCmGrid(ctx, canvas.width, canvas.height, PIXELS_PER_CM);
        } else if (gridType === 'orthonormal') {
            grid.drawOrthonormalGrid(ctx, canvas.width, canvas.height, PIXELS_PER_CM);
        }

        // Dessine un surlignage pour la ligne/point magnétisé(e)
        if (snapInfo && snapInfo.snapped) {
            ctx.save();
            if (snapInfo.type === 'line') {
                const line = snapInfo.snappedShape;
                ctx.beginPath();
                ctx.moveTo(line.x1, line.y1);
                ctx.lineTo(line.x2, line.y2);
                ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)'; // Surlignage magenta
                ctx.lineWidth = 6;
                ctx.stroke();
            } else if (snapInfo.type === 'point') {
                const point = snapInfo.snappedShape;
                ctx.beginPath();
                ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI); // Cercle de surlignage
                ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            ctx.restore();
        }

        shapes.forEach(shape => {
            if (shape.type === 'point') {
                drawing.drawPoint(ctx, shape, shapes);
            } else if (shape.type === 'line') {
                drawing.drawLine(ctx, shape);
            } else if (shape.type === 'arc') {
                drawing.drawArc(ctx, shape);
            } else if (shape.type === 'text') {
                drawing.drawText(ctx, shape);
            }
        });

        // Dessine la ligne temporaire en cours de création
        if (currentTool === 'line' || currentTool === 'segment') { // Use the lineTool module for temporary drawing
            lineTool.drawTemporaryShapes({ ctx, lineState: lineToolState, currentMousePos, canvas, currentColor });
        } else if (isDrawingOnTool && lineToolState.startPoint && currentMousePos) {
            // This block handles drawing along a tool (ruler/setsquare)
            let endPos = currentMousePos;
            if (toolDrawingInfo.tool === 'ruler') {
                endPos = ruler.projectOnEdge(currentMousePos, rulerState, false); // false to extend
            } else if (toolDrawingInfo.tool === 'setsquare') {
                endPos = setsquare.projectOnEdge(currentMousePos, setSquareState, toolDrawingInfo.edge, false); // false to extend
            }

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(lineToolState.startPoint.x, lineToolState.startPoint.y);
            ctx.lineTo(endPos.x, endPos.y);
            ctx.strokeStyle = currentColor + '80'; // semi-transparent
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }

        // Dessine le compas s'il existe, et l'arc temporaire en cours de tracé
        if (compassState.center) {
            compass.drawCompass(ctx, compassState, isDraggingCompass, compassDragMode);
            if (isDraggingCompass && compassDragMode === 'rotating') {
                ctx.beginPath();
                ctx.arc(compassState.center.x, compassState.center.y, compassState.radius, arcState.startAngle, arcState.endAngle);
                ctx.strokeStyle = '#808080' + '80'; // Gris semi-transparent pour le tracé
                ctx.lineWidth = 2;
                ctx.stroke();
            }

        }

        // Dessine la règle si elle est visible, indépendamment du compas
        ruler.drawRuler(ctx, rulerState);

        // Dessine le rapporteur s'il est visible
        protractor.drawProtractor(ctx, protractorState);

        // Dessine l'équerre si elle est visible
        setsquare.drawSetSquare(ctx, setSquareState);
    }

    /**
     * Redimensionne le canvas pour remplir l'espace et redessine le contenu.
     */
    function resizeCanvas() {
        // Sauvegarde le contenu actuel pour le redessiner
        const shapesToRedraw = JSON.parse(JSON.stringify(shapes));
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        shapes = shapesToRedraw;
        redrawCanvas();
    }

    // --- Gestion de l'historique (Undo/Redo) ---

    /**
     * Met à jour l'état (activé/désactivé) des boutons d'historique.
     */
    function updateHistoryButtons() {
        undoButton.disabled = undoStack.length === 0;
        redoButton.disabled = redoStack.length === 0;
    }

    /**
     * Sauvegarde l'état actuel du canvas dans la pile d'annulation.
     * Doit être appelée AVANT chaque modification.
     */
    function saveState() {
        const state = {
            shapes: JSON.parse(JSON.stringify(shapes)),
            pointNameCounter: pointNameCounter,
            compassState: JSON.parse(JSON.stringify(compassState)),
            rulerState: JSON.parse(JSON.stringify(rulerState)),
            protractorState: JSON.parse(JSON.stringify(protractorState)),
            setSquareState: JSON.parse(JSON.stringify(setSquareState))
        };
        undoStack.push(state);
        // Dès qu'une nouvelle action est faite, l'historique "redo" n'est plus valide
        redoStack = [];
        updateHistoryButtons();
    }

    function undo() {
        if (undoStack.length > 0) {
            const currentState = {
                shapes: JSON.parse(JSON.stringify(shapes)),
                pointNameCounter: pointNameCounter,
                compassState: JSON.parse(JSON.stringify(compassState)),
                rulerState: JSON.parse(JSON.stringify(rulerState)),
                protractorState: JSON.parse(JSON.stringify(protractorState)),
                setSquareState: JSON.parse(JSON.stringify(setSquareState))
            };
            redoStack.push(currentState);

            const previousState = undoStack.pop();
            shapes = previousState.shapes;
            pointNameCounter = previousState.pointNameCounter;
            compassState = previousState.compassState;
            rulerState = previousState.rulerState;
            setSquareState = previousState.setSquareState;
            protractorState = previousState.protractorState;

            redrawCanvas();
            updateHistoryButtons();
        }
    }

    function redo() {
        if (redoStack.length > 0) {
            const currentState = {
                shapes: JSON.parse(JSON.stringify(shapes)),
                pointNameCounter: pointNameCounter,
                compassState: JSON.parse(JSON.stringify(compassState)),
                rulerState: JSON.parse(JSON.stringify(rulerState)),
                protractorState: JSON.parse(JSON.stringify(protractorState)),
                setSquareState: JSON.parse(JSON.stringify(setSquareState))
            };
            undoStack.push(currentState);

            const nextState = redoStack.pop();
            shapes = nextState.shapes;
            pointNameCounter = nextState.pointNameCounter;
            compassState = nextState.compassState; 
            rulerState = nextState.rulerState;
            setSquareState = nextState.setSquareState;
            protractorState = nextState.protractorState;

            redrawCanvas();
            updateHistoryButtons();
        }
    }

    function updateToolButtons() {
        const segmentIcon = `<svg viewBox="0 0 24 24"><circle cx="4" cy="20" r="2"/><circle cx="20" cy="4" r="2"/><line x1="5.41" y1="18.59" x2="18.59" y2="5.41" stroke="currentColor" stroke-width="2"/></svg>`;
        const lineIcon = `<svg viewBox="0 0 24 24"><path d="M21.71 3.29a1 1 0 0 0-1.42 0l-18 18a1 1 0 0 0 0 1.42 1 1 0 0 0 1.42 0l18-18a1 1 0 0 0 0-1.42z"/></svg>`;

        toolButtons.forEach(button => {
            const btnToolName = button.id.split('-')[1];
            let isActive = false;

            // Special handling for the combined line/segment tool
            if (button.id === 'tool-line') { // This is now the toggle button
                if (currentTool === 'line' || currentTool === 'segment') {
                    button.classList.add('active');
                    button.innerHTML = (lineToolState.mode === 'segment') ? segmentIcon : lineIcon;
                    button.title = (lineToolState.mode === 'segment') ? 'Segment (clic pour mode Droite)' : 'Droite (clic pour désactiver)';
                } else {
                    button.classList.remove('active');
                    button.innerHTML = segmentIcon; // Default icon when not active
                    button.title = 'Segment / Droite';
                }
                return; // Skip default active check for this button
            }

            if (btnToolName === 'ruler') {
                isActive = rulerState.visible;
            } else if (btnToolName === 'compass') {
                // Active if it's on screen OR if we are in placement mode.
                isActive = !!compassState.center || currentTool === 'compass';
            } else if (btnToolName === 'protractor') {
                isActive = protractorState.visible;
            } else if (btnToolName === 'setsquare') {
                isActive = setSquareState.visible;
            } else {
                // Active if it's the current tool.
                isActive = currentTool === btnToolName;
            }
            if (isActive) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // --- Logique des outils ---

    /**
     * Définit l'outil actif et met à jour l'apparence des boutons.
     * @param {string} toolName - Le nom de l'outil ('point', 'line').
     */
    function executeSetActiveTool(toolName) {
        // --- Handle Toggling Persistent Tools ---
        if (toolName === 'line') { // This is now the toggle button for segment/line
            if (currentTool !== 'line' && currentTool !== 'segment') { // If neither is active, activate segment mode
                currentTool = 'segment';
                lineToolState.mode = 'segment';
            } else if (currentTool === 'segment') { // If segment is active, switch to line mode
                currentTool = 'line';
                lineToolState.mode = 'line';
            } else { // If line is active, deactivate both
                currentTool = null;
                lineToolState.mode = 'segment'; // Reset to default for next activation
            }
            lineTool.resetState(lineToolState); // Reset drawing state for the tool
        } else if (toolName === 'ruler') {
            rulerState.visible = !rulerState.visible;
            rulerOptions.style.display = rulerState.visible ? 'flex' : 'none';
        } else if (toolName === 'protractor') {
            protractorState.visible = !protractorState.visible;
        } else if (toolName === 'setsquare') {
            setSquareState.visible = !setSquareState.visible;
        } else if (toolName === 'compass') {
            // If compass is on screen, remove it.
            if (compassState.center) {
                compassState.center = null;
                compassState.pencil = null;
                compassState.radius = 0;
                if (currentTool === 'compass') currentTool = null;
            } else {
                // If compass is not on screen, set it as the active tool to be placed.
                currentTool = 'compass';
            }
        } else { // For 'point', 'mark', 'text', 'move', 'eraser'
            // If we click the same tool again, deselect it. Otherwise, select it.
            currentTool = (currentTool === toolName) ? null : toolName;
        }

        // --- Stop any ongoing drag operations ---
        lineTool.resetState(lineToolState); // Ensure the line tool state is reset
        isDraggingCompass = false;
        compassDragMode = null;
        isDraggingRuler = false;
        rulerDragMode = null;
        isDraggingProtractor = false;
        protractorDragMode = null;
        isDraggingSetSquare = false;
        setSquareDragMode = null;
        isDraggingShape = false;
        draggedShape = null;

        // --- Update UI ---
        updateToolButtons();
        console.log(`Outil actif : ${currentTool}`);
        redrawCanvas();
    }

    function executeRulerLengthChange(newLength) {
        if (!isNaN(newLength) && newLength > 0) {
            rulerState.maxLengthCm = newLength;
            redrawCanvas(); // Redessine la règle avec la nouvelle longueur
        }
    }

    function updateGridButton() {
        const state = gridStates[currentGridIndex];
        gridButton.title = state.title;
    }

    function executeGridChange() {
        currentGridIndex = (currentGridIndex + 1) % gridStates.length;
        const newGridState = gridStates[currentGridIndex];
        gridType = newGridState.type;
        updateGridButton();
        redrawCanvas();
    }

    function updateColorDisplay() {
        currentColorDisplay.style.backgroundColor = currentColor;
        colorSwatches.forEach(swatch => {
            if (swatch.dataset.color === currentColor) {
                swatch.classList.add('active-color');
            } else {
                swatch.classList.remove('active-color');
            }
        });
    }

    // Ajoute les écouteurs d'événements aux boutons d'outils
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isReplaying) return;
            // Extrait le nom de l'outil depuis l'ID du bouton (ex: "tool-point" -> "point")
            const toolName = button.id.split('-')[1];
            recordEvent('tool_select', { toolName });
            executeSetActiveTool(toolName);
        });
    });

    rulerLengthInput.addEventListener('input', (e) => {
        if (isReplaying) return;
        const newLength = parseInt(e.target.value, 10);
        recordEvent('ruler_length_change', { length: newLength });
        executeRulerLengthChange(newLength);
    });

    gridButton.addEventListener('click', () => {
        if (isReplaying) return;
        recordEvent('grid_change', {});
        executeGridChange();
    });

    currentColorDisplay.addEventListener('click', (e) => {
        e.stopPropagation(); // Empêche le listener de document de se déclencher immédiatement
        colorPickerWrapper.classList.toggle('open');
    });

    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            if (isReplaying) return;
            const newColor = e.target.dataset.color;
            recordEvent('color_change', { color: newColor });
            executeColorChange(newColor);
            colorPickerWrapper.classList.remove('open'); // Ferme la palette après sélection
        });
    });

    function executeColorChange(color) {
        currentColor = color;
        updateColorDisplay();
    }

    // Ferme la palette de couleurs si on clique en dehors
    document.addEventListener('click', (e) => {
        if (!colorPickerWrapper.contains(e.target)) {
            colorPickerWrapper.classList.remove('open');
        }
    });

    // --- Gestion des événements du Canvas ---

    canvas.addEventListener('mousemove', (event) => {
        const mousePos = { x: event.offsetX, y: event.offsetY };

        if (isReplaying) return;
        recordEvent('mousemove', { pos: mousePos });
        executeMouseMove(mousePos);
    });

    function executeMouseMove(mousePos) {
        currentMousePos = mousePos; // Mettre à jour l'état global pour le dessin des lignes temporaires
        snapInfo = null; // Réinitialise à chaque mouvement

        // Si on dessine une ligne (libre ou sur un outil), on cherche à magnétiser le point final
        if (lineToolState.isDrawing && (currentTool === 'segment' || currentTool === 'line')) {
            const snapResult = snap.getSnap(mousePos, shapes);
            if (snapResult.snapped && snapResult.type === 'point') {
                snapInfo = snapResult; // Mémorise l'info pour le surlignage et le dessin
            }
        } else if (currentTool === 'line') { // This case should be covered by the above, but for safety
            // This block is now redundant due to the combined line/segment tool logic
        } else {
            snapInfo = null;
        }

        // --- Logique de changement de curseur ---
        let newCursor = 'default';
        if (isDraggingShape) {
            newCursor = 'move';
        } else if (currentTool === 'move' && shapeInteraction.findMovableShapeAt(mousePos, shapes, ctx)) {
            newCursor = 'move';
        } else if (currentTool === 'eraser' && shapeInteraction.findShapeAt(mousePos, shapes, ctx)) {
            newCursor = 'crosshair';
        } else {
            let cursorIsPencil = false;
            if (lineToolState.isDrawing && (currentTool === 'segment' || currentTool === 'line')) {
                cursorIsPencil = true;
            } else {
                const noDragActive = !isDraggingRuler && !isDraggingSetSquare && !isDraggingProtractor && !isDraggingCompass && !isDraggingShape;
                if (noDragActive) {
                    if (ruler.getRulerHit(mousePos, rulerState) === 'drawing-edge') {
                        cursorIsPencil = true;
                    } else {
                        const setSquareHit = setsquare.getSetSquareHit(mousePos, setSquareState);
                        if (setSquareHit && setSquareHit.startsWith('drawing-edge')) {
                            cursorIsPencil = true;
                        }
                    }
                }
            }
            if (cursorIsPencil) {
                newCursor = 'pencil';
            }
        }

        if (newCursor === 'pencil') {
            canvas.classList.add('pencil-cursor');
            canvas.style.cursor = ''; // Laisse la classe CSS gérer le curseur
        } else {
            canvas.classList.remove('pencil-cursor');
            canvas.style.cursor = newCursor;
        }
        // --- Fin de la logique de changement de curseur ---

        if (isDraggingShape) {
            const newX = mousePos.x - dragOffset.x;
            const newY = mousePos.y - dragOffset.y;

            // Si on déplace un point, on met à jour les lignes connectées
            if (draggedShape.type === 'point') {
                const draggedPointName = draggedShape.name;

                shapes.forEach(line => {
                    if (line.type === 'line' && line.definingPoints) {
                        const [p1_name, p2_name] = line.definingPoints;

                        if (p1_name === draggedPointName || p2_name === draggedPointName) {
                            if (line.lineType === 'segment') {
                                if (p1_name === draggedPointName) {
                                    line.x1 = newX;
                                    line.y1 = newY;
                                }
                                if (p2_name === draggedPointName) {
                                    line.x2 = newX;
                                    line.y2 = newY;
                                }
                            } else if (line.lineType === 'line') {
                                const p1 = shapes.find(p => p.type === 'point' && p.name === p1_name);
                                const p2 = shapes.find(p => p.type === 'point' && p.name === p2_name);

                                if (p1 && p2) {
                                    // Get the updated coordinates of both points
                                    const p1_coords = (p1_name === draggedPointName) ? { x: newX, y: newY } : { x: p1.x, y: p1.y };
                                    const p2_coords = (p2_name === draggedPointName) ? { x: newX, y: newY } : { x: p2.x, y: p2.y };

                                    const intersections = calculateLineCanvasIntersections(p1_coords, p2_coords, canvas.width, canvas.height);
                                    if (intersections.length === 2) {
                                        line.x1 = intersections[0].x;
                                        line.y1 = intersections[0].y;
                                        line.x2 = intersections[1].x;
                                        line.y2 = intersections[1].y;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // Met à jour la position de la forme déplacée
            draggedShape.x = newX;
            draggedShape.y = newY;
            redrawCanvas();
        } else if (isDraggingCompass) {
            snapInfo = compass.handleMouseMove(mousePos, compassState, compassDragMode, compassDragStart, arcState, shapes, snap);
            redrawCanvas();
        } else if (isDraggingRuler) {
            snapInfo = ruler.handleMouseMove(mousePos, rulerState, rulerDragMode, rulerDragStart, shapes, snap);
            redrawCanvas();
        } else if (isDraggingProtractor) {
            protractor.handleMouseMove(mousePos, protractorState, protractorDragMode, protractorDragStart);
            redrawCanvas();
        } else if (isDraggingSetSquare) {
            snapInfo = setsquare.handleMouseMove(mousePos, setSquareState, setSquareDragMode, setSquareDragStart, shapes, snap);
            redrawCanvas(); // This was the missing redraw for setsquare
        } else if (lineToolState.isDrawing) {
            redrawCanvas();
        }
    }

    canvas.addEventListener('mousedown', (event) => {
        const x = event.offsetX;
        const y = event.offsetY;
        const mousePos = { x, y };

        if (isReplaying) return;
        recordEvent('mousedown', { pos: mousePos });
        executeMouseDown(mousePos);
    });

    function executeMouseDown(mousePos) {
        // --- Priority 1: Check for interaction with persistent tools ---

        // Check for ruler interaction
        const rulerHit = ruler.getRulerHit(mousePos, rulerState);
        if (rulerHit) {
            if (rulerHit === 'drawing-edge') {
                saveState();
                isDrawingOnTool = true;
                const startPos = ruler.projectOnEdge(mousePos, rulerState);
                toolDrawingInfo = { tool: 'ruler', startPos };
                // On utilise les variables existantes pour le tracé temporaire
                lineToolState.isDrawing = true;
                lineToolState.startPoint = startPos;
            } else {
                const result = ruler.handleMouseDown(mousePos, rulerState, rulerDragStart);
                isDraggingRuler = result.isDragging;
                rulerDragMode = result.dragMode;
            }
            return; // Interaction handled.
        }

        // Check for compass interaction
        const compassHit = compass.getCompassHit(mousePos, compassState);
        if (compassHit) {
            const result = compass.handleMouseDown(mousePos, compassState, compassDragStart, arcState);
            isDraggingCompass = result.isDragging;
            compassDragMode = result.dragMode;
            return; // Interaction handled.
        }

        // Check for protractor interaction
        const protractorHit = protractor.getProtractorHit(mousePos, protractorState);
        if (protractorHit) {
            const result = protractor.handleMouseDown(mousePos, protractorState, protractorDragStart);
            isDraggingProtractor = result.isDragging;
            protractorDragMode = result.dragMode;
            return; // Interaction handled.
        }

        // Check for set square interaction
        const setSquareHit = setsquare.getSetSquareHit(mousePos, setSquareState);
        if (setSquareHit) {
            if (setSquareHit.startsWith('drawing-edge')) {
                saveState();
                isDrawingOnTool = true;
                const edgeType = setSquareHit.split('-')[2];
                const startPos = setsquare.projectOnEdge(mousePos, setSquareState, edgeType);
                toolDrawingInfo = { tool: 'setsquare', startPos, edge: edgeType };
                // On utilise les variables existantes pour le tracé temporaire
                lineToolState.isDrawing = true;
                lineToolState.startPoint = startPos;
            } else {
                // If we are about to interact with the set square, check its current snap status
                const currentSnapInfo = snap.getSnap({ x: setSquareState.cornerX, y: setSquareState.cornerY }, shapes);
                const result = setsquare.handleMouseDown(mousePos, setSquareState, setSquareDragStart, currentSnapInfo);
                isDraggingSetSquare = result.isDragging;
                setSquareDragMode = result.dragMode;
            }
            return; // Interaction handled.
        }

        // --- Priority 2: Perform action of the currently selected tool ---
        switch (currentTool) {
            case 'point':
                saveState();
                pointNameCounter++;
                const name = utils.getPointName(pointNameCounter);
                shapes.push({ type: 'point', x: mousePos.x, y: mousePos.y, name, color: currentColor });
                redrawCanvas();
                break;
            case 'text':
                const textContent = prompt("Entrez votre texte :");
                if (textContent) { // N'ajoute rien si l'utilisateur annule
                    saveState();
                    shapes.push({ type: 'text', x: mousePos.x, y: mousePos.y, content: textContent, color: currentColor });
                    redrawCanvas();
                }
                break;
            case 'move':
                const shapeToDrag = shapeInteraction.findMovableShapeAt(mousePos, shapes, ctx);
                if (shapeToDrag) {
                    saveState(); // Sauvegarde l'état avant de commencer le déplacement
                    isDraggingShape = true;
                    draggedShape = shapeToDrag;
                    dragOffset.x = mousePos.x - draggedShape.x;
                    dragOffset.y = mousePos.y - draggedShape.y;
                }
                break;
            case 'eraser':
                const shapeToDelete = shapeInteraction.findShapeAt(mousePos, shapes, ctx);
                if (shapeToDelete) {
                    saveState();

                    if (shapeToDelete.type === 'point') {
                        const pointX = shapeToDelete.x;
                        const pointY = shapeToDelete.y;
                        // Filter out the point and any connected lines
                        shapes = shapes.filter(s => {
                            if (s === shapeToDelete) return false; // Remove the point itself
                            if (s.type === 'line') {
                                const isConnected = (Math.hypot(s.x1 - pointX, s.y1 - pointY) < 1) ||
                                    (Math.hypot(s.x2 - pointX, s.y2 - pointY) < 1);
                                return !isConnected; // Keep the line if it's NOT connected
                            }
                            return true; // Keep other shapes
                        });
                    } else {
                        // For lines, text, etc., just remove the single shape
                        const index = shapes.indexOf(shapeToDelete);
                        if (index > -1) {
                            shapes.splice(index, 1);
                        }
                    }
                    redrawCanvas();
                }
                break;
            case 'line':
            case 'segment': // Both segment and line modes are handled by the lineTool module
                const newShape = lineTool.handleMouseDown({
                    mousePos, lineState: lineToolState, shapes, snap, canvas, currentColor,
                    getPointName: () => utils.getPointName(pointNameCounter + 1), // Pass helper for point naming
                    incrementPointCounter: () => pointNameCounter++ // Pass helper for counter increment
                });
                if (newShape) {
                    saveState();
                    shapes.push(newShape);
                }
                snapInfo = null; // Clear snap info after action
                redrawCanvas();
                break;
            case 'mark':
                const snapResult = snap.getSnap(mousePos, shapes);

                if (!snapResult.snapped) return;

                // Priorité au codage d'angle sur un point
                if (snapResult.type === 'point') {
                    const point = snapResult.snappedShape;
                    const connectedLines = shapes.filter(s =>
                        s.type === 'line' &&
                        (
                            (Math.hypot(s.x1 - point.x, s.y1 - point.y) < 1) ||
                            (Math.hypot(s.x2 - point.x, s.y2 - point.y) < 1)
                        )
                    );

                    if (connectedLines.length === 2) {
                        saveState();
                        if (!point.angleMark) {
                            point.angleMark = { type: 'single' };
                        } else {
                            switch (point.angleMark.type) {
                                case 'single': point.angleMark.type = 'double'; break;
                                case 'double': point.angleMark.type = 'right'; break;
                                case 'right': point.angleMark = null; break; // cycle
                            }
                        }
                        redrawCanvas();
                        return; // Action de codage d'angle effectuée
                    }
                }

                // Si ce n'est pas un angle, ou si le snap est sur une ligne, on code la ligne
                const lineSnapResult = snap.getSnap(mousePos, shapes.filter(s => s.type === 'line'));
                if (lineSnapResult.snapped) {
                    const lineToMark = lineSnapResult.snappedShape;
                    saveState();
                    // Fait cycler le codage de 0 (aucun) à 3 (|||)
                    lineToMark.marking = ((lineToMark.marking || 0) + 1) % 4;
                    redrawCanvas();
                }
                break;
            case 'compass':
                // This is ONLY for placing the compass.
                const result = compass.handleMouseDown(mousePos, compassState, compassDragStart, arcState);
                isDraggingCompass = result.isDragging;
                compassDragMode = result.dragMode;
                // After starting to place, we are no longer in "placement mode".
                currentTool = null;
                updateToolButtons();
                break;
        }
    }

    canvas.addEventListener('mouseup', (event) => {
        if (isReplaying) return;
        const mousePos = { x: event.offsetX, y: event.offsetY };
        recordEvent('mouseup', { pos: mousePos });
        executeMouseUp(mousePos);
    });

    function executeMouseUp(mousePos) {
        let needsRedraw = false;

        if (isDrawingOnTool) {
            let endPos = mousePos;
            if (toolDrawingInfo.tool === 'ruler') {
                endPos = ruler.projectOnEdge(mousePos, rulerState, false); // false pour prolonger
            } else if (toolDrawingInfo.tool === 'setsquare') {
                endPos = setsquare.projectOnEdge(mousePos, setSquareState, toolDrawingInfo.edge, false); // false pour prolonger
            }

            // Ne dessine pas une ligne de longueur nulle
            if (Math.hypot(endPos.x - toolDrawingInfo.startPos.x, endPos.y - toolDrawingInfo.startPos.y) > 2) {
                shapes.push({ type: 'line', x1: toolDrawingInfo.startPos.x, y1: toolDrawingInfo.startPos.y, x2: endPos.x, y2: endPos.y, color: currentColor });
            }

            isDrawingOnTool = false;
            toolDrawingInfo = null;
            lineTool.resetState(lineToolState); // Reset line tool state
            // isDrawingSegment and segmentStartPoint are now managed by lineToolState
            needsRedraw = true;
        }

        if (isDraggingCompass) {
            compass.handleMouseUp(compassDragMode, arcState, compassState, shapes, saveState);
            isDraggingCompass = false;
            compassDragMode = null;
            needsRedraw = true;
        }
        if (isDraggingRuler) {
            isDraggingRuler = false;
            rulerDragMode = null;
            needsRedraw = true;
        }
        if (isDraggingProtractor) {
            isDraggingProtractor = false;
            protractorDragMode = null;
            needsRedraw = true;
        }
        if (isDraggingSetSquare) {
            isDraggingSetSquare = false;
            setSquareDragMode = null;
            needsRedraw = true;
        }
        if (isDraggingShape) {
            isDraggingShape = false;
            draggedShape = null;
            needsRedraw = true;
        }

        if (snapInfo) {
            snapInfo = null;
            needsRedraw = true;
        }

        if (needsRedraw) redrawCanvas();
    }

    // --- Logique de Sauvegarde / Chargement / Effacement ---

    clearButton.addEventListener('click', () => {
        if (confirm("Voulez-vous vraiment tout effacer ?")) {
            // Ne sauvegarde que s'il y a quelque chose à effacer
            if (shapes.length > 0) {
                saveState();
            }
            shapes = [];
            pointNameCounter = 0; // Réinitialise le compteur de noms
            lineTool.resetState(lineToolState); // Reset line tool state
            compassState = { center: null, radius: 0, pencil: null }; // Efface aussi le compas
            rulerState.visible = false; // Cache la règle
            protractorState.visible = false; // Cache le rapporteur
            setSquareState.visible = false; // Cache l'équerre
            redrawCanvas(); // redrawCanvas est appelé dans saveState via undo/redo
        }
    });

    saveButton.addEventListener('click', () => {
        let filename = prompt("Nommez votre session de géométrie :", "session_geometrie");
        if (!filename) {
            return; // L'utilisateur a annulé
        }
        if (!filename.toLowerCase().endsWith('.json')) {
            filename += '.json';
        }
        // Convertit notre liste d'objets en une chaîne de caractères JSON
        const sessionData = {
            currentState: {
                shapes: shapes,
                pointNameCounter: pointNameCounter,
                compassState: compassState,
                rulerState: rulerState,
                protractorState: protractorState,
                setSquareState: setSquareState
            },
            history: undoStack
        };
        const data = JSON.stringify(sessionData, null, 2);
        // Crée un objet "Blob" qui représente les données
        const blob = new Blob([data], { type: 'application/json' });
        // Crée une URL temporaire pour le Blob
        const url = URL.createObjectURL(blob);

        // Crée un lien de téléchargement invisible et le clique
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        // Libère l'URL temporaire
        URL.revokeObjectURL(url);
    });

    loadButton.addEventListener('click', () => {
        // Déclenche le clic sur l'input de fichier caché
        fileLoader.click();
    });

    fileLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const sessionData = JSON.parse(e.target.result);
                // Valider que les données sont bien un objet avec les bonnes clés (nouveau format)
                if (sessionData && sessionData.currentState && Array.isArray(sessionData.history)) {
                    saveState(); // Sauvegarde l'état actuel pour pouvoir annuler le chargement

                    shapes = sessionData.currentState.shapes;
                    pointNameCounter = sessionData.currentState.pointNameCounter;
                    // Restore tool states, providing defaults if they don't exist in the save file
                    compassState = sessionData.currentState.compassState || { center: null, pencil: null, radius: 0 };
                    rulerState = sessionData.currentState.rulerState || { visible: false, zeroX: 150, zeroY: 200, maxLengthCm: 10, height: 50, angle: 0 };
                    protractorState = sessionData.currentState.protractorState || { visible: false, centerX: 400, centerY: 300, radius: 150, angle: 0 };
                    setSquareState = sessionData.currentState.setSquareState || { visible: false, cornerX: 200, cornerY: 200, size: 300, angle: 0 };
                    undoStack = sessionData.history;
                    redoStack = []; // On vide la pile "redo" lors d'un chargement

                    updateHistoryButtons();
                    redrawCanvas();
                } else {
                    // Tente de charger l'ancien format pour la compatibilité (un simple tableau de formes)
                    const loadedShapes = JSON.parse(e.target.result);
                    if (Array.isArray(loadedShapes)) {
                        saveState();
                        shapes = loadedShapes;
                        // Recalcule le compteur de points
                        const pointNames = shapes.filter(s => s.type === 'point' && s.name).map(p => p.name);
                        if (pointNames.length > 0) {
                        pointNameCounter = Math.max(0, ...pointNames.map(utils.getPointNumber));
                        } else {
                            pointNameCounter = 0;
                        }
                        undoStack = []; // Pas d'historique dans l'ancien format
                        redoStack = [];
                        // Reset tool states completely for old format
                        compassState = { center: null, pencil: null, radius: 0 };
                        rulerState = { visible: false, zeroX: 150, zeroY: 200, maxLengthCm: 10, height: 50, angle: 0 };
                        protractorState = { visible: false, centerX: 400, centerY: 300, radius: 150, angle: 0 };
                        setSquareState = { visible: false, cornerX: 200, cornerY: 200, size: 300, angle: 0 };
                        updateHistoryButtons();
                        redrawCanvas();
                        alert("Fichier d'un ancien format chargé. L'historique de construction n'est pas disponible.");
                    } else {
                        alert("Le fichier n'est pas valide.");
                    }
                }
            } catch (error) {
                alert("Erreur lors de la lecture du fichier. Assurez-vous que c'est un fichier JSON valide.");
                console.error(error);
            }
        };
        reader.readAsText(file);
        
        // Réinitialise l'input pour pouvoir recharger le même fichier
        event.target.value = '';
    });

    saveRecordingButton.addEventListener('click', () => {
        if (recording.length === 0) return;

        let filename = prompt("Nommez votre film :", "film_construction");
        if (!filename) return;
        if (!filename.toLowerCase().endsWith('.json')) {
            filename += '.json';
        }

        const data = JSON.stringify(recording, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });

    loadRecordingButton.addEventListener('click', () => {
        recordingLoader.click();
    });

    recordingLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedRecording = JSON.parse(e.target.result);
                if (Array.isArray(loadedRecording)) { // Basic validation
                    recording = loadedRecording;
                    playButton.disabled = false;
                    saveRecordingButton.disabled = false;
                    alert(`Film "${file.name}" chargé. Prêt à être relu.`);
                } else {
                    alert("Le fichier de film n'est pas valide.");
                }
            } catch (error) {
                alert("Erreur lors de la lecture du fichier de film.");
                console.error(error);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset to allow reloading same file
    });

    // --- Logique d'enregistrement et de relecture ---

    recordButton.addEventListener('click', () => {
        isRecording = !isRecording;
        if (isRecording) {
            // Start recording
            recording = [];
            recordingStartTime = Date.now();
            recordButton.textContent = '⏹️ Arrêter';
            recordButton.classList.add('recording');
            playButton.disabled = true; // Disable play while recording
            saveRecordingButton.disabled = true;
        } else {
            // Stop recording
            recordButton.textContent = '⏺️ Enregistrer';
            recordButton.classList.remove('recording');
            if (recording.length > 0) {
                playButton.disabled = false;
                saveRecordingButton.disabled = false;
            }
        }
    });

    playButton.addEventListener('click', () => {
        if (isReplaying) {
            stopReplay();
        } else if (recording.length > 0 && !isRecording) {
            startReplay();
        }
    });

    function startReplay() {
        isReplaying = true;
        // Disable UI, but keep play/stop button active
        document.querySelectorAll('#toolbar button, #toolbar input').forEach(el => {
            if (el.id !== 'btn-play' && el.id !== 'replay-loop') {
                el.disabled = true;
            }
        });
        playButton.textContent = '⏹️ Arrêter';
        playButton.disabled = false;

        // Reset state for replay
        shapes = [];
        pointNameCounter = 0;
        compassState = { center: null, pencil: null, radius: 0, };
        rulerState = {
            visible: false,
            zeroX: 150,
            zeroY: 200,
            maxLengthCm: 10,
            height: 50,
            angle: 0,
        };
        protractorState = {
            visible: false,
            centerX: 400,
            centerY: 300,
            radius: 150,
            angle: 0,
        };
        setSquareState = {
            visible: false,
            cornerX: 200,
            cornerY: 200,
            size: 300,
            angle: 0,
        };
        rulerLengthInput.value = 10; // Reset ruler length input

        currentTool = null;
        lineTool.resetState(lineToolState); // Reset line tool state
        // isDrawingSegment, segmentStartPoint, lineStartPoint are now managed by lineToolState

        // Reset all dragging states to ensure a clean start
        isDraggingCompass = false;
        compassDragMode = null;
        compassDragStart = {};
        isDraggingRuler = false;
        rulerDragMode = null;
        rulerDragStart = {};
        isDraggingProtractor = false;
        protractorDragMode = null;
        protractorDragStart = {};
        isDraggingSetSquare = false;
        setSquareDragMode = null;
        setSquareDragStart = {};

        updateToolButtons();
        redrawCanvas();

        replayNextEvent(0);
    }

    function stopReplay() {
        if (replayTimeoutId) {
            clearTimeout(replayTimeoutId);
            replayTimeoutId = null;
        }
        if (!isReplaying) return;
        isReplaying = false;
        // Re-enable UI
        document.querySelectorAll('#toolbar button, #toolbar input').forEach(el => el.disabled = false);
        playButton.textContent = '▶️ Relire';
        playButton.disabled = (recording.length === 0);
        saveRecordingButton.disabled = (recording.length === 0);
        // Also re-check record button state
        recordButton.disabled = false;
        console.log("Replay stopped.");
    }

    function replayNextEvent(index) {
        if (index >= recording.length) {
            if (isReplaying && replayLoopCheckbox.checked) {
                // Loop by starting over
                console.log("Replay loop.");
                startReplay();
            } else {
                // Replay finished
                console.log("Replay finished.");
                stopReplay();
            }
            return;
        }

        const event = recording[index];
        const nextEvent = recording[index + 1];
        const delay = nextEvent ? (nextEvent.timestamp - event.timestamp) : 0;

        // Simulate the event
        switch (event.type) {
            case 'tool_select':         executeSetActiveTool(event.data.toolName); break;
            case 'mousedown':           executeMouseDown(event.data.pos); break;
            case 'mousemove':           executeMouseMove(event.data.pos); break;
            case 'mouseup':             executeMouseUp(event.data.pos); break;
            case 'color_change':        executeColorChange(event.data.color); break;
            case 'grid_change':         executeGridChange(); break;
            case 'ruler_length_change': executeRulerLengthChange(event.data.length); break;
        }

        replayTimeoutId = setTimeout(() => {
            replayNextEvent(index + 1);
        }, delay);
    }

    // Bonus : Raccourcis clavier
    document.addEventListener('keydown', (e) => {
        // Utilise ctrlKey sur Windows/Linux et metaKey (Cmd) sur Mac
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault(); // Empêche l'action par défaut du navigateur
                undo();
            } else if (e.key === 'y') {
                e.preventDefault(); // Empêche l'action par défaut du navigateur
                redo();
            }
        }
    });

    // --- Initialisation de la page ---

    // --- Écouteurs d'événements pour l'historique ---
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);

    // État initial des boutons au chargement de la page
    updateHistoryButtons();
    // Redimensionne le canvas une première fois
    resizeCanvas();
    updateColorDisplay(); // Initialise l'affichage de la couleur active
    updateGridButton();
    // Ajoute un écouteur pour redimensionner quand la fenêtre change de taille
    window.addEventListener('resize', resizeCanvas);
});
