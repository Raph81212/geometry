// snap.js

const SNAP_THRESHOLD = 20; // pixels

/**
 * Calculates the distance from a point (p) to a line segment defined by l1 and l2.
 * This is used to find which line is "closest" to the cursor.
 * @param {{x: number, y: number}} p The point.
 * @param {{x: number, y: number}} l1 The start of the line segment.
 * @param {{x: number, y: number}} l2 The end of the line segment.
 * @returns {number} The perpendicular distance to the line segment.
 */
function pointToLineSegmentDistance(p, l1, l2) {
    const dx = l2.x - l1.x;
    const dy = l2.y - l1.y;
    const lineLengthSq = dx * dx + dy * dy;

    if (lineLengthSq === 0) {
        return Math.hypot(p.x - l1.x, p.y - l1.y);
    }

    // t is the projection of p onto the line, as a factor of the segment length
    let t = ((p.x - l1.x) * dx + (p.y - l1.y) * dy) / lineLengthSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to the segment

    const projectionX = l1.x + t * dx;
    const projectionY = l1.y + t * dy;

    return Math.hypot(p.x - projectionX, p.y - projectionY);
}

/**
 * Finds the closest point from a list of shapes to a given position.
 * @param {{x: number, y: number}} position - The position {x, y} to check from.
 * @param {Array} shapes - The list of all shapes on the canvas.
 * @returns {object|null} The closest point shape or null.
 */
function findClosestPoint(position, shapes) {
    let closestPoint = null;
    let minDistance = Infinity;

    const points = shapes.filter(s => s.type === 'point');

    for (const point of points) {
        const distance = Math.hypot(position.x - point.x, position.y - point.y);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
        }
    }

    if (minDistance < SNAP_THRESHOLD) {
        return closestPoint;
    }

    return null;
}

/**
 * Finds the closest line from a list of shapes to a given point.
 * @param {{x: number, y: number}} point - The point {x, y} to check from.
 * @param {Array} shapes - The list of all shapes on the canvas.
 * @returns {object|null} The closest line shape or null.
 */
function findClosestLine(point, shapes) {
    let closestLine = null;
    let minDistance = Infinity;

    const lines = shapes.filter(s => s.type === 'line');

    for (const line of lines) {
        const l1 = { x: line.x1, y: line.y1 };
        const l2 = { x: line.x2, y: line.y2 };
        const distance = pointToLineSegmentDistance(point, l1, l2);

        if (distance < minDistance) {
            minDistance = distance;
            closestLine = line;
        }
    }

    if (minDistance < SNAP_THRESHOLD) {
        return closestLine;
    }

    return null;
}

/**
 * Attempts to snap a tool's state to the lines or points on the canvas.
 * @param {{x: number, y: number}} toolPosition - The potential reference point of the tool {x, y}.
 * @param {Array} shapes - All shapes on the canvas.
 * @returns {{snapped: boolean, type?: 'line'|'point', angle?: number, position?: {x, y}, snappedShape?: object}}
 */
export function getSnap(toolPosition, shapes) {
    // Priorité : Magnétiser sur les points d'abord
    const closestPoint = findClosestPoint(toolPosition, shapes);
    if (closestPoint) {
        return {
            snapped: true,
            type: 'point',
            position: { x: closestPoint.x, y: closestPoint.y },
            snappedShape: closestPoint
        };
    }

    // Ensuite, magnétiser sur les lignes
    const closestLine = findClosestLine(toolPosition, shapes);

    if (closestLine) {
        const lineAngle = Math.atan2(closestLine.y2 - closestLine.y1, closestLine.x2 - closestLine.x1);

        // Détermine de quel côté de la ligne se trouve le curseur de l'outil
        // (x2 - x1)(py - y1) - (y2 - y1)(px - x1)
        const side = (closestLine.x2 - closestLine.x1) * (toolPosition.y - closestLine.y1) - (closestLine.y2 - closestLine.y1) * (toolPosition.x - closestLine.x1);

        // Project the tool's position onto the *infinite* line defined by the segment
        const l1 = { x: closestLine.x1, y: closestLine.y1 };
        const dx = closestLine.x2 - closestLine.x1;
        const dy = closestLine.y2 - closestLine.y1;
        const lineLengthSq = dx * dx + dy * dy;

        if (lineLengthSq === 0) return { snapped: false };

        const t = ((toolPosition.x - l1.x) * dx + (toolPosition.y - l1.y) * dy) / lineLengthSq;
        
        const snappedPosition = { x: l1.x + t * dx, y: l1.y + t * dy };

        return {
            snapped: true,
            type: 'line',
            angle: lineAngle,
            position: snappedPosition,
            snappedShape: closestLine,
            side: Math.sign(side)
        };
    }

    return { snapped: false };
}