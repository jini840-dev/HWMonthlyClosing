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

// 시간대별 정렬을 위한 24시간제 Key (예: "10:00", "10:30")
function formatTimeKey(t) {
    const ts = t.toString();
    if (ts.includes(':')) {
        const p = ts.split(':');
        return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
    }
    return `${ts.padStart(2, '0')}:00`;
}

// 사용자 요청에 따른 정밀한 시간대 구간 텍스트 (예: "AM10시00분 ~ AM10시29분59초")
function formatTimeDisplay(t) {
    const ts = t.toString();
    let hStr, mStr;
    if (ts.includes(':')) {
        const p = ts.split(':');
        hStr = p[0];
        mStr = p[1];
    } else {
        hStr = ts;
        mStr = '00';
    }
    
    let h = parseInt(hStr, 10);
    const ampm = h < 12 ? 'AM' : 'PM';
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const padH = String(displayH).padStart(2, '0');
    
    if (mStr === '30') {
        return `${ampm}${padH}시30분 ~ ${ampm}${padH}시59분59초`;
    } else {
        return `${ampm}${padH}시00분 ~ ${ampm}${padH}시29분59초`;
    }
}

// 차트 X축이나 요약 위젯을 위한 짧은 텍스트 (예: "AM 10:00")
function formatTimeShort(t) {
    const ts = t.toString();
    let hStr, mStr;
    if (ts.includes(':')) {
        const p = ts.split(':');
        hStr = p[0];
        mStr = p[1];
    } else {
        hStr = ts;
        mStr = '00';
    }
    
    let h = parseInt(hStr, 10);
    const ampm = h < 12 ? 'AM' : 'PM';
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const padH = String(displayH).padStart(2, '0');
    
    return `${ampm} ${padH}:${mStr.padStart(2, '0')}`;
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
    const res = { 
        totalProc: 0, totalReg: 0, channelMap: {}, methodMap: {}, timeMap: {}, 
        peakTimeShort: '-', peakTimeDisplay: '트랜잭션 최다 집중 구간' 
    };
    
    rows.forEach(r => {
        res.totalProc += r.procCount;
        res.totalReg += r.regCount;
        res.channelMap[r.channel] = (res.channelMap[r.channel] || 0) + r.procCount;
        
        let methodName = r.method;
        if(methodName === '가상계좌입금') methodName = '가상계좌 신청';
        res.methodMap[methodName] = (res.methodMap[methodName] || 0) + r.procCount;
        
        if (!res.timeMap[r.timeKey]) {
            res.timeMap[r.timeKey] = { proc: 0, reg: 0, display: r.timeDisplay, short: r.timeShort };
        }
        res.timeMap[r.timeKey].proc += r.procCount;
        res.timeMap[r.timeKey].reg += r.regCount;
    });

    const sortedTimes = Object.entries(res.timeMap).sort((a,b) => b[1].proc - a[1].proc);
    if (sortedTimes.length > 0) {
        res.peakTimeShort = sortedTimes[0][1].short;
        res.peakTimeDisplay = sortedTimes[0][1].display;
    }

    return res;
}

function analyzeVAProcess(generalRows, vaActualRows) {
    const appRows = generalRows.filter(r => r.method === '가상계좌입금' || r.method === '가상계좌 신청');
    const appCount = appRows.reduce((a, b) => a + b.procCount, 0);
    const depCount = vaActualRows.reduce((a, b) => a + b.procCount, 0);

    const timeAppMap = {};
    const timeDepMap = {};

    appRows.forEach(r => {
        const k = r.timeKey;
        if (!timeAppMap[k]) timeAppMap[k] = { count: 0, short: r.timeShort, display: r.timeDisplay };
        timeAppMap[k].count += r.procCount;
    });
    vaActualRows.forEach(r => {
        const k = r.timeKey;
        if (!timeDepMap[k]) timeDepMap[k] = { count: 0, short: r.timeShort, display: r.timeDisplay };
        timeDepMap[k].count += r.procCount;
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
    
    // 최대 부하 시간대 표시 (Short Text 메인, Display Text 서브)
    elements.stats.peakTime.textContent = cur.peakTimeShort;
    elements.stats.peakTime.nextElementSibling.textContent = cur.peakTimeDisplay;

    const yoy = ts.yoy;
    elements.stats.yoyVal.textContent = yoy.proc.toLocaleString();
    const yoyDiff = cur.totalProc - yoy.proc;
    const yoyPer = yoy.proc > 0 ? ((yoyDiff / yoy.proc) * 100).toFixed(1) : 0;
    elements.stats.yoyDelta.innerHTML = `<span class="${yoyDiff >= 0 ? 'up' : 'down'}">${yoyDiff >= 0 ? '▲' : '▼'} ${Math.abs(yoyPer)}%</span>`;

    renderShare(elements.visuals.channelShares, cur.channelMap, cur.totalProc);
    renderShare(elements.visuals.methodShares, cur.methodMap, cur.totalProc);

    // [시스템 부하 및 처리 효율성 차트]
    const sortedTimeKeys = Object.keys(cur.timeMap).sort();
    const loadLabels = sortedTimeKeys.map(k => cur.timeMap[k].short); // X축 라벨은 AM 10:00 형태
    const procData = sortedTimeKeys.map(k => cur.timeMap[k].proc);
    
    const effData = sortedTimeKeys.map(k => {
        const d = cur.timeMap[k];
        if (d.reg === 0) return 0;
        return Math.min(((d.proc / d.reg) * 100), 100).toFixed(1);
    });

    if (loadChartInstance) loadChartInstance.destroy();
    
    const maxProc = Math.max(...procData, 1);
    const bgColors = procData.map(val => {
        if (val > maxProc * 0.9) return 'rgba(239, 68, 68, 0.7)'; // Red
        if (val > maxProc * 0.7) return 'rgba(245, 158, 11, 0.7)'; // Orange
        return 'rgba(59, 130, 246, 0.5)'; // Blue
    });

    const ctxLoad = elements.visuals.timeLoadCanvas.getContext('2d');
    loadChartInstance = new Chart(ctxLoad, {
        type: 'bar',
        data: {
            labels: loadLabels,
            datasets: [
                {
                    type: 'line',
                    label: '처리 효율성 (%)',
                    data: effData,
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1'
                },
                {
                    type: 'bar',
                    label: '시스템 부하 (처리건수)',
                    data: procData,
                    backgroundColor: bgColors,
                    borderRadius: 4,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: '처리건수' } },
                y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: '효율 (%)' }, min: 0, max: 105, grid: { drawOnChartArea: false } }
            },
            plugins: { 
                tooltip: { 
                    mode: 'index', 
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            const idx = context[0].dataIndex;
                            const k = sortedTimeKeys[idx];
                            return cur.timeMap[k].display; // 툴팁 제목을 정밀 구간 텍스트로
                        }
                    }
                }, 
                legend: { position: 'top' } 
            }
        }
    });

    // [가상계좌 분석 차트]
    if (va.appCount > 0 || va.depCount > 0) {
        elements.vaSection.classList.remove('hidden');
        elements.stats.vaApp.textContent = va.appCount.toLocaleString() + '건';
        elements.stats.vaDep.textContent = va.depCount.toLocaleString() + '건';
        elements.stats.vaConv.textContent = va.convRate + '%';

        const allHours = [...new Set([...Object.keys(va.timeAppMap), ...Object.keys(va.timeDepMap)])].sort();
        const labels = allHours.map(k => {
            const item = va.timeAppMap[k] || va.timeDepMap[k];
            return item.short;
        });
        const appData = allHours.map(k => va.timeAppMap[k]?.count || 0);
        const depData = allHours.map(k => va.timeDepMap[k]?.count || 0);

        if (vaChartInstance) vaChartInstance.destroy();

        const ctxVA = elements.visuals.vaTimeChartCanvas.getContext('2d');
        vaChartInstance = new Chart(ctxVA, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: '가상계좌 신청', data: appData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.4 },
                    { label: '실제 보험료 입금', data: depData, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', borderWidth: 2, fill: true, tension: 0.4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '시간대', font: { weight: 'bold' } } },
                    y: { beginAtZero: true, title: { display: true, text: '처리건수 (건)', font: { weight: 'bold' } } }
                },
                plugins: { 
                    legend: { position: 'top' }, 
                    tooltip: { 
                        mode: 'index', 
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                const idx = context[0].dataIndex;
                                const k = allHours[idx];
                                const item = va.timeAppMap[k] || va.timeDepMap[k];
                                return item.display; // 툴팁 제목을 정밀 구간 텍스트로
                            }
                        }
                    } 
                },
                interaction: { mode: 'nearest', axis: 'x', intersect: false }
            }
        });

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
        <tr><td>${r.date}</td><td class="time-window">${r.timeDisplay}</td><td>${r.type}</td>
        <td>${r.method}</td><td>${r.channel}</td><td class="num">${r.regCount.toLocaleString()}</td>
        <td class="num bold">${r.procCount.toLocaleString()}</td></tr>`).join('');
}

// --- 테이블 정렬 처리 ---
if (elements.tableHeaders) {
    elements.tableHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.key;
            if (sortConfig.key === key) {
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.key = key;
                sortConfig.direction = 'asc';
            }

            currentMonthRows.sort((a, b) => {
                // 시간 필드의 경우 정렬을 위해 24시간제 Key(timeKey)를 사용
                let sortKey = key === 'time' ? 'timeKey' : key;
                let valA = a[sortKey];
                let valB = b[sortKey];
                if (typeof valA === 'string') return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            });

            renderDataTable(currentMonthRows);
            
            elements.tableHeaders.forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
                if (h.dataset.key === sortConfig.key) h.classList.add(sortConfig.direction === 'asc' ? 'sort-asc' : 'sort-desc');
            });
        });
    });
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
    if (vaChartInstance) { vaChartInstance.destroy(); vaChartInstance = null; }
    if (loadChartInstance) { loadChartInstance.destroy(); loadChartInstance = null; }
};
