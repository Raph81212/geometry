// shape-interaction.js
import { pointToLineSegmentDistance } from './utils.js';

/**
 * Trouve une forme déplaçable (point, texte) à une position donnée.
 * @param {{x: number, y: number}} pos - La position du curseur.
 * @param {Array} shapes - La liste des formes.
 * @param {CanvasRenderingContext2D} ctx - Le contexte du canvas pour mesurer le texte.
 * @returns {object|null} La forme trouvée ou null.
 */
export function findMovableShapeAt(pos, shapes, ctx) {
    // Itère en sens inverse pour sélectionner la forme la plus en surface
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'point') {
            const dist = Math.hypot(pos.x - shape.x, pos.y - shape.y);
            if (dist < 10) { // Rayon de détection de 10px pour les points
                return shape;
            }
        } else if (shape.type === 'text') {
            const textMetrics = ctx.measureText(shape.content);
            const textWidth = textMetrics.width;
            const textHeight = 16; // Basé sur la taille de police '16px'
            if (pos.x >= shape.x && pos.x <= shape.x + textWidth && pos.y >= shape.y && pos.y <= shape.y + textHeight) {
                return shape;
            }
        }
    }
    return null;
}

/**
 * Trouve une forme (point, texte, ligne) à une position donnée.
 * @param {{x: number, y: number}} pos - La position du curseur.
 * @param {Array} shapes - La liste des formes.
 * @param {CanvasRenderingContext2D} ctx - Le contexte du canvas pour mesurer le texte.
 * @returns {object|null} La forme trouvée ou null.
 */
export function findShapeAt(pos, shapes, ctx) {
    // Itère en sens inverse pour sélectionner la forme la plus en surface
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'point') {
            const dist = Math.hypot(pos.x - shape.x, pos.y - shape.y);
            if (dist < 10) { // Rayon de détection de 10px
                return shape;
            }
        } else if (shape.type === 'text') {
            const textMetrics = ctx.measureText(shape.content);
            const textWidth = textMetrics.width;
            const textHeight = 16; // Basé sur la taille de police '16px'
            if (pos.x >= shape.x && pos.x <= shape.x + textWidth && pos.y >= shape.y && pos.y <= shape.y + textHeight) {
                return shape;
            }
        } else if (shape.type === 'line') {
            const dist = pointToLineSegmentDistance(pos, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
            if (dist < 10) { // Tolérance de 10px pour cliquer sur une ligne
                return shape;
            }
        }
    }
    return null;
}