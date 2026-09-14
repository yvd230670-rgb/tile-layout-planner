// ============================================
// СОСТОЯНИЕ
// ============================================
const state = {
    points: [],          // координаты в МЕТРАХ (не в пикселях!)
    angles: [],          //  углы 
    tool: 'line',
    isClosed: false,
    mousePos: null,
    currentAngle: 0,      // начальное направление: вправо
    segmentLengths: [],  // длины в метрах (не в мм!)
};

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ МАСШТАБА
// ============================================
let currentScale = 1;
let currentOffsetX = 0;
let currentOffsetY = 0;
let zoom = 1.0;  // ← НОВОЕ: коэффициент масштаба (0.3 – 3.0)
// ============================================
// ЭЛЕМЕНТЫ DOM
// ============================================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvasWrapper');

// ============================================
// ФИКСИРОВАННЫЙ МАСШТАБ
// ============================================
const SCALE = 0.5; // 1 мм = 0.5 пикселя

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function getAngle(p1, p2) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function getPointAtAngleAndDistance(start, angle, distanceMeters) {
    return {
        x: start.x + Math.cos(angle) * distanceMeters,
        y: start.y + Math.sin(angle) * distanceMeters
    };
}

function getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function getDistanceMM(p1, p2) {
    return getDistance(p1, p2) / SCALE;
}

function getCenter(p1, p2) {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
    };
}

// ============================================
// МОДАЛЬНОЕ ОКНО
// ============================================
function showModal(title, defaultValue = '1.0') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(4px);
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #1a1a2e;
            border: 1px solid #2a3a5c;
            border-radius: 12px;
            padding: 30px 40px;
            min-width: 300px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        `;
        
        modal.innerHTML = `
            <h3 style="color: #e0e0e0; margin: 0 0 8px 0; font-size: 18px; font-weight: 500;">${title}</h3>
            <p style="color: #8892b0; margin: 0 0 16px 0; font-size: 13px;">Введите длину в метрах</p>
            <input type="text" id="modal-input" value="${defaultValue}" 
                   style="
                       width: 100%;
                       padding: 10px 14px;
                       background: #0d1b2a;
                       border: 1px solid #2a3a5c;
                       border-radius: 6px;
                       color: #e6f1ff;
                       font-size: 16px;
                       font-family: inherit;
                       outline: none;
                       box-sizing: border-box;
                   ">
            <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;">
                <button id="modal-cancel" style="
                    padding: 8px 20px;
                    background: transparent;
                    border: 1px solid #4a5a7a;
                    border-radius: 6px;
                    color: #8892b0;
                    font-size: 14px;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s;
                ">Отмена</button>
                <button id="modal-ok" style="
                    padding: 8px 24px;
                    background: #e94560;
                    border: none;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s;
                ">ОК</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const input = document.getElementById('modal-input');
        input.focus();
        input.select();
        
        function closeModal(value) {
            overlay.remove();
            resolve(value);
        }
        
        document.getElementById('modal-ok').addEventListener('click', () => {
            const val = input.value.trim();
            if (val === '') {
                closeModal(null);
                return;
            }
            const num = parseFloat(val);
            if (isNaN(num) || num <= 0) {
                alert('Введите корректное число');
                return;
            }
            closeModal(num);
        });
        
        document.getElementById('modal-cancel').addEventListener('click', () => {
            closeModal(null);
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('modal-ok').click();
            }
            if (e.key === 'Escape') {
                document.getElementById('modal-cancel').click();
            }
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(null);
            }
        });
    });
}

// ============================================
// ОТРИСОВКА
// ============================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5f7fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // === СТАРТОВАЯ ТОЧКА ===
    if (state.points.length === 0) {
        state.points = [{ x: 0, y: 0 }];
        state.currentAngle = 0;
    }

    // === ВЫЧИСЛЯЕМ МАСШТАБ И СМЕЩЕНИЕ ===
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (state.points.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        state.points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });

        const widthRange = maxX - minX;
        const heightRange = maxY - minY;
        const range = Math.max(widthRange, heightRange, 1);
        
        const padding = 60;
        const availableWidth = canvas.width - padding * 2;
        const availableHeight = canvas.height - padding * 2;
        
        const scaleX = availableWidth / (range * 1.15);
        const scaleY = availableHeight / (range * 1.15);
        scale = Math.min(scaleX, scaleY, 200);
        scale *= zoom;  // ← применяем масштаб
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        offsetX = canvas.width / 2 - centerX * scale;
        offsetY = canvas.height / 2 - centerY * scale;
    }

    // Сохраняем в глобальные переменные для доступа из tiles.js
    currentScale = scale;
    currentOffsetX = offsetX;
    currentOffsetY = offsetY;

    function toPixelX(mx) { return mx * scale + offsetX; }
    function toPixelY(my) { return my * scale + offsetY; }

    // === СЕТКА (привязана к метрам) ===
    const gridStepPx = 1 * scale;
    const minGridStep = 20;
    const maxGridStep = 80;

    let finalGridStep = gridStepPx;
    if (finalGridStep < minGridStep) {
        const ratios = [2, 5, 10, 20, 50, 100];
        for (const r of ratios) {
            const testStep = 1 * scale * r;
            if (testStep >= minGridStep) {
                finalGridStep = testStep;
                break;
            }
        }
    } else if (finalGridStep > maxGridStep) {
        const ratios = [0.5, 0.2, 0.1];
        for (const r of ratios) {
            const testStep = 1 * scale * r;
            if (testStep <= maxGridStep) {
                finalGridStep = testStep;
                break;
            }
        }
    }

    const visibleMinX = -offsetX / scale;
    const visibleMaxX = (canvas.width - offsetX) / scale;
    const visibleMinY = -offsetY / scale;
    const visibleMaxY = (canvas.height - offsetY) / scale;

    const gridStepM = finalGridStep / scale;
    const startX = Math.floor(visibleMinX / gridStepM) * gridStepM;
    const startY = Math.floor(visibleMinY / gridStepM) * gridStepM;
    const endX = Math.ceil(visibleMaxX / gridStepM) * gridStepM;
    const endY = Math.ceil(visibleMaxY / gridStepM) * gridStepM;

    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 0.5;

    for (let x = startX; x <= endX; x += gridStepM) {
        const px = x * scale + offsetX;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvas.height);
        ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridStepM) {
        const py = y * scale + offsetY;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.width, py);
        ctx.stroke();
    }

    // === ЖИРНАЯ СЕТКА (каждые 5 метров) ===
    const majorStep = 5;
    const majorStepPx = majorStep * scale;
    if (majorStepPx > minGridStep * 2) {
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        const startMajorX = Math.floor(visibleMinX / majorStep) * majorStep;
        const startMajorY = Math.floor(visibleMinY / majorStep) * majorStep;
        const endMajorX = Math.ceil(visibleMaxX / majorStep) * majorStep;
        const endMajorY = Math.ceil(visibleMaxY / majorStep) * majorStep;
        
        for (let x = startMajorX; x <= endMajorX; x += majorStep) {
            const px = x * scale + offsetX;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, canvas.height);
            ctx.stroke();
        }
        for (let y = startMajorY; y <= endMajorY; y += majorStep) {
            const py = y * scale + offsetY;
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(canvas.width, py);
            ctx.stroke();
        }
    }

    // === ОТРИСОВКА СТЕН (без изменений) ===
    if (state.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(toPixelX(state.points[0].x), toPixelY(state.points[0].y));
        for (let i = 1; i < state.points.length; i++) {
            ctx.lineTo(toPixelX(state.points[i].x), toPixelY(state.points[i].y));
        }
        ctx.strokeStyle = '#1a3a5c';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // === ЗАЛИВКА ===
    if (state.isClosed && state.points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(toPixelX(state.points[0].x), toPixelY(state.points[0].y));
        for (let i = 1; i < state.points.length; i++) {
            ctx.lineTo(toPixelX(state.points[i].x), toPixelY(state.points[i].y));
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(26, 58, 92, 0.08)';
        ctx.fill();
        ctx.strokeStyle = '#1a3a5c';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // === РАЗМЕРЫ ===
    if (state.points.length >= 2 && state.segmentLengths.length === state.points.length - 1) {
        for (let i = 0; i < state.points.length - 1; i++) {
            const p1 = state.points[i];
            const p2 = state.points[i + 1];
            const centerM = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            };
            const cx = toPixelX(centerM.x);
            const cy = toPixelY(centerM.y);
            const lengthM = state.segmentLengths[i];
            
            const text = `${lengthM.toFixed(2)} м`;
            ctx.font = 'bold 12px Segoe UI, sans-serif';
            const metrics = ctx.measureText(text);
            const tw = metrics.width;
            const th = 16;
            const tx = cx - tw / 2 - 6;
            const ty = cy - 14 - th;
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(tx, ty, tw + 12, th + 4, 4);
            } else {
                ctx.rect(tx, ty, tw + 12, th + 4);
            }
            ctx.fill();
            
            ctx.fillStyle = '#1a3a5c';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(text, cx, cy - 4);
        }
    }

    // === ТОЧКИ ===
    state.points.forEach((p, index) => {
        const px = toPixelX(p.x);
        const py = toPixelY(p.y);
        const radius = index === 0 ? 8 : 6;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);

        if (index === 0) {
            ctx.fillStyle = '#e67e22';
            ctx.shadowColor = 'rgba(230, 126, 34, 0.3)';
            ctx.shadowBlur = 10;
        } else {
            ctx.fillStyle = '#2980b9';
            ctx.shadowColor = 'rgba(41, 128, 185, 0.2)';
            ctx.shadowBlur = 8;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (state.points.length > 1) {
            ctx.fillStyle = 'rgba(44, 62, 122, 0.6)';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(index + 1, px, py - 12);
        }
    });

    // === ПУНКТИР ===
    if (!state.isClosed && state.points.length >= 2) {
        const last = state.points[state.points.length - 1];
        const first = state.points[0];
        const lx = toPixelX(last.x);
        const ly = toPixelY(last.y);
        const fx = toPixelX(first.x);
        const fy = toPixelY(first.y);
        
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(fx, fy);
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        const angle = Math.atan2(fy - ly, fx - lx);
        const arrowLen = 12;
        const arrowAngle = 0.5;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx - arrowLen * Math.cos(angle - arrowAngle), fy - arrowLen * Math.sin(angle - arrowAngle));
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx - arrowLen * Math.cos(angle + arrowAngle), fy - arrowLen * Math.sin(angle + arrowAngle));
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.stroke();

        const midX = (lx + fx) / 2;
        const midY = (ly + fy) / 2;
        ctx.fillStyle = 'rgba(231, 76, 60, 0.7)';
        ctx.font = '11px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('← замкнуть сюда', midX, midY - 8);
        
        const distM = Math.sqrt(
            Math.pow(last.x - first.x, 2) + 
            Math.pow(last.y - first.y, 2)
        );
        ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${distM.toFixed(2)} м`, midX, midY + 6);
    }

        // === ИНФО (показываем только в режиме стен) ===
        if (typeof window.tileState === 'undefined' || window.tileState.mode !== 'tiles') {
            if (state.isClosed) {
                ctx.fillStyle = '#27ae60';
                ctx.font = '14px Segoe UI, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText('✅ Контур замкнут', 16, 16);
            } else if (state.points.length === 1 && state.segmentLengths.length === 0) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                ctx.font = '16px Segoe UI, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🏁 Нажмите "Прямая" для первой стены', canvas.width / 2, canvas.height / 2 - 30);
                ctx.font = '13px Segoe UI, sans-serif';
                ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                ctx.fillText('(направление задано → вправо)', canvas.width / 2, canvas.height / 2);
            } else if (state.points.length > 1) {
                ctx.fillStyle = 'rgba(44, 62, 122, 0.5)';
                ctx.font = '12px Segoe UI, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                const angleDeg = state.currentAngle ? Math.round(state.currentAngle * 180 / Math.PI) : 0;
                ctx.fillText(`Стен: ${state.points.length - 1} | Направление: ${angleDeg}°`, 16, 16);
            }
        }

    // === РАСКЛАДКА ПЛИТКИ (если включена) ===
    if (typeof window.tileState !== 'undefined' && window.tileState && window.tileState.mode === 'tiles') {
        console.log('🟢 Режим плитки включён');
        if (typeof window.drawTiles === 'function') {
            window.drawTiles(ctx, scale, offsetX, offsetY);
        } else {
            ctx.fillStyle = 'rgba(233, 69, 96, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#e94560';
            ctx.font = '24px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🧱 Загрузка плитки...', canvas.width / 2, canvas.height / 2);
        }
    }
}

// ============================================
// ДОБАВЛЕНИЕ ТОЧКИ
// ============================================
// Клик по канвасу больше не нужен - просто показываем подсказку
canvas.addEventListener('click', (e) => {
    // Ничего не делаем, просто подсказка
    if (state.points.length === 1 && state.segmentLengths.length === 0) {
        document.getElementById('status').textContent = '👉 Нажмите "Прямая" для первой стены';
    }
});

// ============================================
// ИНСТРУМЕНТ "ПРЯМАЯ"
// ============================================
async function handleLineTool() {
    if (state.isClosed) return;

    const lastPoint = state.points[state.points.length - 1];
    
    // Модалка теперь в метрах
    const lengthM = await showModal('Введите длину стены (м)', '0');
    if (lengthM === null) return;
    
    const newPoint = getPointAtAngleAndDistance(lastPoint, state.currentAngle, lengthM);
    state.points.push(newPoint);
    state.segmentLengths.push(lengthM);
    state.angles.push(state.currentAngle);
    draw();
}

// ============================================
// ИНСТРУМЕНТЫ УГЛОВ
// ============================================
function handleOuterCorner() {
    if (state.points.length < 2) {
        alert('Сначала поставьте 2 точки (начало и направление)');
        return;
    }
    if (state.isClosed) return;

    state.currentAngle = state.currentAngle - Math.PI / 2;
    document.getElementById('status').textContent = `↺ Угол наружу: направление ${Math.round(state.currentAngle * 180 / Math.PI)}°`;
    draw();
}

function handleInnerCorner() {
    if (state.points.length < 2) {
        alert('Сначала поставьте 2 точки (начало и направление)');
        return;
    }
    if (state.isClosed) return;

    state.currentAngle = state.currentAngle + Math.PI / 2;
    document.getElementById('status').textContent = `↻ Угол внутрь: направление ${Math.round(state.currentAngle * 180 / Math.PI)}°`;
    draw();
}

// ============================================
// ЗАМЫКАНИЕ КОНТУРА
// ============================================
function closeContour() {
    if (state.points.length < 3) {
        alert('Минимум 3 точки для замыкания');
        return;
    }
    state.isClosed = true;
    document.getElementById('status').textContent = '✅ Контур замкнут';
    draw();
}

// ============================================
// СОБЫТИЯ МЫШИ
// ============================================
canvas.addEventListener('click', (e) => {
    // Если режим плитки — обрабатываем клик по углам
    if (typeof window.tileState !== 'undefined' && window.tileState.mode === 'tiles') {
        if (typeof window.handleCornerClick === 'function') {
            const handled = window.handleCornerClick(e);
            if (handled) return; // если клик обработан — выходим
        }
        return; // в режиме плитки больше ничего не делаем
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addPoint(x, y);
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    // Если режим плитки — обрабатываем hover на углы
    if (typeof window.tileState !== 'undefined' && window.tileState.mode === 'tiles') {
        if (typeof window.handleCornerHover === 'function') {
            window.handleCornerHover(e);
        }
    }
    
    draw();
});

canvas.addEventListener('mouseleave', () => {
    state.mousePos = null;
    if (typeof window.tileState !== 'undefined') {
        window.tileState.hoveredCorner = -1;
    }
    canvas.style.cursor = 'default';
    draw();
});

// ============================================
// КНОПКИ ИНСТРУМЕНТОВ
// ============================================
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.tool = btn.dataset.tool;
        
        switch (state.tool) {
            case 'line':
                handleLineTool();
                break;
            case 'outer':
                handleOuterCorner();
                break;
            case 'inner':
                handleInnerCorner();
                break;
        }
    });
});

// ============================================
// КНОПКИ УПРАВЛЕНИЯ
// ============================================
document.getElementById('clearBtn').addEventListener('click', () => {
    // Очищаем состояние комнаты
    state.points = [];
    state.angles = [];
    state.isClosed = false;
    state.currentAngle = 0;
    state.segmentLengths = [];
    
    // Очищаем поля ввода плитки
    const tileLengthInput = document.getElementById('tileLength');
    const tileWidthInput = document.getElementById('tileWidth');
    const jointInput = document.getElementById('jointWidth');
    const layoutSelect = document.getElementById('layoutType');
    const roomNameInput = document.getElementById('roomName');
    
    if (tileLengthInput) tileLengthInput.value = '';
    if (tileWidthInput) tileWidthInput.value = '';
    if (jointInput) jointInput.value = '';
    if (layoutSelect) layoutSelect.value = 'straight';  // Прямая по умолчанию
    if (roomNameInput) roomNameInput.value = '';
    
    // Сбрасываем tileState (если существует)
    if (typeof tileState !== 'undefined') {
        tileState.tileLength = 600;
        tileState.tileWidth = 600;
        tileState.jointWidth = 2;
        tileState.layoutType = 'straight';
        tileState.startCorner = 0;
        tileState.gridOffsetX = 0;
        tileState.gridOffsetY = 0;
        tileState.hoveredCorner = -1;
    }
    
    document.getElementById('status').textContent = '▶ Рисование контура';
    draw();
});

// ============================================
// КНОПКА "НАЗАД" (как в Flutter - за один клик)
// ============================================
document.getElementById('undoBtn').addEventListener('click', () => {
    if (state.points.length <= 1) return; // нельзя удалить стартовую точку
    
    // Удаляем последнюю стену
    state.points.pop();
    state.segmentLengths.pop();
    state.angles.pop();
    
    // Восстанавливаем угол из предыдущей стены
    if (state.angles.length > 0) {
        state.currentAngle = state.angles[state.angles.length - 1];
    } else {
        state.currentAngle = 0; // возвращаем начальное направление
    }
    
    if (state.isClosed && state.points.length < 3) {
        state.isClosed = false;
        document.getElementById('status').textContent = '▶ Рисование контура';
    }
    
    draw();
});

document.getElementById('closeBtn').addEventListener('click', closeContour);

canvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    closeContour();
});

// ============================================
// ГОРЯЧИЕ КЛАВИШИ
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
        document.getElementById('undoBtn').click();
    }
    if (e.key === 'Escape') {
        document.getElementById('clearBtn').click();
    }
    if (e.key === 'Enter' && e.ctrlKey) {
        document.getElementById('closeBtn').click();
    }
});

// ============================================
// УПРАВЛЕНИЕ МАСШТАБОМ
// ============================================

function updateZoomLabel() {
    const label = document.getElementById('zoomValue');
    if (label) label.textContent = Math.round(zoom * 100) + '%';
}

document.addEventListener('DOMContentLoaded', () => {
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            zoom = Math.min(zoom + 0.1, 3.0);
            updateZoomLabel();
            draw();
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            zoom = Math.max(zoom - 0.1, 0.3);
            updateZoomLabel();
            draw();
        });
    }
    
    updateZoomLabel();
});
// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function resizeCanvas() {
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    draw(); // просто перерисовываем, точка создастся в draw()
}