// line-utils.js

/**
 * Calcule les deux points d'intersection d'une droite (définie par p1 et p2) avec les bords du canvas.
 * @param {{x: number, y: number}} p1 Premier point définissant la droite.
 * @param {{x: number, y: number}} p2 Second point définissant la droite.
 * @param {number} w Largeur du canvas.
 * @param {number} h Hauteur du canvas.
 * @returns {Array<{x: number, y: number}>} Un tableau contenant 0 ou 2 points d'intersection.
 */
export function calculateLineCanvasIntersections(p1, p2, w, h) {
    const intersections = [];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
        return [];
    }

    if (Math.abs(dx) < 0.001) { // Ligne verticale
        if (p1.x >= 0 && p1.x <= w) return [{ x: p1.x, y: 0 }, { x: p1.x, y: h }];
        return [];
    }
    if (Math.abs(dy) < 0.001) { // Ligne horizontale
        if (p1.y >= 0 && p1.y <= h) return [{ x: 0, y: p1.y }, { x: w, y: p1.y }];
        return [];
    }

    const m = dy / dx;
    const c = p1.y - m * p1.x;

    // Intersection avec y = 0 (haut)
    let x = -c / m;
    if (x >= 0 && x <= w) intersections.push({ x, y: 0 });

    // Intersection avec y = h (bas)
    x = (h - c) / m;
    if (x >= 0 && x <= w) intersections.push({ x, y: h });

    // Intersection avec x = 0 (gauche)
    let y = c;
    if (y >= 0 && y <= h) intersections.push({ x: 0, y });

    // Intersection avec x = w (droite)
    y = m * w + c;
    if (y >= 0 && y <= h) intersections.push({ x: w, y });

    // Supprimer les doublons (qui apparaissent aux coins)
    const uniquePoints = intersections.filter((p, index, self) =>
        index === self.findIndex((t) => (
            Math.abs(t.x - p.x) < 0.001 && Math.abs(t.y - p.y) < 0.001
        ))
    );

    if (uniquePoints.length < 2) {
        return [];
    }

    // Si on a plus de 2 points, il faut trouver les 2 qui sont les plus éloignés.
    // Ce seront les véritables points d'entrée et de sortie de la droite sur le canvas.
    let maxDistSq = 0;
    let endPoints = [];
    for (let i = 0; i < uniquePoints.length; i++) {
        for (let j = i + 1; j < uniquePoints.length; j++) {
            const distSq = (uniquePoints[i].x - uniquePoints[j].x)**2 + (uniquePoints[i].y - uniquePoints[j].y)**2;
            if (distSq > maxDistSq) {
                maxDistSq = distSq;
                endPoints = [uniquePoints[i], uniquePoints[j]];
            }
        }
    }
    return endPoints;
}