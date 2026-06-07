/**
 * 마감 통계 분석 자동화 시스템 - 핵심 분석 엔진
 */

// --- 전역 상태 ---
let allData = [];
let vaActualData = [];
let currentMonthRows = [];
let sortConfig = { key: null, direction: 'asc' };
let vaChartInstance = null;
let loadChartInstance = null;

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
    exportBtns: {
        pdf: document.getElementById('export-pdf-btn'),
        excel: document.getElementById('export-excel-btn'),
        ppt: document.getElementById('export-ppt-btn'),
        email: document.getElementById('export-email-btn')
    },
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
        timeLoadCanvas: document.getElementById('timeLoadChart'),
        vaTimeChartCanvas: document.getElementById('vaTimeChart')
    },
    summaryTable: document.getElementById('monthly-summary-body'),
    dataTable: document.getElementById('table-body'),
    tableHeaders: document.querySelectorAll('#table-headers th')
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

// --- 1. 데이터 파서 ---
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
            timeKey: formatTimeKey(chunk[1]),
            timeDisplay: formatTimeDisplay(chunk[1]),
            timeShort: formatTimeShort(chunk[1]),
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
function formatTimeKey(t) {
    const ts = t.toString();
    if (ts.includes(':')) {
        const p = ts.split(':');
        return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
    }
    return `${ts.padStart(2, '0')}:00`;
}
function formatTimeDisplay(t) {
    const ts = t.toString();
    let hStr, mStr;
    if (ts.includes(':')) { const p = ts.split(':'); hStr = p[0]; mStr = p[1]; } 
    else { hStr = ts; mStr = '00'; }
    let h = parseInt(hStr, 10);
    const ampm = h < 12 ? 'AM' : 'PM';
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const padH = String(displayH).padStart(2, '0');
    return mStr === '30' ? `${ampm}${padH}시30분 ~ ${ampm}${padH}시59분59초` : `${ampm}${padH}시00분 ~ ${ampm}${padH}시29분59초`;
}
function formatTimeShort(t) {
    const ts = t.toString();
    let hStr, mStr;
    if (ts.includes(':')) { const p = ts.split(':'); hStr = p[0]; mStr = p[1]; }
    else { hStr = ts; mStr = '00'; }
    let h = parseInt(hStr, 10);
    const ampm = h < 12 ? 'AM' : 'PM';
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${ampm} ${String(displayH).padStart(2, '0')}:${mStr.padStart(2, '0')}`;
}

// --- 2. 분석 및 집계 ---
function analyze() {
    const generalText = elements.inputs.general.value;
    allData = parseData(generalText);
    if (allData.length === 0) { alert('데이터를 입력해주세요.'); return; }
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
    const res = { totalProc: 0, totalReg: 0, channelMap: {}, methodMap: {}, timeMap: {}, peakTimeShort: '-', peakTimeDisplay: '' };
    rows.forEach(r => {
        res.totalProc += r.procCount; res.totalReg += r.regCount;
        res.channelMap[r.channel] = (res.channelMap[r.channel] || 0) + r.procCount;
        let methodName = r.method === '가상계좌입금' ? '가상계좌 신청' : r.method;
        res.methodMap[methodName] = (res.methodMap[methodName] || 0) + r.procCount;
        if (!res.timeMap[r.timeKey]) res.timeMap[r.timeKey] = { proc: 0, reg: 0, display: r.timeDisplay, short: r.timeShort };
        res.timeMap[r.timeKey].proc += r.procCount; res.timeMap[r.timeKey].reg += r.regCount;
    });
    const sorted = Object.entries(res.timeMap).sort((a,b) => b[1].proc - a[1].proc);
    if (sorted.length > 0) { res.peakTimeShort = sorted[0][1].short; res.peakTimeDisplay = sorted[0][1].display; }
    return res;
}

function analyzeVAProcess(gen, act) {
    const apps = gen.filter(r => r.method === '가상계좌입금' || r.method === '가상계좌 신청');
    const appCount = apps.reduce((a, b) => a + b.procCount, 0);
    const depCount = act.reduce((a, b) => a + b.procCount, 0);
    const tAppMap = {}, tDepMap = {};
    apps.forEach(r => { if(!tAppMap[r.timeKey]) tAppMap[r.timeKey]={count:0,short:r.timeShort,display:r.timeDisplay}; tAppMap[r.timeKey].count += r.procCount; });
    act.forEach(r => { if(!tDepMap[r.timeKey]) tDepMap[r.timeKey]={count:0,short:r.timeShort,display:r.timeDisplay}; tDepMap[r.timeKey].count += r.procCount; });
    return { appCount, depCount, convRate: appCount > 0 ? ((depCount / appCount) * 100).toFixed(1) : 0, timeAppMap: tAppMap, timeDepMap: tDepMap };
}

function aggregateTimeSeries(data, curYM) {
    const getYM = (base, off) => { const d = new Date(parseInt(base.substring(0,4)), parseInt(base.substring(4,6))-1-off, 1); return d.getFullYear() + (d.getMonth()+1).toString().padStart(2,'0'); };
    const targets = { cur: curYM, m1: getYM(curYM, 1), m2: getYM(curYM, 2), m3: getYM(curYM, 3), yoy: getYM(curYM, 12) };
    const summary = {};
    for (const [k, ym] of Object.entries(targets)) {
        const filtered = data.filter(d => d.ym === ym);
        summary[k] = { ym, proc: filtered.reduce((a, b) => a + b.procCount, 0), reg: filtered.reduce((a, b) => a + b.regCount, 0) };
    }
    return summary;
}

// --- 3. UI 렌더링 ---
function render(cur, ts, va) {
    elements.dashboard.classList.remove('hidden');
    elements.stats.totalProc.textContent = cur.totalProc.toLocaleString();
    elements.stats.totalReg.textContent = cur.totalReg.toLocaleString();
    elements.stats.peakTime.textContent = cur.peakTimeShort;
    elements.stats.peakTime.nextElementSibling.textContent = cur.peakTimeDisplay;
    const yoy = ts.yoy; elements.stats.yoyVal.textContent = yoy.proc.toLocaleString();
    const yDiff = cur.totalProc - yoy.proc; const yPer = yoy.proc > 0 ? ((yDiff/yoy.proc)*100).toFixed(1) : 0;
    elements.stats.yoyDelta.innerHTML = `<span class="${yDiff>=0?'up':'down'}">${yDiff>=0?'▲':'▼'} ${Math.abs(yPer)}%</span>`;

    renderShare(elements.visuals.channelShares, cur.channelMap, cur.totalProc);
    renderShare(elements.visuals.methodShares, cur.methodMap, cur.totalProc);

    const sortedTK = Object.keys(cur.timeMap).sort();
    if (loadChartInstance) loadChartInstance.destroy();
    loadChartInstance = new Chart(elements.visuals.timeLoadCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedTK.map(k => cur.timeMap[k].short),
            datasets: [
                { type: 'line', label: '효율(%)', data: sortedTK.map(k => cur.timeMap[k].reg > 0 ? Math.min((cur.timeMap[k].proc/cur.timeMap[k].reg)*100, 100).toFixed(1) : 0), borderColor: '#10b981', yAxisID: 'y1' },
                { type: 'bar', label: '부하량', data: sortedTK.map(k => cur.timeMap[k].proc), backgroundColor: sortedTK.map(k => cur.timeMap[k].proc > Math.max(...sortedTK.map(x=>cur.timeMap[x].proc))*0.9 ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.5)'), yAxisID: 'y' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { position: 'left' }, y1: { position: 'right', min: 0, max: 105 } } }
    });

    if (va.appCount > 0 || va.depCount > 0) {
        elements.vaSection.classList.remove('hidden');
        elements.stats.vaApp.textContent = va.appCount.toLocaleString() + '건';
        elements.stats.vaDep.textContent = va.depCount.toLocaleString() + '건';
        elements.stats.vaConv.textContent = va.convRate + '%';
        const allH = [...new Set([...Object.keys(va.timeAppMap), ...Object.keys(va.timeDepMap)])].sort();
        if (vaChartInstance) vaChartInstance.destroy();
        vaChartInstance = new Chart(elements.visuals.vaTimeChartCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: allH.map(k => (va.timeAppMap[k] || va.timeDepMap[k]).short),
                datasets: [
                    { label: '신청', data: allH.map(k => va.timeAppMap[k]?.count || 0), borderColor: '#3b82f6', fill: true },
                    { label: '입금', data: allH.map(k => va.timeDepMap[k]?.count || 0), borderColor: '#f97316', fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    elements.summaryTable.innerHTML = Object.entries(ts).map(([k, d]) => `<tr><td>${k}</td><td>${d.ym}</td><td class="num">${d.proc.toLocaleString()}</td><td class="num">${d.reg.toLocaleString()}</td><td class="num">-</td></tr>`).join('');
    renderDataTable(currentMonthRows);
}

function renderShare(cont, map, tot) {
    cont.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([n, c]) => `<div class="share-item"><div class="share-info"><span>${n}</span><span>${((c/tot)*100).toFixed(1)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${(c/tot)*100}%"></div></div></div>`).join('');
}

function renderDataTable(data) {
    elements.dataTable.innerHTML = data.map(r => `<tr><td>${r.date}</td><td>${r.timeDisplay}</td><td>${r.type}</td><td>${r.method}</td><td>${r.channel}</td><td class="num">${r.regCount.toLocaleString()}</td><td class="num bold">${r.procCount.toLocaleString()}</td></tr>`).join('');
}

// --- 4. Export Engines ---

// [PDF Export]
elements.exportBtns.pdf.onclick = () => {
    const element = document.getElementById('dashboard-view');
    const opt = { margin: 0.5, filename: '마감통계보고서.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' } };
    html2pdf().set(opt).from(element).save();
};

// [Excel Export]
elements.exportBtns.excel.onclick = () => {
    const wb = XLSX.utils.book_new();
    const ws_data = [["거래일자", "거래시간", "구분", "방법", "채널", "증번건수", "처리건수"], ...currentMonthRows.map(r => [r.date, r.timeDisplay, r.type, r.method, r.channel, r.regCount, r.procCount])];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "상세데이터");
    XLSX.writeFile(wb, "마감분석데이터.xlsx");
};

// [PPT Export]
elements.exportBtns.ppt.onclick = () => {
    let pptx = new PptxGenJS();
    let slide = pptx.addSlide();
    slide.addText("Monthly Closing Report", { x: 1, y: 1, fontSize: 36, color: "363636" });
    slide.addText(`총 처리건수: ${elements.stats.totalProc.textContent}건`, { x: 1, y: 2, fontSize: 20 });
    slide.addText(`피크 시간대: ${elements.stats.peakTime.textContent}`, { x: 1, y: 2.5, fontSize: 20 });
    pptx.writeFile({ fileName: "마감보고서.pptx" });
};

// [Email Share]
elements.exportBtns.email.onclick = () => {
    const subject = encodeURIComponent("[공유] 마감 통계 분석 보고서");
    const body = encodeURIComponent(`당월 마감 분석 결과입니다.\n\n- 총 처리건수: ${elements.stats.totalProc.textContent}건\n- 피크 시간대: ${elements.stats.peakTime.textContent}\n- 전년 대비: ${elements.stats.yoyVal.textContent}건\n\n상세 내용은 대시보드를 확인하세요.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

// --- Events ---
elements.processBtn.onclick = analyze;
elements.loadBtn.onclick = async () => {
    const r1 = await fetch('/rawdata'); elements.inputs.general.value = await r1.text();
    const r2 = await fetch('/rawdata2'); if(r2.ok) elements.inputs.va.value = await r2.text();
    alert('샘플 로드 완료');
};
elements.clearBtn.onclick = () => { elements.inputs.general.value = ''; elements.inputs.va.value = ''; elements.dashboard.classList.add('hidden'); };

const setupFile = (btnId, input, display, target) => {
    document.getElementById(btnId).onclick = () => input.click();
    input.onchange = (e) => {
        const file = e.target.files[0]; if(!file) return;
        display.textContent = file.name;
        const reader = new FileReader();
        if(file.name.match(/\.xls/)) {
            reader.onload = (evt) => {
                const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(wb.Sheets[workbook.SheetNames[0]], { header: 1 });
                target.value = json.flat().filter(c => c).join('\n');
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = (evt) => target.value = evt.target.result;
            reader.readAsText(file);
        }
    };
};
setupFile('file-upload-btn-general', elements.fileInputs.general, elements.fileNameDisplays.general, elements.inputs.general);
setupFile('file-upload-btn-va', elements.fileInputs.va, elements.fileNameDisplays.va, elements.inputs.va);
