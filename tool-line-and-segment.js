// tool-line-and-segment.js
import { calculateLineCanvasIntersections } from './line-utils.js';
import * as snap from './snap.js'; // Need snap for point snapping

/**
 * Gère les clics de souris pour les outils Segment et Droite.
 * @param {object} params - Paramètres nécessaires.
 * @param {{x: number, y: number}} params.mousePos - Position actuelle de la souris.
 * @param {object} params.lineState - État de l'outil ligne/segment.
 * @param {Array} params.shapes - Toutes les formes sur le canvas.
 * @param {object} params.snap - Module de magnétisation.
 * @param {HTMLCanvasElement} params.canvas - L'élément canvas.
 * @param {string} params.currentColor - Couleur de dessin actuelle.
 * @param {function} params.getPointName - Fonction pour générer les noms de points.
 * @param {function} params.incrementPointCounter - Fonction pour incrémenter le compteur de points.
 * @returns {object|null} Une nouvelle forme de ligne si elle est complétée, sinon null.
 */
export function handleMouseDown({ mousePos, lineState, shapes, snap, canvas, currentColor, getPointName, incrementPointCounter }) {
    let newShape = null;
    let clickedPoint = null;

    // Try to snap to an existing point
    const snapResult = snap.getSnap(mousePos, shapes);
    if (snapResult.snapped && snapResult.type === 'point') {
        clickedPoint = snapResult.snappedShape;
    }

    if (lineState.mode === 'segment') {
        if (!lineState.isDrawing) {
            // Premier clic pour segment: define start point
            lineState.isDrawing = true;
            if (clickedPoint) {
                lineState.startPoint = { x: clickedPoint.x, y: clickedPoint.y };
            } else {
                // Create a new point if not snapped
                incrementPointCounter();
                const name = getPointName(); // getPointName will use the incremented counter
                const newPoint = { type: 'point', x: mousePos.x, y: mousePos.y, name, color: currentColor };
                shapes.push(newPoint); // Add the new point to shapes
                lineState.startPoint = { x: newPoint.x, y: newPoint.y };
            }
        } else {
            // Second click for segment: define end point and create segment
            let endPos = { x: mousePos.x, y: mousePos.y };
            if (clickedPoint) {
                endPos = { x: clickedPoint.x, y: clickedPoint.y };
            } else {
                // Create a new point if not snapped
                incrementPointCounter();
                const name = getPointName();
                const newPoint = { type: 'point', x: mousePos.x, y: mousePos.y, name, color: currentColor };
                shapes.push(newPoint); // Add the new point to shapes
                endPos = { x: newPoint.x, y: newPoint.y };
            }
            newShape = { type: 'line', x1: lineState.startPoint.x, y1: lineState.startPoint.y, x2: endPos.x, y2: endPos.y, color: currentColor };
            resetState(lineState);
        }
    } else { // mode === 'line'
        if (!lineState.startPoint) {
            // First click for line: define first point
            lineState.isDrawing = true;
            if (clickedPoint) {
                lineState.startPoint = { x: clickedPoint.x, y: clickedPoint.y };
            } else {
                // Create a new point if not snapped
                incrementPointCounter();
                const name = getPointName();
                const newPoint = { type: 'point', x: mousePos.x, y: mousePos.y, name, color: currentColor };
                shapes.push(newPoint); // Add the new point to shapes
                lineState.startPoint = { x: newPoint.x, y: newPoint.y };
            }
        } else {
            // Second click for line: define second point and create line
            let p2 = { x: mousePos.x, y: mousePos.y };
            if (clickedPoint) {
                p2 = { x: clickedPoint.x, y: clickedPoint.y };
            } else {
                // Create a new point if not snapped
                incrementPointCounter();
                const name = getPointName();
                const newPoint = { type: 'point', x: mousePos.x, y: mousePos.y, name, color: currentColor };
                shapes.push(newPoint); // Add the new point to shapes
                p2 = { x: newPoint.x, y: newPoint.y };
            }

            // Ensure points are distinct before drawing a line
            if (Math.hypot(p2.x - lineState.startPoint.x, p2.y - lineState.startPoint.y) > 1) {
                const intersections = calculateLineCanvasIntersections(lineState.startPoint, p2, canvas.width, canvas.height);
                if (intersections.length === 2) {
                    newShape = { type: 'line', x1: intersections[0].x, y1: intersections[0].y, x2: intersections[1].x, y2: intersections[1].y, color: currentColor };
                }
            }
            resetState(lineState);
        }
    }
    return newShape;
}

/**
 * Dessine les formes temporaires (segment ou droite en pointillés) pendant leur création.
 */
export function drawTemporaryShapes({ ctx, lineState, currentMousePos, canvas, currentColor }) {
    if (!currentMousePos || !lineState.startPoint) return;

    ctx.save();
    ctx.strokeStyle = currentColor + '80'; // Ajoute 50% d'opacité
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    if (lineState.mode === 'segment' && lineState.isDrawing) {
        ctx.beginPath();
        ctx.moveTo(lineState.startPoint.x, lineState.startPoint.y);
        ctx.lineTo(currentMousePos.x, currentMousePos.y);
        ctx.stroke();
    } else if (lineState.mode === 'line') {
        const intersections = calculateLineCanvasIntersections(lineState.startPoint, currentMousePos, canvas.width, canvas.height);
        if (intersections.length === 2) {
            ctx.beginPath();
            ctx.moveTo(intersections[0].x, intersections[0].y);
            ctx.lineTo(intersections[1].x, intersections[1].y);
            ctx.stroke();
        }
    }

    ctx.restore();
}

/** 
 * Réinitialise l'état de l'outil ligne/segment.
 */
export function resetState(lineState) {
    lineState.isDrawing = false;
    lineState.startPoint = null;
}