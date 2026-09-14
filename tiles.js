// ============================================
// РАСКЛАДКА ПЛИТКИ
// ============================================

const tileState = {
    mode: 'walls',           // 'walls' | 'tiles'
    tileLength: 600,         // мм
    tileWidth: 600,          // мм
    jointWidth: 2,           // мм
    layoutType: 'straight',  // 'straight' | 'diagonal' | 'offset' | 'transverse'
    gridOffsetX: 0,          // смещение сетки по X (мм)
    gridOffsetY: 0,          // смещение сетки по Y (мм)
    startCorner: 0,        // НОВОЕ: индекс стартового угла (0 = первая точка)
    hoveredCorner: -1,     // НОВОЕ: индекс угла под курсором (для hover)
};

// ============================================
// ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ
// ============================================

function toggleMode() {
    tileState.mode = tileState.mode === 'walls' ? 'tiles' : 'walls';
    document.getElementById('status').textContent = 
        tileState.mode === 'walls' ? '📐 Режим: рисование стен' : '🧱 Режим: раскладка плитки';
    
    if (tileState.mode === 'tiles') {
        updateTileParams();
    }
}

// ============================================
// ОБНОВЛЕНИЕ ПАРАМЕТРОВ ИЗ ПОЛЕЙ ВВОДА
// ============================================

function updateTileParams() {
    const lengthInput = document.getElementById('tileLength');
    const widthInput = document.getElementById('tileWidth');
    const jointInput = document.getElementById('jointWidth');
    const layoutSelect = document.getElementById('layoutType');
    
    if (lengthInput) tileState.tileLength = parseFloat(lengthInput.value) || 600;
    if (widthInput) tileState.tileWidth = parseFloat(widthInput.value) || 600;
    if (jointInput) tileState.jointWidth = parseFloat(jointInput.value) || 2;
    if (layoutSelect) tileState.layoutType = layoutSelect.value;
}

// ============================================
// ОБРАБОТКА КЛИКА ПО УГЛУ
// ============================================

function handleCornerClick(e) {
    if (tileState.mode !== 'tiles' || !state.isClosed) return false;
    
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - currentOffsetX) / currentScale;
    const my = (e.clientY - rect.top - currentOffsetY) / currentScale;
    
    const hitRadiusM = 20 / currentScale; // 20 пикселей в метрах
    
    let nearestIndex = -1;
    let nearestDist = Infinity;
    
    state.points.forEach((p, i) => {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestIndex = i;
        }
    });
    
    if (nearestIndex !== -1 && nearestDist < hitRadiusM) {
        tileState.startCorner = nearestIndex;
        console.log(`🎯 Стартовый угол изменён на №${nearestIndex + 1}`);
        draw();
        return true;
    }
    
    return false;
}

// ============================================
// ОБРАБОТКА НАВЕДЕНИЯ НА УГОЛ (hover)
// ============================================

function handleCornerHover(e) {
    if (tileState.mode !== 'tiles' || !state.isClosed) {
        tileState.hoveredCorner = -1;
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - currentOffsetX) / currentScale;
    const my = (e.clientY - rect.top - currentOffsetY) / currentScale;
    
    const hitRadiusM = 20 / currentScale;
    
    let nearestIndex = -1;
    let nearestDist = Infinity;
    
    state.points.forEach((p, i) => {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestIndex = i;
        }
    });
    
    if (nearestIndex !== -1 && nearestDist < hitRadiusM) {
        tileState.hoveredCorner = nearestIndex;
        canvas.style.cursor = 'pointer';
    } else {
        tileState.hoveredCorner = -1;
        canvas.style.cursor = 'default';
    }
}

// ============================================
// РАСЧЁТ И ОТРИСОВКА ПЛИТКИ
// ============================================

// ============================================
// ГЛАВНАЯ ТОЧКА ВХОДА РАСКЛАДКИ
// ============================================

function drawTiles(ctx, scale, offsetX, offsetY) {
    if (state.points.length < 3 || !state.isClosed) return;
    updateTileParams();

    if (tileState.layoutType === 'diagonal') {
        drawTilesDiagonal(ctx, scale, offsetX, offsetY);
    } else {
        drawTilesDirect(ctx, scale, offsetX, offsetY);
    }
}

// ============================================
// 1. ДИАГОНАЛЬНАЯ РАСКЛАДКА (Изолированный модуль)
// ============================================

function drawTilesDiagonal(ctx, scale, offsetX, offsetY) {
    let tileW = tileState.tileWidth / 1000;
    let tileH = tileState.tileLength / 1000;
    const joint = tileState.jointWidth / 1000;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    });

    const startCornerPoint = state.points[tileState.startCorner] || state.points[0];
    const roomCenterX = (minX + maxX) / 2;
    const roomCenterY = (minY + maxY) / 2;

    // Свои индивидуальные направления векторов внутрь комнаты для каждого угла
    const dirX = startCornerPoint.x <= roomCenterX ? 1 : -1;
    const dirY = startCornerPoint.y <= roomCenterY ? 1 : -1;

    const cos45 = Math.SQRT1_2;
    const sin45 = Math.SQRT1_2;

    const u = { x: cos45 * dirX, y: sin45 * dirY };
    const v = { x: -sin45 * dirX, y: cos45 * dirY };

    const stepU = tileW + joint;
    const stepV = tileH + joint;

    const anchorX = startCornerPoint.x + (tileState.gridOffsetX / 1000);
    const anchorY = startCornerPoint.y + (tileState.gridOffsetY / 1000);

    const roomWidth = maxX - minX;
    const roomHeight = maxY - minY;
    const maxDiagonal = Math.sqrt(roomWidth * roomWidth + roomHeight * roomHeight);

    const stepsU = Math.ceil(maxDiagonal / stepU) + 2;
    const stepsV = Math.ceil(maxDiagonal / stepV) + 2;

    let fullTiles = 0;
    let cutTiles = 0;
    
    // Эпсилон безопасности (3 мм) для отсечения касаний в 1px
    const marginEps = 0.003; 

    for (let i = -stepsU; i <= stepsU; i++) {
        for (let j = -stepsV; j <= stepsV; j++) {
            const baseX = anchorX + i * stepU * u.x + j * stepV * v.x;
            const baseY = anchorY + i * stepU * u.y + j * stepV * v.y;

            const tileCorners = [
                { x: baseX, y: baseY },
                { x: baseX + tileW * u.x, y: baseY + tileW * u.y },
                { x: baseX + tileW * u.x + tileH * v.x, y: baseY + tileW * u.y + tileH * v.y },
                { x: baseX + tileH * v.x, y: baseY + tileH * v.y }
            ];

            const centerX = baseX + (tileW * u.x + tileH * v.x) / 2;
            const centerY = baseY + (tileW * u.y + tileH * v.y) / 2;

            // Проверка вершин со сдвигом внутрь плитки на 3 мм
            let insideCount = 0;
            for (const c of tileCorners) {
                const checkX = c.x + (centerX - c.x) * marginEps;
                const checkY = c.y + (centerY - c.y) * marginEps;
                if (isPointInsidePolygon(checkX, checkY, state.points)) {
                    insideCount++;
                }
            }

            const isCenterInside = isPointInsidePolygon(centerX, centerY, state.points);

            if (insideCount === 4) {
                fullTiles++;
                drawPolygonTile(ctx, tileCorners, scale, offsetX, offsetY, '#4CAF50', false, u, v, joint);
            } else if (insideCount > 0 || isCenterInside) {
                // Жесткая проверка: центр плитки не должен уходить за габариты комнаты
                if (centerX >= minX - (tileW / 2) && centerX <= maxX + (tileW / 2) &&
                    centerY >= minY - (tileH / 2) && centerY <= maxY + (tileH / 2)) {
                    cutTiles++;
                    drawPolygonTile(ctx, tileCorners, scale, offsetX, offsetY, '#FF9800', true, u, v, joint);
                }
            }
        }
    }

    renderTileOverlay(ctx, scale, offsetX, offsetY, fullTiles, cutTiles, true);
}

// ============================================
// 2. ПРЯМАЯ И ПОПЕРЕЧНАЯ РАСКЛАДКА
// ============================================

function drawTilesDirect(ctx, scale, offsetX, offsetY) {
    let tileW = tileState.tileWidth / 1000;
    let tileH = tileState.tileLength / 1000;
    const joint = tileState.jointWidth / 1000;

    if (tileState.layoutType === 'transverse') {
        [tileW, tileH] = [tileH, tileW];
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    });

    const startCornerPoint = state.points[tileState.startCorner] || state.points[0];
    const goRight = startCornerPoint.x <= (minX + maxX) / 2;
    const goUp = startCornerPoint.y <= (minY + maxY) / 2;

    const stepX = tileW + joint;
    const stepY = tileH + joint;

    const originX = goRight ? startCornerPoint.x : (startCornerPoint.x - stepX);
    const originY = goUp ? startCornerPoint.y : (startCornerPoint.y - stepY);

    const phaseX = ((originX - minX) % stepX + stepX) % stepX;
    const phaseY = ((originY - minY) % stepY + stepY) % stepY;

    const startGridX = minX + phaseX - stepX;
    const startGridY = minY + phaseY - stepY;

    const endGridX = maxX + stepX;
    const endGridY = maxY + stepY;

    const offsetX_m = tileState.gridOffsetX / 1000;
    const offsetY_m = tileState.gridOffsetY / 1000;

    let fullTiles = 0;
    let cutTiles = 0;
    const eps = 0.0001;

    // Для раскладки со смещением расширяем диапазон на 1 шаг влево и вправо
    const extraSteps = tileState.layoutType === 'offset' ? stepX : 0;
    const loopStartX = startGridX - extraSteps;
    const loopEndX = endGridX + extraSteps;

    for (let x = loopStartX; x <= loopEndX + 1e-5; x += stepX) {
        for (let y = startGridY; y <= endGridY + 1e-5; y += stepY) {
            let shiftX = 0;
            if (tileState.layoutType === 'offset') {
                const rowIndex = Math.round((y - startGridY) / stepY);
                if (Math.abs(rowIndex) % 2 === 1) { // Math.abs защищает от отрицательных индексов
                    shiftX = stepX / 2;
                }
            }
            
            const tileX = x + offsetX_m + shiftX;
            const tileY = y + offsetY_m;

            const corners = [
                { x: tileX + eps, y: tileY + eps },
                { x: tileX + tileW - eps, y: tileY + eps },
                { x: tileX + tileW - eps, y: tileY + tileH - eps },
                { x: tileX + eps, y: tileY + tileH - eps }
            ];

            let insideCount = 0;
            for (const corner of corners) {
                if (isPointInsidePolygon(corner.x, corner.y, state.points)) {
                    insideCount++;
                }
            }

            if (insideCount === 4) {
                fullTiles++;
                drawSingleTile(ctx, tileX, tileY, tileW, tileH, scale, offsetX, offsetY, '#4CAF50', false, joint);
            } else if (insideCount > 0) {
                cutTiles++;
                drawSingleTile(ctx, tileX, tileY, tileW, tileH, scale, offsetX, offsetY, '#FF9800', true, joint);
            }
        }
    }

    renderTileOverlay(ctx, scale, offsetX, offsetY, fullTiles, cutTiles, false);
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЙ РЕНДЕР ИНТЕРФЕЙСА УГЛОВ И СТАТИСТИКИ
// ============================================

function renderTileOverlay(ctx, scale, offsetX, offsetY, fullTiles, cutTiles, isDiagonal) {
    state.points.forEach((p, i) => {
        const px = p.x * scale + offsetX;
        const py = p.y * scale + offsetY;
        
        const isStart = (i === tileState.startCorner);
        const isHovered = (i === tileState.hoveredCorner);
        const radius = isStart ? 10 : (isHovered ? 9 : 7);
        
        ctx.fillStyle = isStart ? '#ff0000' : (isHovered ? '#ff6600' : '#2980b9');
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(i + 1, px, py - radius - 3);
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(10, 10, 360, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isDiagonal ? '🧱 Диагональная раскладка от угла №' + (tileState.startCorner + 1) : '🖱️ Кликните по углу для выбора старта', 20, 26);

        // Статистика
        const statsY = canvas.height - 100;  // ← подняли выше, чтобы влезла подсказка
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(10, statsY, 340, 100);  // ← шире и выше
        ctx.fillStyle = '#ffffff';
        ctx.font = '13px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`✅ Целых: ${fullTiles} шт`, 20, statsY + 10);
        ctx.fillText(`✂️ С подрезкой: ${cutTiles} шт`, 20, statsY + 35);
        
        // Подсказка про переиспользование обрезков
        ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';  // жёлтый цвет
        ctx.font = '14px Segoe UI, sans-serif';
        ctx.fillText(`💡 Совет: обрезки можно переиспользовать —`, 20, statsY + 60);
        ctx.fillText(`   реальное количество может быть меньше`, 20, statsY + 76);
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function isPointInsidePolygon(px, py, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function drawSingleTile(ctx, x, y, w, h, scale, offsetX, offsetY, color, isCut, joint) {
    const px = x * scale + offsetX;
    const py = y * scale + offsetY;
    const pw = w * scale;
    const ph = h * scale;
    
    const jointPx = (joint || 0) * scale * 3;
    
    ctx.fillStyle = color;
    ctx.globalAlpha = isCut ? 0.6 : 0.8;
    ctx.fillRect(px, py, pw - jointPx, ph - jointPx);
    ctx.globalAlpha = 1.0;
    
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px, py, pw - jointPx, ph - jointPx);
    
    if (isCut) {
        ctx.strokeStyle = 'rgba(255,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + pw - jointPx, py + ph - jointPx);
        ctx.moveTo(px + pw - jointPx, py);
        ctx.lineTo(px, py + ph - jointPx);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// Отрисовка повернутых плиток произвольной формы (для диагонали)
function drawPolygonTile(ctx, corners, scale, offsetX, offsetY, color, isCut, u, v, joint) {
    const jointPx = (joint || 0) * scale * 3;
    
    // Перевод координат в пиксели холста
    const screenCorners = corners.map(c => ({
        x: c.x * scale + offsetX,
        y: c.y * scale + offsetY
    }));

    // Сдвиг граней внутрь для визуализации межплиточного шва
    if (jointPx > 0) {
        const shiftX = (u.x + v.x) * (jointPx / 2);
        const shiftY = (u.y + v.y) * (jointPx / 2);
        screenCorners[1].x -= u.x * jointPx;
        screenCorners[1].y -= u.y * jointPx;
        screenCorners[2].x -= shiftX;
        screenCorners[2].y -= shiftY;
        screenCorners[3].x -= v.x * jointPx;
        screenCorners[3].y -= v.y * jointPx;
    }

    ctx.fillStyle = color;
    ctx.globalAlpha = isCut ? 0.6 : 0.8;

    ctx.beginPath();
    ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
    for (let k = 1; k < 4; k++) {
        ctx.lineTo(screenCorners[k].x, screenCorners[k].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (isCut) {
        ctx.strokeStyle = 'rgba(255,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
        ctx.lineTo(screenCorners[2].x, screenCorners[2].y);
        ctx.moveTo(screenCorners[1].x, screenCorners[1].y);
        ctx.lineTo(screenCorners[3].x, screenCorners[3].y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

window.tileState = tileState;
window.toggleMode = toggleMode;
window.drawTiles = drawTiles;
window.updateTileParams = updateTileParams;

document.addEventListener('DOMContentLoaded', () => {
    const modeBtn = document.getElementById('modeToggleBtn');
    const tileControls = document.getElementById('tileControls');

    if (modeBtn) {
        modeBtn.addEventListener('click', () => {
            toggleMode();
            
            if (tileState.mode === 'tiles') {
                modeBtn.textContent = '📐 Режим стен';
                modeBtn.style.borderColor = '#e94560';
                if (tileControls) tileControls.style.display = 'block';
                if (typeof draw === 'function') draw();
            } else {
                modeBtn.textContent = '🧱 Режим плитки';
                modeBtn.style.borderColor = '#64ffda';
                if (tileControls) tileControls.style.display = 'none';
                if (typeof draw === 'function') draw();
            }
        });
    }
});

window.handleCornerClick = handleCornerClick;
window.handleCornerHover = handleCornerHover;