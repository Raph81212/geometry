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

        // Check for rotation handles at the three corners first to give them priority
        if (Math.hypot(localX, localY) < handleZoneWidth || 
            Math.hypot(localX - size, localY) < handleZoneWidth ||
            Math.hypot(localX, localY - size) < handleZoneWidth) {
            return 'rotating';
        }

        // Then, check for hypotenuse (horizontal move)
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
    ctx.strokeStyle = hintFillStyle;
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
export function handleMouseDown(mousePos, setSquareState, setSquareDragStart) {
    const hit = getSetSquareHit(mousePos, setSquareState);
    if (!hit) return { isDragging: false, dragMode: null };

    setSquareDragStart.dx = mousePos.x - setSquareState.cornerX;
    setSquareDragStart.dy = mousePos.y - setSquareState.cornerY;
    if (hit === 'rotating') {
        setSquareDragStart.angle = setSquareState.angle;
        setSquareDragStart.mouseAngle = Math.atan2(mousePos.y - setSquareState.cornerY, mousePos.x - setSquareState.cornerX);
    }
    return { isDragging: true, dragMode: hit };
}

/**
 * Gère l'événement mousemove pour l'équerre.
 */
export function handleMouseMove(currentMousePos, setSquareState, setSquareDragMode, setSquareDragStart) {
    if (setSquareDragMode === 'rotating') {
        const currentMouseAngle = Math.atan2(currentMousePos.y - setSquareState.cornerY, currentMousePos.x - setSquareState.cornerX);
        const angleDelta = currentMouseAngle - setSquareDragStart.mouseAngle;
        setSquareState.angle = setSquareDragStart.angle + angleDelta;
    } else if (setSquareDragMode === 'horizontal-moving') {
        setSquareState.cornerX = currentMousePos.x - setSquareDragStart.dx;
        // setSquareState.cornerY reste inchangé
    } else if (setSquareDragMode === 'moving') {
        setSquareState.cornerX = currentMousePos.x - setSquareDragStart.dx;
        setSquareState.cornerY = currentMousePos.y - setSquareDragStart.dy;
    }
}