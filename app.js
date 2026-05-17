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

// 과거 데이터 모의 설정 함수
function initHistoricalData() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // 헬퍼 함수: 이전 달 계산
    function getPreviousMonthName(monthsAgo) {
        let d = new Date(currentYear, currentMonth - 1 - monthsAgo, 1);
        return `${d.getMonth() + 1}월`;
    }

    // 모의 데이터
    const monthMinus1Data = 95000;
    const monthMinus2Data = 91000;
    const monthMinus3Data = 89000;
    const lastYearAvg = 85000;

    // M-1 바인딩
    document.getElementById('month-minus-1-title').textContent = `${getPreviousMonthName(1)} 처리량`;
    document.getElementById('month-minus-1-amount').textContent = formatNumber(monthMinus1Data);
    document.getElementById('month-minus-1-progress').style.width = `${(monthMinus1Data / targetAmount) * 100}%`;
    document.getElementById('month-minus-1-trend').innerHTML = `<span class="trend-up">▲ 전월 대비 4.3% 증가</span>`;

    // M-2 바인딩
    document.getElementById('month-minus-2-title').textContent = `${getPreviousMonthName(2)} 처리량`;
    document.getElementById('month-minus-2-amount').textContent = formatNumber(monthMinus2Data);
    document.getElementById('month-minus-2-progress').style.width = `${(monthMinus2Data / targetAmount) * 100}%`;
    document.getElementById('month-minus-2-trend').innerHTML = `<span class="trend-up">▲ 전월 대비 2.2% 증가</span>`;

    // M-3 바인딩
    document.getElementById('month-minus-3-title').textContent = `${getPreviousMonthName(3)} 처리량`;
    document.getElementById('month-minus-3-amount').textContent = formatNumber(monthMinus3Data);
    document.getElementById('month-minus-3-progress').style.width = `${(monthMinus3Data / targetAmount) * 100}%`;
    document.getElementById('month-minus-3-trend').innerHTML = `<span class="trend-up">▲ 지속적 상승세</span>`;

    // 전년 동월 바인딩
    const lastYearEl = document.getElementById('last-year-amount');
    const lastYearProgress = document.getElementById('last-year-progress');
    const lastYearTrend = document.getElementById('last-year-trend');

    lastYearEl.textContent = formatNumber(lastYearAvg);
    lastYearProgress.style.width = `${(lastYearAvg / targetAmount) * 100}%`;
    lastYearTrend.innerHTML = `<span class="trend-up">▲ 전년 대비 8.5% 증가</span>`;
}

// DOM 로드 후 실행
document.addEventListener('DOMContentLoaded', init);