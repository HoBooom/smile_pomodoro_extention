// 타이머 상태 변수
let timerState = {
  isRunning: false,
  totalSeconds: 25 * 60, // 기본값 25분
  startTime: null,
  endTime: null,
  pomodoroTime: 25 // 설정된 포모도로 시간 (분)
};

// 알람 ID 상수
const POMODORO_ALARM = 'pomodoroAlarm';

// 확장 프로그램 설치 또는 업데이트시 초기화
chrome.runtime.onInstalled.addListener(() => {
  console.log('Smile Pomodoro extension installed/updated');
  
  // 저장된 설정이 있는지 확인
  chrome.storage.sync.get(['pomodoroTime'], (result) => {
    if (result.pomodoroTime) {
      timerState.pomodoroTime = result.pomodoroTime;
      timerState.totalSeconds = result.pomodoroTime * 60;
    }
  });
});

// 스토리지 변경 감지하여 설정 업데이트
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.pomodoroTime && namespace === 'sync') {
    timerState.pomodoroTime = changes.pomodoroTime.newValue;
    
    // 타이머가 실행 중이 아닐 때만 총 시간을 업데이트
    if (!timerState.isRunning) {
      timerState.totalSeconds = changes.pomodoroTime.newValue * 60;
    }
  }
});

// 메시지 수신 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  switch(message.action) {
    case 'startTimer':
      startTimer();
      sendResponse({ status: 'success', timerState });
      break;
      
    case 'pauseTimer':
      pauseTimer();
      sendResponse({ status: 'success', timerState });
      break;
      
    case 'resetTimer':
      resetTimer();
      sendResponse({ status: 'success', timerState });
      break;
      
    case 'getTimerState':
      // 실행 중인 타이머의 현재 상태 계산
      if (timerState.isRunning && timerState.startTime && timerState.endTime) {
        // 현재 남은 시간을 정확하게 계산
        const currentTime = Math.floor(Date.now() / 1000);
        timerState.totalSeconds = Math.max(timerState.endTime - currentTime, 0);
      }
      sendResponse({ status: 'success', timerState });
      break;
      
    default:
      sendResponse({ status: 'error', message: 'Unknown action' });
  }
  
  // 비동기 응답을 위해 true 반환
  return true;
});

// 타이머 시작
function startTimer() {
  if (timerState.isRunning) return;
  
  console.log('Starting timer for', timerState.totalSeconds, 'seconds');
  
  // 현재 시간 설정 - 정확한 타이밍을 위해 밀리초 단위 타임스탬프 사용
  const now = Date.now();
  timerState.startTime = now;
  timerState.endTime = Math.floor(now / 1000) + timerState.totalSeconds;
  timerState.isRunning = true;
  
  // 알람 설정 - 정확한 종료 시간 설정
  chrome.alarms.create(POMODORO_ALARM, {
    when: now + (timerState.totalSeconds * 1000)
  });
  
  // 팝업에게 타이머 상태 변경 알림
  notifyPopup({ action: 'timerUpdate', timerState });
}

// 타이머 일시 정지
function pauseTimer() {
  if (!timerState.isRunning) return;
  
  console.log('Pausing timer');
  
  // 남은 시간 계산 - 정확한 계산을 위해 초 단위로 변환
  const now = Date.now();
  const currentSeconds = Math.floor(now / 1000);
  timerState.totalSeconds = Math.max(timerState.endTime - currentSeconds, 0);
  
  // 타이머 상태 업데이트
  timerState.isRunning = false;
  timerState.startTime = null;
  timerState.endTime = null;
  
  // 알람 취소
  chrome.alarms.clear(POMODORO_ALARM);
  
  // 팝업에게 타이머 상태 변경 알림
  notifyPopup({ action: 'timerUpdate', timerState });
}

// 타이머 리셋
function resetTimer() {
  console.log('Resetting timer');
  
  // 알람 취소
  chrome.alarms.clear(POMODORO_ALARM);
  
  // 타이머 상태 초기화
  timerState.isRunning = false;
  timerState.totalSeconds = timerState.pomodoroTime * 60;
  timerState.startTime = null;
  timerState.endTime = null;
  
  // 팝업에게 타이머 상태 변경 알림
  notifyPopup({ action: 'timerUpdate', timerState });
}

// 모든 열린 팝업에 메시지 전송
function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(error => {
    // 팝업이 열려있지 않은 경우 오류가 발생할 수 있으므로 무시
    console.log('Could not notify popup, it might be closed');
  });
}

// 알람 이벤트 처리
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POMODORO_ALARM) {
    console.log('Pomodoro timer completed!');
    
    // 타이머 상태 업데이트
    timerState.isRunning = false;
    timerState.totalSeconds = 0;
    timerState.startTime = null;
    timerState.endTime = null;
    
    // 알림 표시
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title: 'Rest time!',
      message: 'Take a break! Keep smiling.',
      requireInteraction: true // 사용자가 직접 닫을 때까지 알림 유지
    });
    
    // 팝업에게 타이머 상태 변경 알림
    notifyPopup({ action: 'timerCompleted', timerState });
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  // 알림 클릭 시 팝업 창 열기
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 400,
    height: 600
  });
}); 