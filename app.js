const targetAmount = 100000;
let currentAmount = 0;

let vbankAmount = 0;
let cmsAmount = 0;
let realtimeAmount = 0;

// DOM Elements
const currentAmountEl = document.getElementById('current-amount');
const mainProgressEl = document.getElementById('main-progress');
const mainPercentageEl = document.getElementById('main-percentage');

const vbankCurrentEl = document.getElementById('vbank-current');
const vbankProgressEl = document.getElementById('vbank-progress');

const cmsCurrentEl = document.getElementById('cms-current');
const cmsProgressEl = document.getElementById('cms-progress');

const realtimeCurrentEl = document.getElementById('realtime-current');
const realtimeProgressEl = document.getElementById('realtime-progress');

const alertBanner = document.getElementById('alert-banner');
const liveClockEl = document.getElementById('live-clock');

// 유틸리티: 숫자 포맷팅 (콤마)
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 시계 업데이트
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', { hour12: false });
    liveClockEl.textContent = timeString;
}

// 실시간 데이터 시뮬레이션
function simulateData() {
    if (currentAmount >= targetAmount) return; // 목표 달성 시 중지

    // 무작위로 데이터 증가
    const increaseVbank = Math.floor(Math.random() * 50) + 10;
    const increaseCms = Math.floor(Math.random() * 30) + 5;
    const increaseRealtime = Math.floor(Math.random() * 20) + 5;

    vbankAmount += increaseVbank;
    cmsAmount += increaseCms;
    realtimeAmount += increaseRealtime;

    currentAmount = vbankAmount + cmsAmount + realtimeAmount;
    if (currentAmount > targetAmount) currentAmount = targetAmount;

    updateUI();
}

// UI 업데이트
function updateUI() {
    // 메인 진행률
    const percentage = (currentAmount / targetAmount) * 100;
    currentAmountEl.textContent = formatNumber(currentAmount);
    mainProgressEl.style.width = `${percentage}%`;
    mainPercentageEl.textContent = `${percentage.toFixed(1)}%`;

    // 채널별 데이터 업데이트
    // 채널 바는 메인 목표 대비 비율이 아니라 전체 10만건 중 각 채널이 차지하는 예상 최대치(가상)를 기준으로 하거나
    // 단순 퍼센트로 보여주기 위해 전체 진행률과 비슷하게 맞춰줍니다.
    
    vbankCurrentEl.textContent = formatNumber(vbankAmount);
    vbankProgressEl.style.width = `${Math.min((vbankAmount / 50000) * 100, 100)}%`; // 가상 최대치 5만 기준

    cmsCurrentEl.textContent = formatNumber(cmsAmount);
    cmsProgressEl.style.width = `${Math.min((cmsAmount / 30000) * 100, 100)}%`; // 가상 최대치 3만 기준

    realtimeCurrentEl.textContent = formatNumber(realtimeAmount);
    realtimeProgressEl.style.width = `${Math.min((realtimeAmount / 20000) * 100, 100)}%`; // 가상 최대치 2만 기준
}

// 지연 알림 시뮬레이터
function checkRandomAlert() {
    // 5% 확률로 알림 발생
    const shouldAlert = Math.random() < 0.05;
    
    if (shouldAlert) {
        alertBanner.classList.remove('hidden');
        // 5초 후 알림 숨김
        setTimeout(() => {
            alertBanner.classList.add('hidden');
        }, 5000);
    }
}

// 초기화 및 루프 실행
function init() {
    updateClock();
    setInterval(updateClock, 1000);
    
    // 초기 시작값을 설정하여 대시보드가 처음부터 어느정도 차있게 보이게 설정 (선택사항)
    vbankAmount = 35000;
    cmsAmount = 21000;
    realtimeAmount = 14000;
    currentAmount = vbankAmount + cmsAmount + realtimeAmount;
    updateUI();
    
    // 과거 데이터 비교 설정
    initHistoricalData();

    // 0.8초마다 데이터 증가 시뮬레이션
    setInterval(simulateData, 800);

    // 3초마다 알림 조건 확인
    setInterval(checkRandomAlert, 3000);
}

// 과거 데이터 모의 설정 함수 (초기 로딩 시 기본값)
function initHistoricalData(currentTotal = null) {
    const referenceDate = new Date('2026-03-03');
    const currentMonth = referenceDate.getMonth() + 1; // 3
    const currentYear = referenceDate.getFullYear(); // 2026

    // 헬퍼 함수: 이전 달 계산
    function getPreviousMonthName(monthsAgo) {
        let d = new Date(currentYear, currentMonth - 1 - monthsAgo, 1);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    }

    // 입력된 데이터가 없으면 기존 모의 데이터 사용, 있으면 입력 데이터 기준으로 동적 생성
    const baseAmount = currentTotal !== null ? currentTotal : 98000;
    
    // 모의 과거 데이터 (입력된 현재 데이터 기준으로 약간씩 변동을 줌)
    const monthMinus1Data = Math.floor(baseAmount * 0.95);
    const monthMinus2Data = Math.floor(baseAmount * 0.91);
    const monthMinus3Data = Math.floor(baseAmount * 0.89);
    const lastYearAvg = Math.floor(baseAmount * 0.85);

    // 증감율 계산 로직
    function calculateTrend(current, previous) {
        if (previous === 0) return '';
        const diff = current - previous;
        const percent = ((diff / previous) * 100).toFixed(1);
        if (diff > 0) return `<span class="trend-up">▲ ${percent}% 증가</span>`;
        if (diff < 0) return `<span class="trend-down">▼ ${Math.abs(percent)}% 감소</span>`;
        return `<span class="trend-muted">- 변동 없음</span>`;
    }

    // M-1 바인딩 (2026년 2월)
    document.getElementById('month-minus-1-title').textContent = `${getPreviousMonthName(1)} 처리량`;
    document.getElementById('month-minus-1-amount').textContent = formatNumber(monthMinus1Data);
    document.getElementById('month-minus-1-progress').style.width = `${Math.min((monthMinus1Data / targetAmount) * 100, 100)}%`;
    document.getElementById('month-minus-1-trend').innerHTML = calculateTrend(baseAmount, monthMinus1Data);

    // M-2 바인딩 (2026년 1월)
    document.getElementById('month-minus-2-title').textContent = `${getPreviousMonthName(2)} 처리량`;
    document.getElementById('month-minus-2-amount').textContent = formatNumber(monthMinus2Data);
    document.getElementById('month-minus-2-progress').style.width = `${Math.min((monthMinus2Data / targetAmount) * 100, 100)}%`;
    document.getElementById('month-minus-2-trend').innerHTML = calculateTrend(monthMinus1Data, monthMinus2Data);

    // M-3 바인딩 (2025년 12월)
    document.getElementById('month-minus-3-title').textContent = `${getPreviousMonthName(3)} 처리량`;
    document.getElementById('month-minus-3-amount').textContent = formatNumber(monthMinus3Data);
    document.getElementById('month-minus-3-progress').style.width = `${Math.min((monthMinus3Data / targetAmount) * 100, 100)}%`;
    document.getElementById('month-minus-3-trend').innerHTML = calculateTrend(monthMinus2Data, monthMinus3Data);

    // 전년 동월 바인딩 (2025년 3월)
    const lastYearEl = document.getElementById('last-year-amount');
    const lastYearProgress = document.getElementById('last-year-progress');
    const lastYearTrend = document.getElementById('last-year-trend');

    lastYearEl.textContent = formatNumber(lastYearAvg);
    lastYearProgress.style.width = `${Math.min((lastYearAvg / targetAmount) * 100, 100)}%`;
    lastYearTrend.innerHTML = calculateTrend(baseAmount, lastYearAvg);
}

// 원시 데이터(TSV) 처리 및 UI 반영
function processRawData() {
    const rawData = document.getElementById('raw-data-input').value;
    if (!rawData.trim()) {
        alert('데이터를 입력해주세요.');
        return;
    }

    const rows = rawData.split('\n');
    let totalProcessedCount = 0;
    
    rows.forEach(row => {
        if (!row.trim()) return;
        const cols = row.split('\t');
        
        // 데이터에서 숫자로 변환 가능한 값을 찾아 누적 처리 (처리건수로 간주)
        // 예를 들어 09:00 \t 150 \t 140 이면 140을 누적
        let rowMaxNum = 0;
        cols.forEach(col => {
            const num = parseInt(col.replace(/,/g, ''), 10); // 콤마 제거 후 숫자 변환
            if (!isNaN(num) && num > rowMaxNum) {
                rowMaxNum = num; // 가장 큰 값을 처리 건수로 유추
            }
        });
        totalProcessedCount += rowMaxNum;
    });

    if (totalProcessedCount > 0) {
        // 기존 진행률에 데이터 덮어쓰기 (시뮬레이션 중지)
        currentAmount = totalProcessedCount;
        
        // 가상 비율 분배
        vbankAmount = Math.floor(currentAmount * 0.5);
        cmsAmount = Math.floor(currentAmount * 0.3);
        realtimeAmount = currentAmount - vbankAmount - cmsAmount;
        
        updateUI();
        initHistoricalData(currentAmount); // 새 데이터로 과거 비교 업데이트
        alert(`입력된 데이터를 바탕으로 총 ${formatNumber(currentAmount)}건이 적용되었습니다.`);
    } else {
        alert('유효한 숫자 데이터(처리건수)를 찾을 수 없습니다. 형식을 확인해주세요.');
    }
}

// 이벤트 리스너 등록
document.getElementById('process-data-btn').addEventListener('click', processRawData);

// DOM 로드 후 실행
document.addEventListener('DOMContentLoaded', init);