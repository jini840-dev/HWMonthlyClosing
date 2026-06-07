/**
 * 마감 통계 분석 자동화 시스템 - 핵심 분석 엔진
 */

// --- 전역 상태 ---
let allData = [];
let vaActualData = [];
let currentMonthRows = [];
let sortConfig = { key: null, direction: 'asc' };

// --- DOM 요소 ---
const elements = {
    inputs: {
        general: document.getElementById('raw-data-input-general'),
        va: document.getElementById('raw-data-input-va')
    },
    processBtn: document.getElementById('process-data-btn'),
    loadBtn: document.getElementById('load-raw-btn'),
    clearBtn: document.getElementById('clear-btn'),
    fileInputs: {
        general: document.getElementById('file-upload-input-general'),
        va: document.getElementById('file-upload-input-va')
    },
    fileNameDisplays: {
        general: document.getElementById('file-name-general'),
        va: document.getElementById('file-name-va')
    },
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    dashboard: document.getElementById('dashboard-view'),
    errorBox: document.getElementById('error-log-container'),
    errorList: document.getElementById('error-list'),
    vaSection: document.getElementById('va-correlation-section'),
    stats: {
        totalProc: document.getElementById('stat-total-proc'),
        totalReg: document.getElementById('stat-total-reg'),
        peakTime: document.getElementById('stat-peak-time'),
        yoyVal: document.getElementById('stat-yoy-val'),
        yoyDelta: document.getElementById('stat-yoy-delta'),
        vaApp: document.getElementById('va-app-count'),
        vaDep: document.getElementById('va-dep-count'),
        vaConv: document.getElementById('va-conv-rate')
    },
    visuals: {
        channelShares: document.getElementById('channel-shares'),
        methodShares: document.getElementById('method-shares'),
        timeLoad: document.getElementById('time-load-analysis'),
        vaTimeComp: document.getElementById('va-time-comparison')
    },
    summaryTable: document.getElementById('monthly-summary-body'),
    dataTable: document.getElementById('table-body')
};

// --- 탭 전환 로직 ---
elements.tabBtns.forEach(btn => {
    btn.onclick = () => {
        elements.tabBtns.forEach(b => b.classList.remove('active'));
        elements.tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-content-${btn.dataset.tab}`).classList.add('active');
    };
});

// --- 1. 데이터 파서 (범용) ---
function parseData(text) {
    if (!text) return [];
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

function parseNum(v) { return parseInt(v.toString().replace(/,/g, '')) || 0; }
function formatDate(d) {
    const s = d.toString().replace(/-/g, '');
    return s.length === 8 ? `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}` : d;
}
function formatTime(t) {
    const ts = t.toString();
    if (ts.includes(':')) {
        const p = ts.split(':');
        const h = p[0].padStart(2, '0');
        const m = p[1].padStart(2, '0');
        return `${h}:${m} ~ ${h}:59`;
    }
    const h = ts.padStart(2, '0');
    return `${h}:00 ~ ${h}:29`;
}

// --- 2. 분석 및 집계 ---
function analyze() {
    const generalText = elements.inputs.general.value;
    allData = parseData(generalText);
    
    if (allData.length === 0) {
        alert('기본 마감 통계 데이터를 입력해주세요.');
        return;
    }

    const yms = [...new Set(allData.map(d => d.ym))].sort().reverse();
    const currentYM = yms[0];
    currentMonthRows = allData.filter(d => d.ym === currentYM);

    const vaText = elements.inputs.va.value;
    vaActualData = parseData(vaText);
    const vaCurrentRows = vaActualData.filter(d => d.ym === currentYM);

    const currentStats = aggregate(currentMonthRows);
    const tsResults = aggregateTimeSeries(allData, currentYM);
    const vaStats = analyzeVAProcess(currentMonthRows, vaCurrentRows);

    render(currentStats, tsResults, vaStats);
}

function aggregate(rows) {
    const res = { totalProc: 0, totalReg: 0, channelMap: {}, methodMap: {}, timeMap: {}, peakTime: '-' };
    rows.forEach(r => {
        res.totalProc += r.procCount;
        res.totalReg += r.regCount;
        res.channelMap[r.channel] = (res.channelMap[r.channel] || 0) + r.procCount;
        
        let methodName = r.method;
        if(methodName === '가상계좌입금') methodName = '가상계좌 신청';
        res.methodMap[methodName] = (res.methodMap[methodName] || 0) + r.procCount;
        
        res.timeMap[r.time] = (res.timeMap[r.time] || 0) + r.procCount;
    });

    const sortedTimes = Object.entries(res.timeMap).sort((a,b) => b[1] - a[1]);
    if (sortedTimes.length > 0) res.peakTime = sortedTimes[0][0].split(' ~ ')[0];

    return res;
}

function analyzeVAProcess(generalRows, vaActualRows) {
    const appRows = generalRows.filter(r => r.method === '가상계좌입금');
    const appCount = appRows.reduce((a, b) => a + b.procCount, 0);
    const depCount = vaActualRows.reduce((a, b) => a + b.procCount, 0);

    const timeAppMap = {};
    const timeDepMap = {};

    appRows.forEach(r => {
        const h = r.time.split(':')[0];
        timeAppMap[h] = (timeAppMap[h] || 0) + r.procCount;
    });
    vaActualRows.forEach(r => {
        const h = r.time.split(':')[0];
        timeDepMap[h] = (timeDepMap[h] || 0) + r.procCount;
    });

    return {
        appCount,
        depCount,
        convRate: appCount > 0 ? ((depCount / appCount) * 100).toFixed(1) : 0,
        timeAppMap,
        timeDepMap
    };
}

function aggregateTimeSeries(data, curYM) {
    const getYM = (base, offset) => {
        const d = new Date(parseInt(base.substring(0,4)), parseInt(base.substring(4,6)) - 1 - offset, 1);
        return d.getFullYear() + (d.getMonth() + 1).toString().padStart(2, '0');
    };
    const targetYMs = { cur: curYM, m1: getYM(curYM, 1), m2: getYM(curYM, 2), m3: getYM(curYM, 3), yoy: getYM(curYM, 12) };
    const summary = {};
    for (const [key, ym] of Object.entries(targetYMs)) {
        const filtered = data.filter(d => d.ym === ym);
        summary[key] = { ym, proc: filtered.reduce((a, b) => a + b.procCount, 0), reg: filtered.reduce((a, b) => a + b.regCount, 0) };
    }
    return summary;
}

// --- 3. UI 렌더링 ---
function render(cur, ts, va) {
    elements.dashboard.classList.remove('hidden');
    
    elements.stats.totalProc.textContent = cur.totalProc.toLocaleString();
    elements.stats.totalReg.textContent = cur.totalReg.toLocaleString();
    elements.stats.peakTime.textContent = cur.peakTime;

    const yoy = ts.yoy;
    elements.stats.yoyVal.textContent = yoy.proc.toLocaleString();
    const yoyDiff = cur.totalProc - yoy.proc;
    const yoyPer = yoy.proc > 0 ? ((yoyDiff / yoy.proc) * 100).toFixed(1) : 0;
    elements.stats.yoyDelta.innerHTML = `<span class="${yoyDiff >= 0 ? 'up' : 'down'}">${yoyDiff >= 0 ? '▲' : '▼'} ${Math.abs(yoyPer)}%</span>`;

    renderShare(elements.visuals.channelShares, cur.channelMap, cur.totalProc);
    renderShare(elements.visuals.methodShares, cur.methodMap, cur.totalProc);

    const maxVal = Math.max(...Object.values(cur.timeMap), 1);
    elements.visuals.timeLoad.innerHTML = Object.keys(cur.timeMap).sort().map(t => {
        const h = (cur.timeMap[t] / maxVal) * 100;
        return `<div class="load-bar-wrapper"><div class="load-bar" style="height:${h}%"></div><div class="load-label">${t.split(':')[0]}</div></div>`;
    }).join('');

    if (va.appCount > 0 || va.depCount > 0) {
        elements.vaSection.classList.remove('hidden');
        elements.stats.vaApp.textContent = va.appCount.toLocaleString() + '건';
        elements.stats.vaDep.textContent = va.depCount.toLocaleString() + '건';
        elements.stats.vaConv.textContent = va.convRate + '%';

        const allHours = [...new Set([...Object.keys(va.timeAppMap), ...Object.keys(va.timeDepMap)])].sort();
        const maxVA = Math.max(...Object.values(va.timeAppMap), ...Object.values(va.timeDepMap), 1);
        
        elements.visuals.vaTimeComp.innerHTML = allHours.map(h => {
            const hApp = ((va.timeAppMap[h] || 0) / maxVA) * 100;
            const hDep = ((va.timeDepMap[h] || 0) / maxVA) * 100;
            return `
                <div class="load-bar-wrapper dual">
                    <div class="dual-bars">
                        <div class="load-bar va-app" style="height:${hApp}%" title="신청: ${va.timeAppMap[h] || 0}건"></div>
                        <div class="load-bar va-dep" style="height:${hDep}%" title="입금: ${va.timeDepMap[h] || 0}건"></div>
                    </div>
                    <div class="load-label">${h}</div>
                </div>`;
        }).join('');
    } else {
        elements.vaSection.classList.add('hidden');
    }

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

    renderDataTable(currentMonthRows);
}

function renderShare(container, dataMap, total) {
    const items = Object.entries(dataMap).sort((a,b) => b[1] - a[1]);
    container.innerHTML = items.map(([name, count]) => {
        const per = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        return `<div class="share-item"><div class="share-info"><span>${name}</span><span>${per}%</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${per}%"></div></div></div>`;
    }).join('');
}

function renderDataTable(data) {
    elements.dataTable.innerHTML = data.map(r => `
        <tr><td>${r.date}</td><td class="time-window">${r.time}</td><td>${r.type}</td>
        <td>${r.method}</td><td>${r.channel}</td><td class="num">${r.regCount.toLocaleString()}</td>
        <td class="num bold">${r.procCount.toLocaleString()}</td></tr>`).join('');
}

// --- 4. 파일 처리 ---
const setupFileUpload = (btnId, input, display, targetTextarea) => {
    const btn = document.getElementById(btnId);
    if (!btn || !input) return;
    btn.onclick = () => input.click();
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        display.textContent = file.name;
        const ext = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();
        if (ext === 'xlsx' || ext === 'xls') {
            reader.onload = (evt) => {
                const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
                targetTextarea.value = json.flat().filter(c => c !== null).join('\n');
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = (evt) => { targetTextarea.value = evt.target.result; };
            reader.readAsText(file);
        }
    };
};

setupFileUpload('file-upload-btn-general', elements.fileInputs.general, elements.fileNameDisplays.general, elements.inputs.general);
setupFileUpload('file-upload-btn-va', elements.fileInputs.va, elements.fileNameDisplays.va, elements.inputs.va);

// --- 나머지 이벤트 ---
elements.processBtn.onclick = analyze;
elements.loadBtn.onclick = async () => {
    try {
        const res1 = await fetch('/rawdata');
        elements.inputs.general.value = await res1.text();
        const res2 = await fetch('/rawdata2');
        if (res2.ok) elements.inputs.va.value = await res2.text();
        alert('모든 샘플 데이터가 로드되었습니다.');
    } catch (err) { alert('로드 실패: ' + err.message); }
};
elements.clearBtn.onclick = () => {
    elements.inputs.general.value = '';
    elements.inputs.va.value = '';
    elements.fileNameDisplays.general.textContent = '선택된 파일 없음';
    elements.fileNameDisplays.va.textContent = '선택된 파일 없음';
    elements.dashboard.classList.add('hidden');
};
