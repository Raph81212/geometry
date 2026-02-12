// tool-setsquare.js

const PIXELS_PER_CM = 37.8; // Constante pour un écran à 96 DPI

/**
 * Détermine sur quelle partie de l'équerre l'utilisateur a cliqué.
 */
export function getSetSquareHit(pos, setSquareState) {
    if (!setSquareState.visible) return null;

    const { cornerX, cornerY, size, angle } = setSquareState;

    // Translate mouse position to be relative to the set square's 90-degree corner
    const dx = pos.x - cornerX;
    const dy = pos.y - cornerY;

    // Inverse rotate the mouse position
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // Check if the click is within the triangle bounds (with a small tolerance)
    if (localX >= -5 && localY >= -5 && (localX + localY) <= size + 5) {
        const handleZoneWidth = 40;
        const hypotenuseZoneThickness = 25;
        const drawingEdgeThickness = 20;
        const zoneGap = 5; // Espace entre les zones

        // Priorité 1: Vérifier les bords de dessin (en excluant les coins de rotation et avec un espacement).
        const onH = localY >= 0 && localY <= drawingEdgeThickness && localX >= handleZoneWidth + zoneGap && localX <= size - (handleZoneWidth + zoneGap);
        const onV = localX >= 0 && localX <= drawingEdgeThickness && localY >= handleZoneWidth + zoneGap && localY <= size - (handleZoneWidth + zoneGap);

        if (onH) {
            return 'drawing-edge-h';
        }
        if (onV) {
            return 'drawing-edge-v';
        }

        // Priorité 2: Vérifier les poignées de rotation aux trois coins.
        if (Math.hypot(localX, localY) < handleZoneWidth || 
            Math.hypot(localX - size, localY) < handleZoneWidth ||
            Math.hypot(localX, localY - size) < handleZoneWidth) {
            return 'rotating';
        }

        // Priorité 3: Vérifier l'hypoténuse (glissement).
        // Distance from point to line x+y-size=0 is |x+y-size|/sqrt(2)
        const distToHypotenuse = Math.abs(localX + localY - size) / Math.SQRT2;
        if (distToHypotenuse < hypotenuseZoneThickness) {
            return 'horizontal-moving';
        }

        // The rest of the body is for moving
        return 'moving';
    }

    return null;
}

/**
 * Dessine l'équerre sur le canvas.
 */
export function drawSetSquare(ctx, setSquareState) {
    if (!setSquareState.visible) return;

    const { cornerX, cornerY, size, angle } = setSquareState;

    ctx.save();
    ctx.translate(cornerX, cornerY);
    ctx.rotate(angle);

    // --- Path for the main body (used for drawing and clipping) ---
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.closePath();

    // --- Draw Body ---
    ctx.fillStyle = 'rgba(255, 229, 180, 0.85)'; // Couleur bois/papier
    ctx.strokeStyle = '#8B4513'; // Marron foncé
    ctx.lineWidth = 1;
    ctx.fill();

    // --- Draw subtle visual cues for interactive zones ---
    ctx.save();
    ctx.clip(); // Use the triangle path as a clipping mask

    const handleZoneWidth = 40;
    const hypotenuseZoneThickness = 25;
    const hintFillStyle = 'rgba(0, 0, 0, 0.07)';
    const slideHintStyle = 'rgba(0, 0, 255, 0.07)'; // Teinte bleutée pour le glissement
    const drawingEdgeThickness = 20;
    const zoneGap = 5;

    // Indice visuel pour les bords de dessin
    ctx.fillStyle = hintFillStyle;
    // Bord horizontal, en laissant de la place pour les poignées de rotation
    ctx.fillRect(handleZoneWidth + zoneGap, 0, size - 2 * (handleZoneWidth + zoneGap), drawingEdgeThickness);
    // Bord vertical, en laissant de la place pour les poignées de rotation
    ctx.fillRect(0, handleZoneWidth + zoneGap, drawingEdgeThickness, size - 2 * (handleZoneWidth + zoneGap));

    // Rotation handles
    ctx.fillStyle = hintFillStyle;
    ctx.beginPath();
    ctx.arc(0, 0, handleZoneWidth, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(size, 0, handleZoneWidth, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, size, handleZoneWidth, 0, 2 * Math.PI);
    ctx.fill();

    // Horizontal move handle (hypotenuse)
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineWidth = hypotenuseZoneThickness * 2;
    ctx.strokeStyle = slideHintStyle;
    ctx.stroke();

    ctx.restore(); // Remove clipping mask

    // --- Draw the outline on top of the hints ---
    ctx.stroke(); // This is the stroke for the main body path defined earlier

    // --- Draw Graduations ---
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    const maxLengthCm = size / PIXELS_PER_CM;
    const totalMillimeters = Math.floor(maxLengthCm * 10);

    for (let mm = 0; mm <= totalMillimeters; mm++) {
        const currentPos = mm * (PIXELS_PER_CM / 10);
        if (currentPos > size) continue;

        let tickHeight = (mm % 10 === 0) ? 20 : (mm % 5 === 0) ? 15 : 10;

        // Graduations sur l'axe X
        ctx.beginPath();
        ctx.moveTo(currentPos, 0);
        ctx.lineTo(currentPos, tickHeight);
        ctx.stroke();

        if (mm % 10 === 0) { // Marque du centimètre
            const cm = mm / 10;
            // Affiche le numéro du cm sur l'axe gradué, en évitant les bords pour les autres numéros
            if (cm === 0) {
                ctx.fillText('0', 15, 30);
            } else if (currentPos > 15 && currentPos < size - 15) {
                ctx.fillText(cm, currentPos, 30);
            }
        }
    }

    ctx.restore();
}

/**
 * Gère l'événement mousedown sur l'équerre.
 */
export function handleMouseDown(mousePos, setSquareState, setSquareDragStart, snapInfo) {
    const hit = getSetSquareHit(mousePos, setSquareState);
    if (!hit) return { isDragging: false, dragMode: null };

    setSquareDragStart.dx = mousePos.x - setSquareState.cornerX;
    setSquareDragStart.dy = mousePos.y - setSquareState.cornerY;
    if (hit === 'rotating') {
        setSquareDragStart.angle = setSquareState.angle;
        setSquareDragStart.mouseAngle = Math.atan2(mousePos.y - setSquareState.cornerY, mousePos.x - setSquareState.cornerX);
    }
    // Mémorise l'état de magnétisation au début du glissement
    setSquareDragStart.snapAtDragStart = (snapInfo && snapInfo.snapped) ? snapInfo : null;

    return { isDragging: true, dragMode: hit };
}

/**
 * Gère l'événement mousemove pour l'équerre.
 */
export function handleMouseMove(currentMousePos, setSquareState, setSquareDragMode, setSquareDragStart, shapes, snap) {
    let snapResult = { snapped: false };

    if (setSquareDragMode === 'moving') {
        const potentialCornerX = currentMousePos.x - setSquareDragStart.dx;
        const potentialCornerY = currentMousePos.y - setSquareDragStart.dy;

        if (snap && shapes) {
            snapResult = snap.getSnap({ x: potentialCornerX, y: potentialCornerY }, shapes);
        }

        if (snapResult.snapped) {
            if (snapResult.type === 'line') {
                let finalAngle = snapResult.angle;
                // Si on approche par "au-dessus", on retourne l'équerre pour coller le bon côté
                if (snapResult.side < 0) {
                    finalAngle += Math.PI;
                }
                setSquareState.angle = finalAngle;
                setSquareState.cornerX = snapResult.position.x;
                setSquareState.cornerY = snapResult.position.y;
            } else if (snapResult.type === 'point') {
                // Magnétise sur le point : met à jour la position, garde l'angle
                setSquareState.cornerX = snapResult.position.x;
                setSquareState.cornerY = snapResult.position.y;
            }
        } else {
            setSquareState.cornerX = potentialCornerX;
            setSquareState.cornerY = potentialCornerY;
        }
    } else if (setSquareDragMode === 'rotating') {
        const currentMouseAngle = Math.atan2(currentMousePos.y - setSquareState.cornerY, currentMousePos.x - setSquareState.cornerX);
        const angleDelta = currentMouseAngle - setSquareDragStart.mouseAngle;
        setSquareState.angle = setSquareDragStart.angle + angleDelta;
    } else if (setSquareDragMode === 'horizontal-moving') {
        if (setSquareDragStart.snapAtDragStart && setSquareDragStart.snapAtDragStart.type === 'line') {
            // L'équerre est magnétisée : on glisse le long de la ligne
            const snappedLine = setSquareDragStart.snapAtDragStart.snappedShape;
            const potentialPos = {
                x: currentMousePos.x - setSquareDragStart.dx,
                y: currentMousePos.y - setSquareDragStart.dy
            };

            // Projette la position potentielle sur la ligne magnétisée
            const l1 = { x: snappedLine.x1, y: snappedLine.y1 };
            const dx = snappedLine.x2 - snappedLine.x1;
            const dy = snappedLine.y2 - snappedLine.y1;
            const lineLengthSq = dx * dx + dy * dy;

            if (lineLengthSq > 0) {
                const t = ((potentialPos.x - l1.x) * dx + (potentialPos.y - l1.y) * dy) / lineLengthSq;
                const snappedPosition = { x: l1.x + t * dx, y: l1.y + t * dy };
                
                setSquareState.cornerX = snappedPosition.x;
                setSquareState.cornerY = snappedPosition.y;
            }
            snapResult = setSquareDragStart.snapAtDragStart;
        }
    }

    return snapResult;
}

/**
 * Projette un point sur un des bords de dessin de l'équerre.
 * @param {{x: number, y: number}} pos - La position de la souris.
 * @param {object} setSquareState - L'état de l'équerre.
 * @param {'h'|'v'} edgeType - Le type de bord ('h' pour horizontal, 'v' pour vertical).
 * @returns {{x: number, y: number}} Le point projeté.
 */
export function projectOnEdge(pos, setSquareState, edgeType, clamp = true) {
    const { cornerX, cornerY, size, angle } = setSquareState;

    const p1 = { x: cornerX, y: cornerY };
    let p2;

    if (edgeType === 'h') {
        // Bord horizontal (gradué)
        p2 = {
            x: cornerX + size * Math.cos(angle),
            y: cornerY + size * Math.sin(angle)
        };
    } else { // 'v'
        // Bord vertical
        p2 = {
            x: cornerX + size * Math.cos(angle + Math.PI / 2),
            y: cornerY + size * Math.sin(angle + Math.PI / 2)
        };
    }

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