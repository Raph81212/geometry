// grid.js

export function drawCmGrid(ctx, width, height, pixelsPerCm) {
    ctx.beginPath();
    ctx.strokeStyle = '#e0e0e0'; // Light grey for the grid
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = 0; x < width; x += pixelsPerCm) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }

    // Horizontal lines
    for (let y = 0; y < height; y += pixelsPerCm) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }

    ctx.stroke();
}

export function drawOrthonormalGrid(ctx, width, height, pixelsPerCm) {
    const originX = width / 2;
    const originY = height / 2;
    const tickSize = 5;

    // Draw minor grid lines (the 1cm grid centered on the origin)
    ctx.beginPath();
    ctx.strokeStyle = '#f0f0f0'; // Very light grey for minor grid
    ctx.lineWidth = 0.5;
    for (let x = originX; x < width; x += pixelsPerCm) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let x = originX - pixelsPerCm; x > 0; x -= pixelsPerCm) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = originY; y < height; y += pixelsPerCm) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    for (let y = originY - pixelsPerCm; y > 0; y -= pixelsPerCm) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = '#999999'; // A bit darker grey for the axes
    ctx.lineWidth = 1.5;
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY); // X-axis
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height); // Y-axis
    ctx.stroke();

    // Ticks and labels
    ctx.fillStyle = '#666666';
    ctx.font = '12px sans-serif';

    // Labels on X-axis
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 1; originX + i * pixelsPerCm < width; i++) { ctx.fillText(i, originX + i * pixelsPerCm, originY + tickSize + 2); }
    for (let i = 1; originX - i * pixelsPerCm > 0; i++) { ctx.fillText(-i, originX - i * pixelsPerCm, originY + tickSize + 2); }

    // Labels on Y-axis
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 1; originY - i * pixelsPerCm > 0; i++) { ctx.fillText(i, originX - tickSize - 2, originY - i * pixelsPerCm); }
    for (let i = 1; originY + i * pixelsPerCm < height; i++) { ctx.fillText(-i, originX - tickSize - 2, originY + i * pixelsPerCm); }

    // Origin label '0'
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('0', originX - 5, originY + 5);
}