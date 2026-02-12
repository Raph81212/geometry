// tool-ruler.js

/**
 * Détermine sur quelle partie de la règle l'utilisateur a cliqué.
 */
export function getRulerHit(pos, rulerState) {
    if (!rulerState.visible) return null;

    const { x, y, width, height, angle } = rulerState;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Traduit la position de la souris pour qu'elle soit relative au centre de la règle
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;

    // Fait une rotation inverse de la position de la souris pour l'aligner avec la règle non pivotée
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // Zone de détection pour la rotation aux extrémités
    const handleZoneWidth = 40;

    // Vérifie si le clic est dans le corps de la règle
    if (localX >= -width / 2 && localX <= width / 2 && localY >= -height / 2 && localY <= height / 2) {
        // Si le clic est dans une zone d'extrémité, c'est pour la rotation
        if (localX < -width / 2 + handleZoneWidth || localX > width / 2 - handleZoneWidth) {
            return 'rotating';
        }
        // Sinon, c'est pour le déplacement
        return 'moving';
    }
    return null;
}

export function drawRuler(ctx, rulerState) {
    if (!rulerState.visible) return;

    const { x, y, width, height, angle } = rulerState;

    ctx.save();
    // Se place au centre de la règle pour la rotation
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(angle);

    // Dessine le corps de la règle
    ctx.fillStyle = 'rgba(255, 229, 180, 0.85)'; // Couleur bois/papier avec transparence
    ctx.strokeStyle = '#8B4513'; // Marron foncé pour le contour
    ctx.lineWidth = 1;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    // Dessine les graduations
    const PIXELS_PER_CM = 37.8; // Constante pour un écran à 96 DPI
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    for (let px = 0; px <= width; px += (PIXELS_PER_CM / 10)) {
        // On part du bord gauche de la règle (-width / 2)
        const currentX = px - width / 2;
        const cm = px / PIXELS_PER_CM;
        let tickHeight = 0;

        if (cm % 1 === 0) { // Marque du centimètre
            tickHeight = 20;
            // Affiche le numéro du cm
            if (cm > 0 && cm < width / PIXELS_PER_CM) {
                ctx.fillText(Math.round(cm), currentX, -height / 2 + 30);
            }
        } else if (cm % 0.5 === 0) { // Marque du demi-centimètre
            tickHeight = 15;
        } else { // Marque du millimètre
            tickHeight = 10;
        }

        ctx.beginPath();
        ctx.moveTo(currentX, -height / 2);
        ctx.lineTo(currentX, -height / 2 + tickHeight);
        ctx.stroke();
    }

    // Affiche "0" au début de la règle
    ctx.fillText('0', -width / 2, -height / 2 + 30);

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
            rulerDragStart.dx = mousePos.x - rulerState.x;
            rulerDragStart.dy = mousePos.y - rulerState.y;
        } else if (hit === 'rotating') {
            const centerX = rulerState.x + rulerState.width / 2;
            const centerY = rulerState.y + rulerState.height / 2;
            rulerDragStart.angle = rulerState.angle;
            rulerDragStart.mouseAngle = Math.atan2(mousePos.y - centerY, mousePos.x - centerX);
        }
    }
    return { isDragging, dragMode };
}

export function handleMouseMove(currentMousePos, rulerState, rulerDragMode, rulerDragStart) {
    const centerX = rulerState.x + rulerState.width / 2;
    const centerY = rulerState.y + rulerState.height / 2;
    switch (rulerDragMode) {
        case 'moving':
            rulerState.x = currentMousePos.x - rulerDragStart.dx;
            rulerState.y = currentMousePos.y - rulerDragStart.dy;
            break;
        case 'rotating':
            const currentMouseAngle = Math.atan2(currentMousePos.y - centerY, currentMousePos.x - centerX);
            const angleDelta = currentMouseAngle - rulerDragStart.mouseAngle;
            rulerState.angle = rulerDragStart.angle + angleDelta;
            break;
    }
}