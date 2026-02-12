// tool-ruler.js

const PIXELS_PER_CM = 37.8; // Constante pour un écran à 96 DPI
const RULER_MARGIN = 5; // 5 pixels de marge avant le '0'

/**
 * Détermine sur quelle partie de la règle l'utilisateur a cliqué.
 */
export function getRulerHit(pos, rulerState) {
    if (!rulerState.visible) return null;

    const contentWidth = rulerState.maxLengthCm * PIXELS_PER_CM;
    const { zeroX, zeroY, height, angle } = rulerState;

    // Translate mouse position to be relative to the ruler's '0' mark on the graduated edge
    const dx = pos.x - zeroX;
    const dy = pos.y - zeroY;

    // Inverse rotate the mouse position
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // Define handle zones
    const handleZoneWidth = 40;
    const drawingEdgeThickness = 20; // Zone cliquable pour dessiner

    // Check if the click is within the ruler's body, which extends from -MARGIN to contentWidth, and from 0 to height
    if (localX >= -RULER_MARGIN && localX <= contentWidth && localY >= 0 && localY <= height) {
        // Priorité 1: Poignée de rotation
        if (localX > contentWidth - handleZoneWidth) {
            return 'rotating';
        }
        // Priorité 2: Bord pour dessiner
        if (localX >= 0 && localX <= contentWidth && localY >= 0 && localY <= drawingEdgeThickness) {
            return 'drawing-edge';
        }
        // Priorité 3: Déplacement
        return 'moving';
    }
    return null;
}

export function drawRuler(ctx, rulerState) {
    if (!rulerState.visible) return;

    const contentWidth = rulerState.maxLengthCm * PIXELS_PER_CM;
    const width = contentWidth + RULER_MARGIN;
    const { zeroX, zeroY, height, angle } = rulerState;

    ctx.save();
    // Translate to the '0' mark on the graduated edge and rotate
    ctx.translate(zeroX, zeroY);
    ctx.rotate(angle);

    // Dessine le corps de la règle (from -MARGIN to contentWidth, and from 0 to height)
    ctx.fillStyle = 'rgba(255, 229, 180, 0.85)'; // Couleur bois/papier avec transparence
    ctx.strokeStyle = '#8B4513'; // Marron foncé pour le contour
    ctx.lineWidth = 1;
    ctx.fillRect(-RULER_MARGIN, 0, width, height);
    ctx.strokeRect(-RULER_MARGIN, 0, width, height);

    // --- Draw visual cues for interactive zones ---
    const drawingEdgeThickness = 20;
    const handleZoneWidth = 40;
    const hintFillStyle = 'rgba(0, 0, 0, 0.07)';
    ctx.fillStyle = hintFillStyle;

    // Drawing edge (excluding the rotation handle area)
    ctx.fillRect(0, 0, contentWidth - handleZoneWidth, drawingEdgeThickness);

    // Rotation handle
    ctx.fillRect(contentWidth - handleZoneWidth, 0, handleZoneWidth, height);

    // Dessine les graduations
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    // Itérer sur les millimètres
    const totalMillimeters = Math.floor(rulerState.maxLengthCm * 10);
    for (let mm = 0; mm <= totalMillimeters; mm++) {
        const currentX = mm * (PIXELS_PER_CM / 10); // currentX is now the pixel offset from the '0' mark
        let tickHeight = 0;

        if (mm % 10 === 0) { // Marque du centimètre
            tickHeight = 20;
            const cm = mm / 10;
            // Affiche le numéro du cm
            ctx.fillText(cm, currentX, 30);
        } else if (mm % 5 === 0) { // Marque du demi-centimètre
            tickHeight = 15;
        } else { // Marque du millimètre
            tickHeight = 10;
        }

        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX, tickHeight);
        ctx.stroke();
    }

    ctx.restore();
}

export function handleMouseDown(mousePos, rulerState, rulerDragStart) {
    let isDragging = false;
    let dragMode = null;
    const hit = getRulerHit(mousePos, rulerState);
    if (hit) {
        isDragging = true;
        dragMode = hit;
        if (hit === 'moving') {
            rulerDragStart.dx = mousePos.x - rulerState.zeroX;
            rulerDragStart.dy = mousePos.y - rulerState.zeroY;
        } else if (hit === 'rotating') {
            rulerDragStart.angle = rulerState.angle;
            rulerDragStart.mouseAngle = Math.atan2(mousePos.y - rulerState.zeroY, mousePos.x - rulerState.zeroX);
        }
    }
    return { isDragging, dragMode };
}

export function handleMouseMove(currentMousePos, rulerState, rulerDragMode, rulerDragStart, shapes, snap) {
    let snapResult = { snapped: false };
    switch (rulerDragMode) {
        case 'moving':
            const potentialZeroX = currentMousePos.x - rulerDragStart.dx;
            const potentialZeroY = currentMousePos.y - rulerDragStart.dy;

            // Essaye de magnétiser
            if (snap && shapes) {
                snapResult = snap.getSnap({ x: potentialZeroX, y: potentialZeroY }, shapes);
            }

            if (snapResult.snapped) {
                if (snapResult.type === 'line') {
                    const finalAngle = snapResult.angle;
                    rulerState.angle = finalAngle;
                    let finalX = snapResult.position.x;
                    let finalY = snapResult.position.y;

                    rulerState.zeroX = finalX;
                    rulerState.zeroY = finalY;
                } else if (snapResult.type === 'point') {
                    // Magnétise sur le point : met à jour la position, garde l'angle
                    rulerState.zeroX = snapResult.position.x;
                    rulerState.zeroY = snapResult.position.y;
                }
            } else {
                rulerState.zeroX = potentialZeroX;
                rulerState.zeroY = potentialZeroY;
            }
            break;
        case 'rotating':
            const currentMouseAngle = Math.atan2(currentMousePos.y - rulerState.zeroY, currentMousePos.x - rulerState.zeroX);
            const angleDelta = currentMouseAngle - rulerDragStart.mouseAngle;
            rulerState.angle = rulerDragStart.angle + angleDelta;
            break;
    }
    return snapResult;
}

/**
 * Projette un point sur le bord de dessin de la règle.
 * @param {{x: number, y: number}} pos - La position de la souris.
 * @param {object} rulerState - L'état de la règle.
 * @returns {{x: number, y: number}} Le point projeté.
 */
export function projectOnEdge(pos, rulerState, clamp = true) {
    const { zeroX, zeroY, angle, maxLengthCm } = rulerState;
    const contentWidth = maxLengthCm * PIXELS_PER_CM;

    // Les points de début et de fin du segment de dessin
    const p1 = { x: zeroX, y: zeroY };
    const p2 = {
        x: zeroX + contentWidth * Math.cos(angle),
        y: zeroY + contentWidth * Math.sin(angle)
    };

    // Logique de projection de point sur un segment de ligne
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lineLengthSq = dx * dx + dy * dy;

    if (lineLengthSq === 0) return p1;

    let t = ((pos.x - p1.x) * dx + (pos.y - p1.y) * dy) / lineLengthSq;
    if (clamp) {
        t = Math.max(0, Math.min(1, t)); // Clamp to the segment
    }

    return {
        x: p1.x + t * dx,
        y: p1.y + t * dy
    };
}