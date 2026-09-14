// ============================================
// СОХРАНЕНИЕ / ЗАГРУЗКА ПРОЕКТА
// ============================================

function saveProject() {
    // Собираем данные плитки (если tileState существует)
    const tileData = (typeof tileState !== 'undefined') ? {
        tileLength: tileState.tileLength,
        tileWidth: tileState.tileWidth,
        jointWidth: tileState.jointWidth,
        layoutType: tileState.layoutType,
        startCorner: tileState.startCorner,
        gridOffsetX: tileState.gridOffsetX,
        gridOffsetY: tileState.gridOffsetY,
    } : null;

    const data = {
        version: '1.0',
        roomName: document.getElementById('roomName')?.value || 'Комната',
        points: state.points,
        segmentLengths: state.segmentLengths,
        angles: state.angles,
        isClosed: state.isClosed,
        currentAngle: state.currentAngle,
        tile: tileData,   // ← ДОБАВЛЕНО
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.roomName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    document.getElementById('status').textContent = '💾 Проект сохранён';
}

function loadProject(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.version !== '1.0') {
                alert('Неизвестная версия файла');
                return;
            }

            // Восстанавливаем состояние комнаты
            state.points = data.points || [{ x: 0, y: 0 }];
            state.segmentLengths = data.segmentLengths || [];
            state.angles = data.angles || [];
            state.isClosed = data.isClosed || false;
            state.currentAngle = data.currentAngle || 0;

            // Восстанавливаем данные плитки (если есть)
            if (data.tile && typeof tileState !== 'undefined') {
                tileState.tileLength = data.tile.tileLength || 600;
                tileState.tileWidth = data.tile.tileWidth || 600;
                tileState.jointWidth = data.tile.jointWidth || 2;
                tileState.layoutType = data.tile.layoutType || 'straight';
                tileState.startCorner = data.tile.startCorner || 0;
                tileState.gridOffsetX = data.tile.gridOffsetX || 0;
                tileState.gridOffsetY = data.tile.gridOffsetY || 0;

                // Обновляем поля ввода в интерфейсе
                const tileLengthInput = document.getElementById('tileLength');
                const tileWidthInput = document.getElementById('tileWidth');
                const jointInput = document.getElementById('jointWidth');
                const layoutSelect = document.getElementById('layoutType');

                if (tileLengthInput) tileLengthInput.value = tileState.tileLength;
                if (tileWidthInput) tileWidthInput.value = tileState.tileWidth;
                if (jointInput) jointInput.value = tileState.jointWidth;
                if (layoutSelect) layoutSelect.value = tileState.layoutType;
            }

            // Обновляем имя комнаты
            if (data.roomName && document.getElementById('roomName')) {
                document.getElementById('roomName').value = data.roomName;
            }

            // ЕСЛИ в файле есть данные плитки — переключаемся в режим плитки
            if (data.tile && typeof tileState !== 'undefined') {
                tileState.mode = 'tiles';
                
                // Обновляем кнопку режима
                const modeBtn = document.getElementById('modeToggleBtn');
                const tileControls = document.getElementById('tileControls');
                if (modeBtn) {
                    modeBtn.textContent = '📐 Режим стен';
                    modeBtn.style.borderColor = '#e94560';
                }
                if (tileControls) {
                    tileControls.style.display = 'block';
                }
            } else {
                // Если данных плитки нет — остаёмся в режиме стен
                tileState.mode = 'walls';
                
                const modeBtn = document.getElementById('modeToggleBtn');
                const tileControls = document.getElementById('tileControls');
                if (modeBtn) {
                    modeBtn.textContent = '🧱 Режим плитки';
                    modeBtn.style.borderColor = '#64ffda';
                }
                if (tileControls) {
                    tileControls.style.display = 'none';
                }
            }

            document.getElementById('status').textContent = `📂 Загружен проект: ${data.roomName || 'без названия'}`;
            draw();
        } catch (err) {
            alert('Ошибка при загрузке файла: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// ============================================
// ДОБАВЛЕНИЕ КНОПОК СОХРАНЕНИЯ В ПАНЕЛЬ
// ============================================

function addSaveButtons() {
    const panel = document.getElementById('panel');
    const hr = panel.querySelector('hr:last-of-type');
    
    const saveDiv = document.createElement('div');
    saveDiv.style.cssText = 'margin-top: 12px; display: flex; flex-direction: column; gap: 6px;';
    saveDiv.innerHTML = `
        <div style="display: flex; gap: 6px;">
            <button id="saveBtn" class="btn btn-primary" style="flex:1;">💾 Сохранить</button>
            <button id="loadBtn" class="btn" style="flex:1;">📂 Загрузить</button>
        </div>
        <input type="file" id="fileInput" accept=".json" style="display:none;">
        <div style="display: flex; gap: 6px; margin-top: 4px;">
        <input type="text" id="roomName" placeholder="Название комнаты" 
           style="flex:1; padding: 6px 10px; background: #0d1b2a; border: 1px solid #1a3a5c; border-radius: 4px; color: #ffffff; font-size: 13px; width: 100%; box-sizing: border-box;">
        </div>
    `;
    
    if (hr) {
        panel.insertBefore(saveDiv, hr.nextSibling);
    } else {
        panel.appendChild(saveDiv);
    }

    document.getElementById('saveBtn').addEventListener('click', saveProject);
    
    document.getElementById('loadBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadProject(e.target.files[0]);
        }
        e.target.value = '';
    });
}

// Ждём загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSaveButtons);
} else {
    addSaveButtons();
}