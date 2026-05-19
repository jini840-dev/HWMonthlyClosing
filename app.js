// Constants
const targetAmount = 100000; // 과거 데이터 비교를 위한 기준치 유지

// DOM Elements
const processDataBtn = document.getElementById('process-data-btn');
const rawDataInput = document.getElementById('raw-data-input');
const totalRegCountEl = document.getElementById('total-reg-count');
const totalProcessedCountEl = document.getElementById('total-processed-count');

const dateReportList = document.getElementById('date-report-list');
const timeReportList = document.getElementById('time-report-list');
const methodReportList = document.getElementById('method-report-list');
const channelReportList = document.getElementById('channel-report-list');

// 유틸리티: 숫자 포맷팅 (콤마)
function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 리포트 아이템 템플릿 생성
function createStatItemHTML(key, reg, proc) {
    return `
        <div class="stat-item">
            <div class="item-key">${key}</div>
            <div class="item-values">
                <span class="val-proc">${formatNumber(proc)}건</span>
                <span class="val-reg">증번: ${formatNumber(reg)}건</span>
            </div>
        </div>
    `;
}

// 데이터 분석 실행
function runAnalysis() {
    const rawText = rawDataInput.value.trim();
    if (!rawText) {
        alert('데이터를 입력해주세요.');
        return;
    }

    const lines = rawText.split('\n');
    if (lines.length <= 1) {
        alert('분석할 데이터 행이 부족합니다.');
        return;
    }

    // 집계용 객체
    const stats = {
        totalReg: 0,
        totalProcessed: 0,
        byDate: {},
        byTime: {},
        byMethod: {},
        byChannel: {}
    };

    // 첫 줄(헤더) 제외하고 순회
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split('\t');
        if (cols.length < 7) continue;

        // 컬럼 추출
        const date = cols[0].trim();
        const time = cols[1].trim();
        const method = cols[3].trim();
        const channel = cols[4].trim();
        const regCount = parseInt(cols[5].replace(/,/g, ''), 10) || 0;
        const procCount = parseInt(cols[6].replace(/,/g, ''), 10) || 0;

        // 전체 합계
        stats.totalReg += regCount;
        stats.totalProcessed += procCount;

        // 그룹별 합계 함수
        const aggregate = (obj, key) => {
            if (!obj[key]) obj[key] = { reg: 0, proc: 0 };
            obj[key].reg += regCount;
            obj[key].proc += procCount;
        };

        aggregate(stats.byDate, date);
        aggregate(stats.byTime, time);
        aggregate(stats.byMethod, method);
        aggregate(stats.byChannel, channel);
    }

    renderResults(stats);
}

// 결과 렌더링
function renderResults(stats) {
    // 1. 전체 요약
    totalRegCountEl.textContent = formatNumber(stats.totalReg);
    totalProcessedCountEl.textContent = formatNumber(stats.totalProcessed);

    // 2. 상세 리스트 렌더링 헬퍼
    const renderList = (el, dataObj) => {
        el.innerHTML = '';
        const sortedKeys = Object.keys(dataObj).sort();
        if (sortedKeys.length === 0) {
            el.innerHTML = '<p class="placeholder-text">데이터가 없습니다.</p>';
            return;
        }
        sortedKeys.forEach(key => {
            const item = dataObj[key];
            el.innerHTML += createStatItemHTML(key, item.reg, item.proc);
        });
    };

    renderList(dateReportList, stats.byDate);
    renderList(timeReportList, stats.byTime);
    renderList(methodReportList, stats.byMethod);
    renderList(channelReportList, stats.byChannel);

    // 3. 과거 데이터 비교 업데이트
    updateHistoricalComparison(stats.totalProcessed);
    
    alert('통계 분석 보고서가 생성되었습니다.');
}

// 과거 데이터 비교 로직 (기존 로직 유지하되 현재 합계 기준)
function updateHistoricalComparison(currentTotal) {
    const refYear = 2026;
    const refMonth = 3;

    function getPreviousMonthName(monthsAgo) {
        let d = new Date(refYear, refMonth - 1 - monthsAgo, 1);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    }

    const base = currentTotal || 98000;
    const historical = [
        { id: 1, amount: Math.floor(base * 0.95) },
        { id: 2, amount: Math.floor(base * 0.91) },
        { id: 3, amount: Math.floor(base * 0.89) },
        { label: '전년 동월', amount: Math.floor(base * 0.85) }
    ];

    const calcTrend = (curr, prev) => {
        const diff = curr - prev;
        const percent = Math.abs((diff / prev) * 100).toFixed(1);
        if (diff > 0) return `<span class="trend-up">▲ ${percent}% 증가</span>`;
        if (diff < 0) return `<span class="trend-down">▼ ${percent}% 감소</span>`;
        return `<span class="trend-muted">- 변동 없음</span>`;
    };

    // M-1, M-2, M-3
    for (let i = 1; i <= 3; i++) {
        const data = historical[i - 1];
        const titleEl = document.getElementById(`month-minus-${i}-title`);
        const amountEl = document.getElementById(`month-minus-${i}-amount`);
        const trendEl = document.getElementById(`month-minus-${i}-trend`);
        
        titleEl.textContent = getPreviousMonthName(i);
        amountEl.textContent = formatNumber(data.amount);
        // 트렌드는 현재값(또는 이전달값)과 비교
        const compareVal = (i === 1) ? base : historical[i-2].amount;
        trendEl.innerHTML = calcTrend(compareVal, data.amount);
    }

    // 전년 동월
    const lastYearData = historical[3];
    document.getElementById('last-year-amount').textContent = formatNumber(lastYearData.amount);
    document.getElementById('last-year-trend').innerHTML = calcTrend(base, lastYearData.amount);
}

// 초기화
function init() {
    // 최초 실행 시 0 또는 가상 데이터로 초기화
    updateHistoricalComparison(0);
}

// 이벤트 리스너
if (processDataBtn) {
    processDataBtn.addEventListener('click', runAnalysis);
}

document.addEventListener('DOMContentLoaded', init);