// tool-protractor.js

/**
 * Détermine sur quelle partie du rapporteur l'utilisateur a cliqué.
 */
export function getProtractorHit(pos, protractorState) {
    if (!protractorState.visible) return null;

    const { centerX, centerY, radius, angle } = protractorState;

    // Translate mouse position to be relative to the protractor's center
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;

    // Inverse rotate the mouse position
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const distFromCenter = Math.hypot(localX, localY);

    // Check if the click is within the protractor's body (semi-circle)
    if (distFromCenter <= radius && localY <= 0) {
        // The center area is for moving
        if (distFromCenter < radius * 0.8) {
            return 'moving';
        }
        // The outer edge is for rotating
        return 'rotating';
    }
    return null;
}

export function drawProtractor(ctx, protractorState) {
    if (!protractorState.visible) return;

    const { centerX, centerY, radius, angle } = protractorState;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    // --- Draw Body ---
    ctx.beginPath();
    ctx.arc(0, 0, radius, Math.PI, 0); // Upper semi-circle
    ctx.closePath();
    ctx.fillStyle = 'rgba(173, 216, 230, 0.7)'; // Light blue, semi-transparent
    ctx.strokeStyle = '#00008B'; // Dark blue
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // --- Draw Center Mark ---
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 5);
    ctx.stroke();

    // --- Draw Graduations ---
    ctx.fillStyle = '#000000';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; // For better vertical alignment

    for (let angleDeg = 0; angleDeg <= 180; angleDeg++) {
        const angleRad = angleDeg * Math.PI / 180; // 0 is on the right, PI is on the left
        const cosRad = Math.cos(angleRad);
        const sinRad = Math.sin(angleRad);
        let tickHeight = 0;
        let showNumber = false;

        if (angleDeg % 10 === 0) {
            tickHeight = 15;
            showNumber = true;
        } else if (angleDeg % 5 === 0) {
            tickHeight = 10;
        } else {
            tickHeight = 5;
        }

        ctx.beginPath();
        // The arc is on the top half (negative Y in this coordinate system)
        ctx.moveTo(cosRad * radius, -sinRad * radius);
        ctx.lineTo(cosRad * (radius - tickHeight), -sinRad * (radius - tickHeight));
        ctx.stroke();

        if (showNumber) {
            const innerDeg = angleDeg;       // Inner scale: 0 on right, 180 on left
            const outerDeg = 180 - angleDeg; // Outer scale: 180 on right, 0 on left

            // Position for inner numbers
            const innerTextRadius = radius - tickHeight - 8; // Rapproché du bord
            const innerTextX = cosRad * innerTextRadius;
            const innerTextY = -sinRad * innerTextRadius;
            ctx.fillText(innerDeg, innerTextX, innerTextY);

            // Draw outer number, but not at 90 to avoid overlap
            if (innerDeg !== 90) {
                const outerTextRadius = radius - tickHeight - 24; // Placé plus à l'intérieur pour plus d'espace
                const outerTextX = cosRad * outerTextRadius;
                const outerTextY = -sinRad * outerTextRadius;
                ctx.fillText(outerDeg, outerTextX, outerTextY);
            }
        }
    }

    ctx.restore();
}

export function handleMouseDown(mousePos, protractorState, protractorDragStart) {
    let isDragging = false;
    let dragMode = null;
    const hit = getProtractorHit(mousePos, protractorState);
    if (hit) {
        isDragging = true;
        dragMode = hit;
        if (hit === 'moving') {
            protractorDragStart.dx = mousePos.x - protractorState.centerX;
            protractorDragStart.dy = mousePos.y - protractorState.centerY;
        } else if (hit === 'rotating') {
            protractorDragStart.angle = protractorState.angle;
            protractorDragStart.mouseAngle = Math.atan2(mousePos.y - protractorState.centerY, mousePos.x - protractorState.centerX);
        }
    }
    return { isDragging, dragMode };
}

export function handleMouseMove(currentMousePos, protractorState, protractorDragMode, protractorDragStart) {
    switch (protractorDragMode) {
        case 'moving':
            protractorState.centerX = currentMousePos.x - protractorDragStart.dx;
            protractorState.centerY = currentMousePos.y - protractorDragStart.dy;
            break;
        case 'rotating':
            const currentMouseAngle = Math.atan2(currentMousePos.y - protractorState.centerY, currentMousePos.x - protractorState.centerX);
            const angleDelta = currentMouseAngle - protractorDragStart.mouseAngle;
            protractorState.angle = protractorDragStart.angle + angleDelta;
            break;
    }
}