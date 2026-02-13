// drawing.js

export function drawArc(ctx, arc) {
    ctx.beginPath();
    ctx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle);
    ctx.strokeStyle = arc.color || '#0000FF';
    ctx.lineWidth = 2;
    ctx.stroke();
}

export function drawText(ctx, textShape) {
    ctx.fillStyle = textShape.color || '#000000';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(textShape.content, textShape.x, textShape.y);
}

export function drawPoint(ctx, point, shapes) {
    const crossSize = 6; // Taille des branches de la croix

    // Dessine la croix (diagonale)
    ctx.beginPath();
    ctx.moveTo(point.x - crossSize, point.y - crossSize);
    ctx.lineTo(point.x + crossSize, point.y + crossSize);
    ctx.moveTo(point.x + crossSize, point.y - crossSize);
    ctx.lineTo(point.x - crossSize, point.y + crossSize);
    ctx.strokeStyle = point.color || '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dessine le nom du point
    ctx.fillStyle = point.color || '#000000';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    // Affiche le nom à côté de la croix
    ctx.fillText(point.name, point.x + crossSize + 3, point.y - crossSize);

    // --- DESSIN DU CODAGE D'ANGLE ---
    if (point.angleMark) {
        const connectedLines = shapes.filter(s =>
            s.type === 'line' &&
            (
                (Math.hypot(s.x1 - point.x, s.y1 - point.y) < 1) ||
                (Math.hypot(s.x2 - point.x, s.y2 - point.y) < 1)
            )
        );

        if (connectedLines.length === 2) {
            const line1 = connectedLines[0];
            const line2 = connectedLines[1];

            // Get vectors pointing away from the point
            const v1 = (Math.hypot(line1.x1 - point.x, line1.y1 - point.y) < 1)
                ? { x: line1.x2 - point.x, y: line1.y2 - point.y }
                : { x: line1.x1 - point.x, y: line1.y1 - point.y };

            const v2 = (Math.hypot(line2.x1 - point.x, line2.y1 - point.y) < 1)
                ? { x: line2.x2 - point.x, y: line2.y2 - point.y }
                : { x: line2.x1 - point.x, y: line2.y1 - point.y };

            const angle1 = Math.atan2(v1.y, v1.x);
            const angle2 = Math.atan2(v2.y, v2.x);

            ctx.strokeStyle = point.color || '#000000';
            ctx.lineWidth = 1.5;

            const markRadius = 25;

            if (point.angleMark.type === 'right') {
                const size = 15;
                const p1 = { x: point.x + size * Math.cos(angle1), y: point.y + size * Math.sin(angle1) };
                const p3 = { x: point.x + size * Math.cos(angle2), y: point.y + size * Math.sin(angle2) };
                const p2 = { x: p1.x + (p3.x - point.x), y: p1.y + (p3.y - point.y) };

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.stroke();
            } else { // 'single' or 'double' arc
                let startAngle = angle1, endAngle = angle2;
                if ((endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI) > Math.PI) {
                    [startAngle, endAngle] = [endAngle, startAngle];
                }
                ctx.beginPath();
                ctx.arc(point.x, point.y, markRadius, startAngle, endAngle);
                ctx.stroke();
                if (point.angleMark.type === 'double') {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, markRadius + 4, startAngle, endAngle);
                    ctx.stroke();
                }
            }
        }
    }
}

export function drawLine(ctx, line) {
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.strokeStyle = line.color || '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- DESSIN DU CODAGE DE LONGUEUR ---
    if (line.marking && line.marking > 0) {
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2;
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const length = Math.hypot(dx, dy);
        if (length === 0) return;

        const perpX = -dy / length;
        const perpY = dx / length;
        const tickLength = 10;
        const tickSpacing = 4;

        const totalWidth = (line.marking - 1) * tickSpacing;
        const startOffset = -totalWidth / 2;

        ctx.strokeStyle = line.color || '#000000';
        ctx.lineWidth = 2;

        for (let i = 0; i < line.marking; i++) {
            const offset = startOffset + i * tickSpacing;
            const tickCenterX = midX + (dx / length) * offset;
            const tickCenterY = midY + (dy / length) * offset;
            const tickStartX = tickCenterX + perpX * tickLength / 2;
            const tickStartY = tickCenterY + perpY * tickLength / 2;
            const tickEndX = tickCenterX - perpX * tickLength / 2;
            const tickEndY = tickCenterY - perpY * tickLength / 2;

            ctx.beginPath();
            ctx.moveTo(tickStartX, tickStartY);
            ctx.lineTo(tickEndX, tickEndY);
            ctx.stroke();
        }
    }
}