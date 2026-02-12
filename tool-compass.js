// tool-compass.js

/**
 * Calcule la position de la charnière du compas pour un rendu réaliste.
 */
export function calculateHinge(center, pencil) {
    if (!center || !pencil) return null;
    const radius = Math.hypot(pencil.x - center.x, pencil.y - center.y);
    if (radius < 1) return { x: center.x, y: center.y - 30 }; // Cas où le compas est fermé

    const hingeRadius = 10;
    const legHeightFactor = 0.5;

    const midPoint = { x: (center.x + pencil.x) / 2, y: (center.y + pencil.y) / 2 };
    const dx = pencil.x - center.x;
    const dy = pencil.y - center.y;
    const perpDx = -dy / radius;
    const perpDy = dx / radius;
    const height = Math.max(radius * legHeightFactor, hingeRadius * 1.5);
    return { x: midPoint.x + perpDx * height, y: midPoint.y + perpDy * height };
}

/**
 * Détermine sur quelle partie du compas l'utilisateur a cliqué.
 */
export function getCompassHit(pos, compassState) {
    if (!compassState.center) return null;
    const hitRadius = 25; // Rayon de détection du clic (agrandi)
    const hinge = calculateHinge(compassState.center, compassState.pencil);
    if (hinge && Math.hypot(pos.x - hinge.x, pos.y - hinge.y) < hitRadius) return 'rotating';
    if (Math.hypot(pos.x - compassState.pencil.x, pos.y - compassState.pencil.y) < hitRadius) return 'resizing';
    if (Math.hypot(pos.x - compassState.center.x, pos.y - compassState.center.y) < hitRadius) return 'moving';
    return null;
}

export function drawCompass(ctx, compassState, isDraggingCompass, compassDragMode) {
    const center = compassState.center;
    const pencil = compassState.pencil;

    const hinge = calculateHinge(center, pencil);
    if (!hinge) return;

    // --- 1. Calculer la géométrie ---
    const legWidthAtHinge = 8;
    const legWidthAtTip = 4;
    const hingeRadius = 10;

    // --- 2. Dessiner les branches ---
    const drawLeg = (tipPoint, isMetal) => {
         const legDx = tipPoint.x - hinge.x;
         const legDy = tipPoint.y - hinge.y;
         const legLength = Math.hypot(legDx, legDy);
         if (legLength < 1) return;

         ctx.fillStyle = isMetal ? '#C0C0C0' : '#DEB887'; // Argenté pour le métal, bois pour le crayon
         ctx.strokeStyle = '#696969'; // Gris foncé
         ctx.lineWidth = 1;

         const legPerpDx = -legDy / legLength;
         const legPerpDy = legDx / legLength;

         ctx.beginPath();
         ctx.moveTo(hinge.x - legPerpDx * legWidthAtHinge / 2, hinge.y - legPerpDy * legWidthAtHinge / 2);
         ctx.lineTo(hinge.x + legPerpDx * legWidthAtHinge / 2, hinge.y + legPerpDy * legWidthAtHinge / 2);
         ctx.lineTo(tipPoint.x + legPerpDx * legWidthAtTip / 2, tipPoint.y + legPerpDy * legWidthAtTip / 2);
         ctx.lineTo(tipPoint.x - legPerpDx * legWidthAtTip / 2, tipPoint.y - legPerpDy * legWidthAtTip / 2);
         ctx.closePath();
         ctx.fill();
         ctx.stroke();
    };

    drawLeg(center, true); // La branche de la pointe est en métal
    drawLeg(pencil, false); // La branche du crayon est en bois

    // --- 3. Dessiner la charnière ---
    ctx.fillStyle = '#A9A9A9';
    ctx.beginPath();
    ctx.arc(hinge.x, hinge.y, hingeRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.arc(hinge.x, hinge.y, hingeRadius * 0.4, 0, 2 * Math.PI);
    ctx.fill();

    // --- 4. Dessiner la pointe ---
    const spikeSize = 10;
    const spikeWidth = 6;
    const spikeLegDx = center.x - hinge.x;
    const spikeLegDy = center.y - hinge.y;
    const spikeLegLength = Math.hypot(spikeLegDx, spikeLegDy);
    if (spikeLegLength > 0) {
        const spikeDirX = spikeLegDx / spikeLegLength; // Vecteur de la charnière vers le centre
        const spikeDirY = spikeLegDy / spikeLegLength;
        const spikePerpX = -spikeDirY;
        const spikePerpY = spikeDirX;

        // La base du cône de la pointe, "au-dessus" de la pointe
        const spikeBase = { x: center.x - spikeDirX * spikeSize, y: center.y - spikeDirY * spikeSize };

        ctx.fillStyle = '#FFFFFF'; // Pointe blanche
        ctx.strokeStyle = '#404040'; // Contour sombre pour la visibilité
        ctx.beginPath();
        ctx.moveTo(center.x, center.y); // La pointe est exactement au centre
        ctx.lineTo(spikeBase.x + spikePerpX * spikeWidth / 2, spikeBase.y + spikePerpY * spikeWidth / 2);
        ctx.lineTo(spikeBase.x - spikePerpX * spikeWidth / 2, spikeBase.y - spikePerpY * spikeWidth / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // --- 5. Dessiner le crayon ---
    const pencilHolderHeight = 12;
    const pencilHolderWidth = 9;
    const pencilTipHeight = 8;

    const pencilLegDx = pencil.x - hinge.x;
    const pencilLegDy = pencil.y - hinge.y;
    const pencilLegLength = Math.hypot(pencilLegDx, pencilLegDy);
    if (pencilLegLength > 0) {
        const pencilDirX = pencilLegDx / pencilLegLength;
        const pencilDirY = pencilLegDy / pencilLegLength;
        const pencilTipBase = { x: pencil.x - pencilDirX * pencilTipHeight, y: pencil.y - pencilDirY * pencilTipHeight };
        const pencilHolderBase = { x: pencil.x - pencilDirX * (pencilTipHeight + pencilHolderHeight), y: pencil.y - pencilDirY * (pencilTipHeight + pencilHolderHeight) };
        const pencilPerpX = -pencilDirY;
        const pencilPerpY = pencilDirX;

        // Dessine le support en bois du crayon
        ctx.fillStyle = '#DEB887'; // Couleur bois
        ctx.beginPath();
        ctx.moveTo(pencilHolderBase.x + pencilPerpX * pencilHolderWidth / 2, pencilHolderBase.y + pencilPerpY * pencilHolderWidth / 2);
        ctx.lineTo(pencilHolderBase.x - pencilPerpX * pencilHolderWidth / 2, pencilHolderBase.y - pencilPerpY * pencilHolderWidth / 2);
        ctx.lineTo(pencilTipBase.x - pencilPerpX * pencilHolderWidth / 2, pencilTipBase.y - pencilPerpY * pencilHolderWidth / 2);
        ctx.lineTo(pencilTipBase.x + pencilPerpX * pencilHolderWidth / 2, pencilTipBase.y + pencilPerpY * pencilHolderWidth / 2);
        ctx.closePath();
        ctx.fill();

        // Dessine la mine en graphite
        ctx.fillStyle = (isDraggingCompass && compassDragMode === 'rotating') ? '#808080' : '#202020'; // Gris pour dessiner
        ctx.beginPath();
        ctx.moveTo(pencil.x, pencil.y); // La pointe du crayon
        ctx.lineTo(pencilTipBase.x + pencilPerpX * pencilHolderWidth / 2, pencilTipBase.y + pencilPerpY * pencilHolderWidth / 2);
        ctx.lineTo(pencilTipBase.x - pencilPerpX * pencilHolderWidth / 2, pencilTipBase.y - pencilPerpY * pencilHolderWidth / 2);
        ctx.closePath();
        ctx.fill();
    }
}

export function handleMouseDown(mousePos, compassState, compassDragStart, arcState) {
    let isDragging = false;
    let dragMode = null;

    if (compassState.center) { // Si le compas est déjà sur le canvas
        const hit = getCompassHit(mousePos, compassState);
        if (hit) {
            isDragging = true;
            dragMode = hit;
            if (hit === 'moving') {
                compassDragStart.dx = mousePos.x - compassState.center.x;
                compassDragStart.dy = mousePos.y - compassState.center.y;
            } else if (hit === 'rotating') {
                const dx = compassState.pencil.x - compassState.center.x;
                const dy = compassState.pencil.y - compassState.center.y;
                arcState.startAngle = Math.atan2(dy, dx);
                arcState.endAngle = arcState.startAngle;
            }
        }
    } else { // Premier clic pour placer le compas
        isDragging = true;
        dragMode = 'resizing'; // On commence par régler l'écartement
        compassState.center = { ...mousePos };
        compassState.pencil = { ...mousePos };
        compassState.radius = 0;
    }
    return { isDragging, dragMode };
}

export function handleMouseMove(currentMousePos, compassState, compassDragMode, compassDragStart, arcState) {
    switch (compassDragMode) {
        case 'moving':
            const newCenterX = currentMousePos.x - compassDragStart.dx;
            const newCenterY = currentMousePos.y - compassDragStart.dy;
            const moveDx = newCenterX - compassState.center.x;
            const moveDy = newCenterY - compassState.center.y;
            compassState.center.x = newCenterX;
            compassState.center.y = newCenterY;
            compassState.pencil.x += moveDx;
            compassState.pencil.y += moveDy;
            break;
        case 'resizing':
            compassState.pencil = { ...currentMousePos };
            break;
        case 'rotating':
            const dx = currentMousePos.x - compassState.center.x;
            const dy = currentMousePos.y - compassState.center.y;
            const angle = Math.atan2(dy, dx);
            compassState.pencil.x = compassState.center.x + compassState.radius * Math.cos(angle);
            compassState.pencil.y = compassState.center.y + compassState.radius * Math.sin(angle);
            arcState.endAngle = angle;
            break;
    }
    // Mettre à jour le rayon après un déplacement ou un redimensionnement
    const rdx = compassState.pencil.x - compassState.center.x;
    const rdy = compassState.pencil.y - compassState.center.y;
    compassState.radius = Math.hypot(rdx, rdy);
}

export function handleMouseUp(compassDragMode, arcState, compassState, shapes, saveState) {
    if (compassDragMode === 'rotating') {
        // Finalise et sauvegarde l'arc tracé
        if (Math.abs(arcState.endAngle - arcState.startAngle) > 0.01) {
            saveState();
            shapes.push({ type: 'arc', cx: compassState.center.x, cy: compassState.center.y, radius: compassState.radius, startAngle: arcState.startAngle, endAngle: arcState.endAngle, color: '#808080' }); // Sauvegarde en gris
        }
    }
}