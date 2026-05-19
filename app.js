const targetAmount = 100000;
let currentAmount = 0;
let regAmount = 0;

let vbankAmount = 0;
let cmsAmount = 0;
let realtimeAmount = 0;

// DOM Elements
const currentAmountEl = document.getElementById('current-amount');
const regAmountEl = document.getElementById('reg-amount');
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
    const increaseReg = Math.floor(Math.random() * 40) + 10;

    vbankAmount += increaseVbank;
    cmsAmount += increaseCms;
    realtimeAmount += increaseRealtime;
    regAmount += increaseReg;

    currentAmount = vbankAmount + cmsAmount + realtimeAmount;
    if (currentAmount > targetAmount) currentAmount = targetAmount;

    updateUI();
}

// UI 업데이트
function updateUI() {
    // 메인 진행률
    const percentage = (currentAmount / targetAmount) * 100;
    currentAmountEl.textContent = formatNumber(currentAmount);
    regAmountEl.textContent = formatNumber(regAmount);
    mainProgressEl.style.width = `${percentage}%`;
    mainPercentageEl.textContent = `${percentage.toFixed(1)}%`;

    // 채널별 데이터 업데이트
    vbankCurrentEl.textContent = formatNumber(vbankAmount);
    vbankProgressEl.style.width = `${Math.min((vbankAmount / 50000) * 100, 100)}%`; 

    cmsCurrentEl.textContent = formatNumber(cmsAmount);
    cmsProgressEl.style.width = `${Math.min((cmsAmount / 30000) * 100, 100)}%`; 

    realtimeCurrentEl.textContent = formatNumber(realtimeAmount);
    realtimeProgressEl.style.width = `${Math.min((realtimeAmount / 20000) * 100, 100)}%`; 
}

// 지연 알림 시뮬레이터
function checkRandomAlert() {
    const shouldAlert = Math.random() < 0.05;
    
    if (shouldAlert) {
        alertBanner.classList.remove('hidden');
        setTimeout(() => {
            alertBanner.classList.add('hidden');
        }, 5000);
    }
}

// 초기화 및 루프 실행
function init() {
    updateClock();
    setInterval(updateClock, 1000);
    
    vbankAmount = 35000;
    cmsAmount = 21000;
    realtimeAmount = 14000;
    regAmount = 75000;
    currentAmount = vbankAmount + cmsAmount + realtimeAmount;
    updateUI();
    
    initHistoricalData();

    setInterval(simulateData, 800);
    setInterval(checkRandomAlert, 3000);
}

function initHistoricalData(currentTotal = null) {
    const referenceDate = new Date('2026-03-03');
    const currentMonth = referenceDate.getMonth() + 1; 
    const currentYear = referenceDate.getFullYear(); 

    function getPreviousMonthName(monthsAgo) {
        let d = new Date(currentYear, currentMonth - 1 - monthsAgo, 1);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    }

    const baseAmount = currentTotal !== null ? currentTotal : 98000;
    
    const monthMinus1Data = Math.floor(baseAmount * 0.95);
    const monthMinus2Data = Math.floor(baseAmount * 0.91);
    const monthMinus3Data = Math.floor(baseAmount * 0.89);
    const lastYearAvg = Math.floor(baseAmount * 0.85);

    function calculateTrend(current, previous) {
        if (previous === 0) return '';
        const diff = current - previous;
        const percent = ((diff / previous) * 100).toFixed(1);
        if (diff > 0) return `<span class="trend-up">▲ ${percent}% 증가</span>`;
        if (diff < 0) return `<span class="trend-down">▼ ${Math.abs(percent)}% 감소</span>`;
        return `<span class="trend-muted">- 변동 없음</span>`;
    }

    document.getElementById('month-minus-1-title').textContent = `${getPreviousMonthName(1)} 처리량`;
    document.getElementById('month-minus-1-amount').textContent = formatNumber(monthMinus1Data);
    document.getElementById('month-minus-1-progress').style.width = `${Math.min((monthMinus1Data / targetAmount) * 100, 100)}%`;
    document.getElementById('month-minus-1-trend').innerHTML = calculateTrend(baseAmount, monthMinus1Data);

    document.getElementById('month-minus-2-title').textContent = `${getPreviousMonthName(2)} 처리량`;
    document.getElementById('month-minus-2-amount').textContent = formatNumber(monthMinus2Data);
    document.getElementById('month-minus-2-progress').style.width = `${Math.min((monthMinus2Data / targetAmount) * 100, 100)}%`;
    document.getElementById('month-minus-2-trend').innerHTML = calculateTrend(monthMinus1Data, monthMinus2Data);

    document.getElementById('month-minus-3-title').textContent = `${getPreviousMonthName(3)} 처리량`;
    document.getElementById('month-minus-3-amount').textContent = formatNumber(monthMinus3Data);
    document.getElementById('month-minus-3-progress').style.width = `${Math.min((monthMinus3Data / targetAmount) * 100, 100)}%`;
    document.getElementById('month-minus-3-trend').innerHTML = calculateTrend(monthMinus2Data, monthMinus3Data);

    const lastYearEl = document.getElementById('last-year-amount');
    const lastYearProgress = document.getElementById('last-year-progress');
    const lastYearTrend = document.getElementById('last-year-trend');

    lastYearEl.textContent = formatNumber(lastYearAvg);
    lastYearProgress.style.width = `${Math.min((lastYearAvg / targetAmount) * 100, 100)}%`;
    lastYearTrend.innerHTML = calculateTrend(baseAmount, lastYearAvg);
}

function processRawData() {
    const rawData = document.getElementById('raw-data-input').value;
    if (!rawData.trim()) {
        alert('데이터를 입력해주세요.');
        return;
    }

    const rows = rawData.split('\n');
    let totalProcessedCount = 0;
    let totalRegCount = 0;
    let vbankSum = 0;
    let cmsSum = 0;
    let realtimeSum = 0;
    
    // 첫 번째 줄은 항목명이므로 인덱스 1부터 시작
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row.trim()) continue;
        
        const cols = row.split('\t');
        if (cols.length < 7) continue;

        // 컬럼 정의: [0]거래일자 [1]거래시간 [2]구분 [3]방법 [4]채널 [5]처리증번건수 [6]처리건수
        const method = cols[3].trim();
        const regCount = parseInt(cols[5].replace(/,/g, ''), 10);
        const processedCount = parseInt(cols[6].replace(/,/g, ''), 10);

        if (!isNaN(regCount)) totalRegCount += regCount;
        if (!isNaN(processedCount)) {
            totalProcessedCount += processedCount;
            
            // 입출금방법에 따른 채널별 분류 합산
            if (method.includes('가상')) {
                vbankSum += processedCount;
            } else if (method.includes('CMS') || method.includes('자동이체')) {
                cmsSum += processedCount;
            } else if (method.includes('실시간')) {
                realtimeSum += processedCount;
            } else {
                // 분류되지 않은 경우 기타로 분류하거나 가상계좌에 합산(기본값)
                vbankSum += processedCount;
            }
        }
    }

    if (totalProcessedCount > 0 || totalRegCount > 0) {
        // 전역 변수 업데이트
        currentAmount = totalProcessedCount;
        regAmount = totalRegCount;
        vbankAmount = vbankSum;
        cmsAmount = cmsSum;
        realtimeAmount = realtimeSum;
        
        // 목표치 동적 조정 (현재 처리량이 목표치를 넘을 경우)
        if (currentAmount > targetAmount) {
            // targetAmount = Math.ceil(currentAmount / 10000) * 10000;
        }
        
        updateUI();
        initHistoricalData(currentAmount); 
        
        alert(`분석 완료!\n\n[상세 내역]\n- 총 증번건수: ${formatNumber(regAmount)}건\n- 총 처리건수(TR): ${formatNumber(currentAmount)}건\n\n[채널별 처리건수]\n- 가상계좌: ${formatNumber(vbankAmount)}건\n- CMS: ${formatNumber(cmsAmount)}건\n- 실시간: ${formatNumber(realtimeAmount)}건`);
    } else {
        alert('유효한 숫자 데이터를 찾을 수 없습니다. 형식이 맞는지 확인해주세요.');
    }
}

document.getElementById('process-data-btn').addEventListener('click', processRawData);

document.addEventListener('DOMContentLoaded', init);