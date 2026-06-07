/**
 * 마감 통계 분석 자동화 시스템 - 핵심 분석 엔진
 */

// --- 전역 상태 ---
let allData = [];
let currentMonthRows = [];
let sortConfig = { key: null, direction: 'asc' };

// --- DOM 요소 ---
const elements = {
    input: document.getElementById('raw-data-input'),
    processBtn: document.getElementById('process-data-btn'),
    loadBtn: document.getElementById('load-raw-btn'),
    clearBtn: document.getElementById('clear-btn'),
    dashboard: document.getElementById('dashboard-view'),
    errorBox: document.getElementById('error-log-container'),
    errorList: document.getElementById('error-list'),
    stats: {
        totalProc: document.getElementById('stat-total-proc'),
        totalReg: document.getElementById('stat-total-reg'),
        peakTime: document.getElementById('stat-peak-time'),
        yoyVal: document.getElementById('stat-yoy-val'),
        yoyDelta: document.getElementById('stat-yoy-delta')
    },
    visuals: {
        channelShares: document.getElementById('channel-shares'),
        timeLoad: document.getElementById('time-load-analysis')
    },
    summaryTable: document.getElementById('monthly-summary-body'),
    dataTable: document.getElementById('table-body')
};

// --- 1. 데이터 파서 (줄바꿈 기반 Chunking) ---
function parseData(text) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l !== '');
    if (lines.length < 14) return [];

    const result = [];
    for (let i = 7; i < lines.length; i += 7) {
        const chunk = lines.slice(i, i + 7);
        if (chunk.length < 7) break;

        const ym = chunk[0].replace(/-/g, '').substring(0, 6);
        result.push({
            date: formatDate(chunk[0]),
            ym: ym,
            time: formatTime(chunk[1]),
            type: chunk[2],
            method: chunk[3],
            channel: chunk[4],
            regCount: parseNum(chunk[5]),
            procCount: parseNum(chunk[6])
        });
    }
    return result;
}

function parseNum(v) { return parseInt(v.replace(/,/g, '')) || 0; }
function formatDate(d) {
    const s = d.replace(/-/g, '');
    return s.length === 8 ? `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}` : d;
}
function formatTime(t) {
    if (t.includes(':')) {
        const p = t.split(':');
        const h = p[0].padStart(2, '0');
        const m = p[1].padStart(2, '0');
        return `${h}:${m} ~ ${h}:59`;
    }
    const h = t.padStart(2, '0');
    return `${h}:00 ~ ${h}:29`;
}

// --- 2. 데이터 검증 (Hierarchy Check) ---
function validate(rows) {
    const errs = [];
    rows.forEach((r, i) => {
        if (r.type === '개별납' && (!r.channel || r.channel === '-' || r.channel === '미지정')) {
            errs.push(`행 ${i+1}: 개별납 데이터에 유효한 채널이 없습니다.`);
        }
    });
    return errs;
}

// --- 3. 분석 및 집계 로직 ---
function analyze() {
    const raw = elements.input.value;
    allData = parseData(raw);
    if (allData.length === 0) {
        alert('분석할 데이터가 없습니다. 형식을 확인해주세요.');
        return;
    }

    // 기간 분류
    const yms = [...new Set(allData.map(d => d.ym))].sort().reverse();
    const currentYM = yms[0];
    currentMonthRows = allData.filter(d => d.ym === currentYM);

    // [당월 분석]
    const currentStats = aggregate(currentMonthRows);
    
    // [시계열 분석]
    const tsResults = aggregateTimeSeries(allData, currentYM);

    render(currentStats, tsResults);
}

function aggregate(rows) {
    const res = { totalProc: 0, totalReg: 0, channelMap: {}, timeMap: {}, peakTime: '-' };
    rows.forEach(r => {
        res.totalProc += r.procCount;
        res.totalReg += r.regCount;
        res.channelMap[r.channel] = (res.channelMap[r.channel] || 0) + r.procCount;
        res.timeMap[r.time] = (res.timeMap[r.time] || 0) + r.procCount;
    });

    const sortedTimes = Object.entries(res.timeMap).sort((a,b) => b[1] - a[1]);
    if (sortedTimes.length > 0) res.peakTime = sortedTimes[0][0].split(' ~ ')[0];

    return res;
}

function aggregateTimeSeries(data, curYM) {
    const getYM = (base, offset) => {
        const d = new Date(parseInt(base.substring(0,4)), parseInt(base.substring(4,6)) - 1 - offset, 1);
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        return y + m;
    };

    const targetYMs = {
        cur: curYM,
        m1: getYM(curYM, 1),
        m2: getYM(curYM, 2),
        m3: getYM(curYM, 3),
        yoy: getYM(curYM, 12)
    };

    const summary = {};
    for (const [key, ym] of Object.entries(targetYMs)) {
        const filtered = data.filter(d => d.ym === ym);
        summary[key] = {
            ym: ym,
            proc: filtered.reduce((a, b) => a + b.procCount, 0),
            reg: filtered.reduce((a, b) => a + b.regCount, 0)
        };
    }
    return summary;
}

// --- 4. UI 렌더링 ---
function render(cur, ts) {
    elements.dashboard.classList.remove('hidden');
    
    // 1. 최대 부하 시간대 및 요약
    elements.stats.totalProc.textContent = cur.totalProc.toLocaleString();
    elements.stats.totalReg.textContent = cur.totalReg.toLocaleString();
    elements.stats.peakTime.textContent = cur.peakTime;

    // YoY
    const yoy = ts.yoy;
    elements.stats.yoyVal.textContent = yoy.proc.toLocaleString();
    const yoyDiff = cur.totalProc - yoy.proc;
    const yoyPer = yoy.proc > 0 ? ((yoyDiff / yoy.proc) * 100).toFixed(1) : 0;
    elements.stats.yoyDelta.innerHTML = `<span class="${yoyDiff >= 0 ? 'up' : 'down'}">${yoyDiff >= 0 ? '▲' : '▼'} ${Math.abs(yoyPer)}%</span>`;

    // 2. 채널 점유율
    const channels = Object.entries(cur.channelMap).sort((a,b) => b[1] - a[1]);
    elements.visuals.channelShares.innerHTML = channels.map(([name, count]) => {
        const per = ((count / cur.totalProc) * 100).toFixed(1);
        return `<div class="share-item"><div class="share-info"><span>${name}</span><span>${per}%</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${per}%"></div></div></div>`;
    }).join('');

    // 3. 시간대별 부하
    const maxVal = Math.max(...Object.values(cur.timeMap), 1);
    elements.visuals.timeLoad.innerHTML = Object.keys(cur.timeMap).sort().map(t => {
        const h = (cur.timeMap[t] / maxVal) * 100;
        return `<div class="load-bar-wrapper"><div class="load-bar" style="height:${h}%"></div><div class="load-label">${t.split(':')[0]}</div></div>`;
    }).join('');

    // 4. 월별 실적 요약
    const summaryRows = [
        { label: '당월', data: ts.cur, prev: ts.m1 },
        { label: '전월(M-1)', data: ts.m1, prev: ts.m2 },
        { label: '2개월 전', data: ts.m2, prev: ts.m3 },
        { label: '3개월 전', data: ts.m3, prev: null },
        { label: '전년 동월', data: ts.yoy, prev: null }
    ];
    elements.summaryTable.innerHTML = summaryRows.map(r => {
        const diff = r.prev && r.prev.proc > 0 ? (((r.data.proc - r.prev.proc) / r.prev.proc) * 100).toFixed(1) : '-';
        return `<tr><td>${r.label}</td><td>${r.data.ym || '-'}</td><td class="num">${r.data.proc.toLocaleString()}</td>
                <td class="num">${r.data.reg.toLocaleString()}</td><td class="num">${diff}%</td></tr>`;
    }).join('');

    // 5. 상세 데이터
    renderDataTable(currentMonthRows);

    // 검증 결과
    const errs = validate(currentMonthRows);
    if (errs.length > 0) {
        elements.errorBox.classList.remove('hidden');
        elements.errorList.innerHTML = errs.map(e => `<li>${e}</li>`).join('');
    } else {
        elements.errorBox.classList.add('hidden');
    }
}

function renderDataTable(data) {
    elements.dataTable.innerHTML = data.map(r => `
        <tr><td>${r.date}</td><td class="time-window">${r.time}</td><td>${r.type}</td>
        <td>${r.method}</td><td>${r.channel}</td><td class="num">${r.regCount.toLocaleString()}</td>
        <td class="num bold">${r.procCount.toLocaleString()}</td></tr>`).join('');
}

// --- 이벤트 리스너 ---
elements.processBtn.onclick = analyze;
elements.loadBtn.onclick = async () => {
    try {
        const res = await fetch('/rawdata');
        const text = await res.text();
        elements.input.value = text;
        alert('샘플 데이터 로드 완료');
    } catch (err) {
        alert('로드 실패: ' + err.message);
    }
};
elements.clearBtn.onclick = () => {
    elements.input.value = '';
    elements.dashboard.classList.add('hidden');
    elements.errorBox.classList.add('hidden');
};
