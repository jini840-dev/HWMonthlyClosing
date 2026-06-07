/**
 * Monthly Closing Report Automation - Core Engine
 */

// --- State Management ---
let reportData = [];
let sortConfig = { key: null, direction: 'asc' };

// --- DOM Elements ---
const elements = {
    input: document.getElementById('raw-data-input'),
    processBtn: document.getElementById('process-data-btn'),
    loadRawBtn: document.getElementById('load-raw-btn'),
    clearBtn: document.getElementById('clear-btn'),
    dashboard: document.getElementById('dashboard-view'),
    errorContainer: document.getElementById('error-log-container'),
    errorList: document.getElementById('error-list'),
    tableBody: document.getElementById('table-body'),
    tableHeaders: document.querySelectorAll('#table-headers th'),
    stats: {
        totalProc: document.getElementById('stat-total-proc'),
        totalReg: document.getElementById('stat-total-reg'),
        peakTime: document.getElementById('stat-peak-time'),
        topChannel: document.getElementById('stat-top-channel'),
        topShare: document.getElementById('stat-top-share')
    },
    visuals: {
        channelShares: document.getElementById('channel-shares'),
        timeLoad: document.getElementById('time-load-analysis')
    }
};

// --- [1] Dynamic Flat Text Parser ---
function parseRawData(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
    if (lines.length < 14) return []; // Header(7) + At least one Row(7)

    const rows = [];
    const headerCount = 7;
    
    // 8번째 라인(index 7)부터 7개 단위로 Chunking
    for (let i = headerCount; i < lines.length; i += 7) {
        const chunk = lines.slice(i, i + 7);
        if (chunk.length < 7) break;

        rows.push({
            date: formatDataDate(chunk[0]),
            time: formatDataTime(chunk[1]),
            type: chunk[2],
            method: chunk[3],
            channel: chunk[4],
            regCount: parseNumber(chunk[5]),
            procCount: parseNumber(chunk[6])
        });
    }
    return rows;
}

function parseNumber(val) {
    return Number(val.replace(/,/g, '')) || 0;
}

function formatDataDate(dateStr) {
    if (dateStr.length === 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
}

/**
 * 고도화된 시간대 분석 로직:
 * - "10" -> "10:00 ~ 10:29"
 * - "11:30" -> "11:30 ~ 11:59"
 */
function formatDataTime(timeStr) {
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        const h = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        return `${h}:${m} ~ ${h}:59`;
    } else {
        const h = timeStr.padStart(2, '0');
        return `${h}:00 ~ ${h}:29`;
    }
}

// --- [2] Data Integrity & Mandatory Hierarchy Check ---
function validateData(rows) {
    const errors = [];
    rows.forEach((row, index) => {
        const rowNum = index + 1;
        const validChannels = ['지점', '콜센터', '은행', '온라인', '한화생명앱', '홈페이지', '고객센터', '콜센터(ARS)'];
        if (row.type === '개별납' && (!row.channel || row.channel === '-' || row.channel === '미지정')) {
            errors.push(`Row ${rowNum}: '개별납' 데이터에 유효한 처리채널이 매핑되지 않았습니다.`);
        }
    });
    return errors;
}

// --- [3] Aggregation Engine ---
function aggregateData(rows) {
    const stats = {
        totalReg: 0,
        totalProc: 0,
        channelMap: {},
        timeMap: {}
    };

    rows.forEach(row => {
        stats.totalReg += row.regCount;
        stats.totalProc += row.procCount;

        // Channel Aggregation
        stats.channelMap[row.channel] = (stats.channelMap[row.channel] || 0) + row.procCount;

        // Time Aggregation (Density)
        stats.timeMap[row.time] = (stats.timeMap[row.time] || 0) + row.procCount;
    });

    return stats;
}

// --- [4] UI Rendering & Interaction ---
function renderUI(rows, errors) {
    // 1. Show/Hide Sections
    elements.dashboard.classList.remove('hidden');
    if (errors.length > 0) {
        elements.errorContainer.classList.remove('hidden');
        elements.errorList.innerHTML = errors.map(err => `<li>${err}</li>`).join('');
    } else {
        elements.errorContainer.classList.add('hidden');
    }

    // 2. Summary Stats
    const stats = aggregateData(rows);
    elements.stats.totalProc.textContent = stats.totalProc.toLocaleString();
    elements.stats.totalReg.textContent = stats.totalReg.toLocaleString();

    // Peak Time
    const sortedTimes = Object.entries(stats.timeMap).sort((a, b) => b[1] - a[1]);
    elements.stats.peakTime.textContent = sortedTimes.length > 0 ? sortedTimes[0][0].split(' ~ ')[0] : '-';

    // Top Channel
    const sortedChannels = Object.entries(stats.channelMap).sort((a, b) => b[1] - a[1]);
    if (sortedChannels.length > 0) {
        const [name, count] = sortedChannels[0];
        const share = ((count / stats.totalProc) * 100).toFixed(1);
        elements.stats.topChannel.textContent = name;
        elements.stats.topShare.textContent = share;
    }

    // 3. Channel Share Visualization
    elements.visuals.channelShares.innerHTML = sortedChannels.map(([name, count]) => {
        const share = ((count / stats.totalProc) * 100).toFixed(1);
        return `
            <div class="share-item">
                <div class="share-info">
                    <span>${name}</span>
                    <span>${share}% (${count.toLocaleString()}건)</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${share}%"></div></div>
            </div>
        `;
    }).join('');

    // 4. Time Load Analysis (Simple Bar View)
    const maxLoad = Math.max(...Object.values(stats.timeMap), 1);
    const sortedTimeKeys = Object.keys(stats.timeMap).sort();
    elements.visuals.timeLoad.innerHTML = sortedTimeKeys.map(time => {
        const count = stats.timeMap[time];
        const height = (count / maxLoad) * 100;
        const shortLabel = time.split(' ~ ')[0]; // Start time for label
        return `
            <div class="load-bar-wrapper">
                <div class="load-bar" style="height: ${height}%" title="${time}: ${count}건"></div>
                <div class="load-label">${shortLabel}</div>
            </div>
        `;
    }).join('');

    // 5. Data Table
    renderTable(rows);
}

function renderTable(rows) {
    elements.tableBody.innerHTML = rows.map(row => `
        <tr>
            <td>${row.date}</td>
            <td class="time-window">${row.time}</td>
            <td><span class="type-tag">${row.type}</span></td>
            <td>${row.method}</td>
            <td>${row.channel}</td>
            <td class="num">${row.regCount.toLocaleString()}</td>
            <td class="num bold">${row.procCount.toLocaleString()}</td>
        </tr>
    `).join('');
}

// --- Sorting Logic ---
function handleSort(key) {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
    }

    reportData.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];
        
        if (typeof valA === 'string') {
            return sortConfig.direction === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else {
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
    });

    renderTable(reportData);
    updateSortIcons();
}

function updateSortIcons() {
    elements.tableHeaders.forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.key === sortConfig.key) {
            th.classList.add(sortConfig.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

// --- Event Listeners ---
elements.processBtn.addEventListener('click', () => {
    const rawText = elements.input.value;
    const rows = parseRawData(rawText);
    
    if (rows.length === 0) {
        alert('유효한 데이터 형식이 아닙니다. 헤더 7줄과 본문 7줄 단위를 확인해 주세요.');
        return;
    }

    reportData = rows;
    const errors = validateData(rows);
    renderUI(rows, errors);
});

elements.loadRawBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/rawdata');
        if (!response.ok) throw new Error('파일을 불러올 수 없습니다.');
        const text = await response.text();
        elements.input.value = text;
        alert('샘플 데이터(rawdata)를 불러왔습니다. 분석 버튼을 눌러주세요.');
    } catch (err) {
        alert('에러: ' + err.message);
    }
});

elements.clearBtn.addEventListener('click', () => {
    elements.input.value = '';
    elements.dashboard.classList.add('hidden');
    elements.errorContainer.classList.add('hidden');
    reportData = [];
});

elements.tableHeaders.forEach(th => {
    th.addEventListener('click', () => handleSort(th.dataset.key));
});
