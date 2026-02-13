// utils.js

/**
 * Convertit un nombre en une séquence de lettres majuscules (1->A, 2->B, 27->AA).
 * @param {number} n - Le numéro du point.
 * @returns {string} Le nom du point.
 */
export function getPointName(n) {
    if (n <= 0) return '';
    // Le nombre de primes (A', A'', etc.)
    const primeCount = Math.floor((n - 1) / 26);
    // L'index de la lettre (0 pour A, 25 pour Z)
    const letterIndex = (n - 1) % 26;
    const letter = String.fromCharCode(65 + letterIndex);
    const primes = "'".repeat(primeCount);
    return letter + primes;
}

/**
 * Convertit un nom de point (ex: 'A', 'B', 'AA') en son numéro séquentiel.
 * @param {string} name - Le nom du point.
 * @returns {number} Le numéro du point.
 */
export function getPointNumber(name) {
    if (!name || name.length === 0) return 0;
    const letter = name.charAt(0);
    const primeCount = name.length - 1;
    const letterValue = letter.charCodeAt(0) - 65; // A=0, B=1...
    return primeCount * 26 + letterValue + 1;
}

/**
 * Calculates the distance from a point (p) to a line segment defined by l1 and l2.
 * @param {{x: number, y: number}} p The point.
 * @param {{x: number, y: number}} l1 The start of the line segment.
 * @param {{x: number, y: number}} l2 The end of the line segment.
 * @returns {number} The perpendicular distance to the line segment.
 */
export function pointToLineSegmentDistance(p, l1, l2) {
    const dx = l2.x - l1.x;
    const dy = l2.y - l1.y;
    const lineLengthSq = dx * dx + dy * dy;

    if (lineLengthSq === 0) {
        return Math.hypot(p.x - l1.x, p.y - l1.y);
    }

    let t = ((p.x - l1.x) * dx + (p.y - l1.y) * dy) / lineLengthSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to the segment

    const projectionX = l1.x + t * dx;
    const projectionY = l1.y + t * dy;

    return Math.hypot(p.x - projectionX, p.y - projectionY);
}
/**
 * Projects a point onto an infinite line defined by two points.
 * @param {{x: number, y: number}} p The point to project.
 * @param {{x: number, y: number}} a The first point on the line.
 * @param {{x: number, y: number}} b The second point on the line.
 * @returns {{pos: {x: number, y: number}, t: number}} The projected point and its parametric value `t`.
 */
export function projectPointOnLine(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lineLengthSq = dx * dx + dy * dy;

    if (lineLengthSq === 0) return { pos: a, t: 0 };

    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lineLengthSq;

    return {
        pos: {
            x: a.x + t * dx,
            y: a.y + t * dy
        },
        t: t
    };
}

/**
 * Projects a point onto a line segment.
 * @param {{x: number, y: number}} p The point to project.
 * @param {{x: number, y: number}} a The start of the line segment.
 * @param {{x: number, y: number}} b The end of the line segment.
 * @returns {{x: number, y: number}} The projected point on the segment.
 */
export function projectPointOnSegment(p, a, b) {
    const projection = projectPointOnLine(p, a, b);
    // For a segment, we clamp the position to be between a and b.
    const t = Math.max(0, Math.min(1, projection.t));

    return {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y)
    };
}