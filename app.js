/**
 * Monthly Closing Report Automation - Core Engine
 */

// --- State Management ---
let allRawRows = []; // 모든 기간의 데이터
let currentMonthData = []; // 기준월 데이터
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
    monthlySummaryBody: document.getElementById('monthly-summary-body'),
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
    },
    comparison: {
        mom1: { val: document.getElementById('val-mom-1'), delta: document.getElementById('delta-mom-1'), card: document.getElementById('card-mom-1') },
        mom2: { val: document.getElementById('val-mom-2'), delta: document.getElementById('delta-mom-2'), card: document.getElementById('card-mom-2') },
        mom3: { val: document.getElementById('val-mom-3'), delta: document.getElementById('delta-mom-3'), card: document.getElementById('card-mom-3') },
        yoy: { val: document.getElementById('val-yoy'), delta: document.getElementById('delta-yoy'), card: document.getElementById('card-yoy') }
    }
};

// --- [1] Dynamic Flat Text Parser ---
function parseRawData(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
    if (lines.length < 14) return [];

    const rows = [];
    const headerCount = 7;
    
    for (let i = headerCount; i < lines.length; i += 7) {
        const chunk = lines.slice(i, i + 7);
        if (chunk.length < 7) break;

        const rawDate = chunk[0].replace(/-/g, '');
        rows.push({
            date: formatDataDate(chunk[0]),
            yearMonth: rawDate.substring(0, 6), // YYYYMM
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
    const d = dateStr.replace(/-/g, '');
    if (d.length === 8) {
        return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
    }
    return dateStr;
}

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

// --- [3] Aggregation & Time-Series Engine ---

/**
 * 시계열 세그멘테이션 및 지표 계산
 */
function processTimeSeries(rows) {
    // 1. 기간 식별 (최신 월을 기준월로 설정)
    const yearMonths = [...new Set(rows.map(r => r.yearMonth))].sort().reverse();
    const currentYM = yearMonths[0]; // 예: 202603

    // 2. 동적 기간 계산 (Utility)
    function getOffsetYM(baseYM, monthOffset) {
        const y = parseInt(baseYM.substring(0, 4));
        const m = parseInt(baseYM.substring(4, 6));
        const date = new Date(y, m - 1 - monthOffset, 1);
        return date.getFullYear().toString() + (date.getMonth() + 1).toString().padStart(2, '0');
    }

    const targetYMs = {
        current: currentYM,
        mom1: getOffsetYM(currentYM, 1),
        mom2: getOffsetYM(currentYM, 2),
        mom3: getOffsetYM(currentYM, 3),
        yoy: getOffsetYM(currentYM, 12)
    };

    // 3. 그룹별 집계
    const summary = {};
    Object.entries(targetYMs).forEach(([key, ym]) => {
        const filtered = rows.filter(r => r.yearMonth === ym);
        summary[key] = {
            ym: ym,
            proc: filtered.reduce((acc, curr) => acc + curr.procCount, 0),
            reg: filtered.reduce((acc, curr) => acc + curr.regCount, 0),
            rows: filtered
        };
    });

    // 4. 비교 지표 산출 (Variance)
    const calcDelta = (curr, prev) => {
        if (!prev || prev === 0) return { diff: 0, percent: 0 };
        const diff = curr - prev;
        const percent = ((diff / prev) * 100).toFixed(1);
        return { diff, percent };
    };

    const results = {
        current: summary.current,
        mom1: { ...summary.mom1, delta: calcDelta(summary.current.proc, summary.mom1.proc) },
        mom2: { ...summary.mom2, delta: calcDelta(summary.current.proc, summary.mom2.proc) },
        mom3: { ...summary.mom3, delta: calcDelta(summary.current.proc, summary.mom3.proc) },
        yoy: { ...summary.yoy, delta: calcDelta(summary.current.proc, summary.yoy.proc) }
    };

    return results;
}

// --- [4] UI Rendering ---

function renderDashboard(tsResults) {
    elements.dashboard.classList.remove('hidden');
    
    // 1. 기준월 데이터 필터링 및 전역 상태 저장
    currentMonthData = tsResults.current.rows;
    const errors = validateData(currentMonthData);
    
    // 2. 에러 로그 출력
    if (errors.length > 0) {
        elements.errorContainer.classList.remove('hidden');
        elements.errorList.innerHTML = errors.map(err => `<li>${err}</li>`).join('');
    } else {
        elements.errorContainer.classList.add('hidden');
    }

    // 3. 시계열 비교 카드 렌더링
    const renderCard = (target, data) => {
        const { val, delta, card } = target;
        val.textContent = data.proc.toLocaleString();
        
        const d = data.delta;
        if (!data.ym || data.proc === 0) {
            delta.innerHTML = `<span class="delta-none">데이터 없음</span>`;
            card.className = 'card compare-card muted';
            return;
        }

        const isUp = d.diff > 0;
        const isDown = d.diff < 0;
        
        delta.innerHTML = `
            <span class="delta-badge ${isUp ? 'up' : (isDown ? 'down' : 'stable')}">
                ${isUp ? '▲' : (isDown ? '▼' : '-')} ${Math.abs(d.percent)}%
            </span>
            <span class="delta-diff">(${isUp ? '+' : ''}${d.diff.toLocaleString()})</span>
        `;
        
        card.className = `card compare-card ${isUp ? 'trend-up' : (isDown ? 'trend-down' : '')}`;
    };

    renderCard(elements.comparison.mom1, tsResults.mom1);
    renderCard(elements.comparison.mom2, tsResults.mom2);
    renderCard(elements.comparison.mom3, tsResults.mom3);
    renderCard(elements.comparison.yoy, tsResults.yoy);

    // 4. 기준월 요약 스탯
    elements.stats.totalProc.textContent = tsResults.current.proc.toLocaleString();
    elements.stats.totalReg.textContent = tsResults.current.reg.toLocaleString();

    // 당월 상세 집계 (채널, 시간)
    renderCurrentMonthDetails(currentMonthData);

    // 5. 월별 실적 요약 테이블 (Comparison Grid)
    renderMonthlyGrid(tsResults);

    // 6. 기준월 상세 테이블
    renderTable(currentMonthData);
}

function renderCurrentMonthDetails(rows) {
    const channelMap = {};
    const timeMap = {};
    rows.forEach(r => {
        channelMap[r.channel] = (channelMap[r.channel] || 0) + r.procCount;
        timeMap[r.time] = (timeMap[r.time] || 0) + r.procCount;
    });

    const total = rows.reduce((a, b) => a + b.procCount, 0);

    // Top Channel
    const sortedChannels = Object.entries(channelMap).sort((a, b) => b[1] - a[1]);
    if (sortedChannels.length > 0) {
        const [name, count] = sortedChannels[0];
        elements.stats.topChannel.textContent = name;
        elements.stats.topShare.textContent = ((count / total) * 100).toFixed(1);
    }

    // Peak Time
    const sortedTimes = Object.entries(timeMap).sort((a, b) => b[1] - a[1]);
    elements.stats.peakTime.textContent = sortedTimes.length > 0 ? sortedTimes[0][0].split(' ~ ')[0] : '-';

    // Channel Share Visualization
    elements.visuals.channelShares.innerHTML = sortedChannels.map(([name, count]) => {
        const share = ((count / total) * 100).toFixed(1);
        return `
            <div class="share-item">
                <div class="share-info"><span>${name}</span><span>${share}%</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${share}%"></div></div>
            </div>
        `;
    }).join('');

    // Time Load Analysis
    const maxLoad = Math.max(...Object.values(timeMap), 1);
    elements.visuals.timeLoad.innerHTML = Object.keys(timeMap).sort().map(time => {
        const count = timeMap[time];
        const height = (count / maxLoad) * 100;
        return `
            <div class="load-bar-wrapper">
                <div class="load-bar" style="height: ${height}%"></div>
                <div class="load-label">${time.split(':')[0]}</div>
            </div>
        `;
    }).join('');
}

function renderMonthlyGrid(ts) {
    const labels = {
        current: '당월 (Current)',
        mom1: '전월 (M-1)',
        mom2: '2개월 전 (M-2)',
        mom3: '3개월 전 (M-3)',
        yoy: '전년 동월 (YoY)'
    };

    const totalProcAll = Object.values(ts).reduce((acc, curr) => acc + curr.proc, 0);

    elements.monthlySummaryBody.innerHTML = Object.entries(ts).map(([key, data]) => {
        const share = totalProcAll > 0 ? ((data.proc / totalProcAll) * 100).toFixed(1) : 0;
        const delta = data.delta ? `
            <span class="${data.delta.diff > 0 ? 'text-up' : (data.delta.diff < 0 ? 'text-down' : '')}">
                ${data.delta.diff > 0 ? '▲' : (data.delta.diff < 0 ? '▼' : '')} ${Math.abs(data.delta.percent)}%
            </span>
        ` : '-';

        return `
            <tr>
                <td><strong>${labels[key]}</strong></td>
                <td>${data.ym || '-'}</td>
                <td class="num">${data.proc.toLocaleString()}</td>
                <td class="num">${share}%</td>
                <td class="num">${data.reg.toLocaleString()}</td>
                <td class="num">${delta}</td>
            </tr>
        `;
    }).join('');
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

// --- Interaction ---
function handleSort(key) {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
    }

    currentMonthData.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];
        if (typeof valA === 'string') return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });

    renderTable(currentMonthData);
    updateSortIcons();
}

function updateSortIcons() {
    elements.tableHeaders.forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.key === sortConfig.key) th.classList.add(sortConfig.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    });
}

// --- Events ---
elements.processBtn.addEventListener('click', () => {
    const rawText = elements.input.value;
    allRawRows = parseRawData(rawText);
    
    if (allRawRows.length === 0) {
        alert('데이터 형식이 올바르지 않습니다.');
        return;
    }

    const tsResults = processTimeSeries(allRawRows);
    renderDashboard(tsResults);
});

elements.loadRawBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/rawdata');
        const text = await response.text();
        elements.input.value = text;
        alert('샘플 데이터가 로드되었습니다.');
    } catch (err) { alert('에러: ' + err.message); }
});

elements.clearBtn.addEventListener('click', () => {
    elements.input.value = '';
    elements.dashboard.classList.add('hidden');
});

elements.tableHeaders.forEach(th => {
    th.addEventListener('click', () => handleSort(th.dataset.key));
});
