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
// 알림 ID 상수
const POMODORO_COMPLETE_NOTIFICATION = 'pomodoroCompleteNotification';
// 상태 저장 간격 (밀리초)
const STATE_SAVE_INTERVAL = 5000; // 5초마다 상태 저장
// 상태 저장 인터벌 ID
let stateSaveIntervalId = null;

// 타이머 상태를 로컬 스토리지에 저장
function saveTimerState() {
  console.log('Saving timer state to storage:', timerState);
  
  // 현재 실행 중이면 endTime을 계산하여 저장
  if (timerState.isRunning && timerState.startTime) {
    // 현재 시간에 남은 초를 더해서 종료 시간 저장
    const now = Date.now();
    timerState.endTime = Math.floor(now / 1000) + timerState.totalSeconds;
  }
  
  // 직렬화하여 저장
  const stateToSave = JSON.stringify(timerState);
  chrome.storage.local.set({ 'timerState': stateToSave }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving timer state:', chrome.runtime.lastError);
    }
  });
}

// 타이머 상태를 로컬 스토리지에서 로드
function loadTimerState() {
  return new Promise((resolve) => {
    chrome.storage.local.get('timerState', (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading timer state:', chrome.runtime.lastError);
        resolve(false);
        return;
      }
      
      if (result.timerState) {
        try {
          const savedState = JSON.parse(result.timerState);
          console.log('Loaded timer state from storage:', savedState);
          
          // 실행 중이던 타이머인 경우, 남은 시간 계산
          if (savedState.isRunning && savedState.endTime) {
            const now = Math.floor(Date.now() / 1000);
            // 종료 시간에서 현재 시간을 빼서 남은 시간 계산
            savedState.totalSeconds = Math.max(savedState.endTime - now, 0);
            
            // 타이머가 이미 종료된 경우
            if (savedState.totalSeconds <= 0) {
              savedState.isRunning = false;
              savedState.totalSeconds = savedState.pomodoroTime * 60;
              savedState.startTime = null;
              savedState.endTime = null;
            } else {
              // 아직 실행 중인 경우 startTime 업데이트
              savedState.startTime = Date.now();
            }
          }
          
          // 상태 복원
          timerState = savedState;
          
          // 타이머가 실행 중이면 알람 재설정
          if (timerState.isRunning) {
            console.log('Resuming timer with', timerState.totalSeconds, 'seconds remaining');
            // 기존 알람 취소
            chrome.alarms.clear(POMODORO_ALARM);
            // 새 알람 설정
            chrome.alarms.create(POMODORO_ALARM, {
              when: Date.now() + (timerState.totalSeconds * 1000)
            });
          }
          
          resolve(true);
        } catch (error) {
          console.error('Error parsing saved timer state:', error);
          resolve(false);
        }
      } else {
        console.log('No saved timer state found');
        resolve(false);
      }
    });
  });
}

// 상태 저장 인터벌 시작
function startStateSaveInterval() {
  // 이미 실행 중이면 중복 실행 방지
  if (stateSaveIntervalId) {
    clearInterval(stateSaveIntervalId);
  }
  
  // 주기적으로 상태 저장
  stateSaveIntervalId = setInterval(() => {
    // 타이머가 실행 중인 경우 남은 시간 업데이트
    if (timerState.isRunning && timerState.endTime) {
      const now = Math.floor(Date.now() / 1000);
      // 종료 시간과 현재 시간의 차이로 정확하게 계산
      timerState.totalSeconds = Math.max(timerState.endTime - now, 0);
    }
    saveTimerState();
  }, STATE_SAVE_INTERVAL);
  
  console.log('Started state save interval');
}

// 초기화 및 이벤트 리스너 등록
async function initialize() {
  console.log('Smile Pomodoro background script initialized');
  
  // 저장된 타이머 상태 로드
  const stateLoaded = await loadTimerState();
  
  // 상태가 로드되지 않았을 경우 기본 설정 로드
  if (!stateLoaded) {
    // 저장된 설정이 있는지 확인
    chrome.storage.sync.get(['pomodoroTime'], (result) => {
      if (result.pomodoroTime) {
        timerState.pomodoroTime = result.pomodoroTime;
        timerState.totalSeconds = result.pomodoroTime * 60;
        console.log('Loaded saved pomodoro time:', timerState.pomodoroTime);
        // 초기 상태 저장
        saveTimerState();
      }
    });
  }
  
  // 상태 저장 인터벌 시작
  startStateSaveInterval();
  
  // 알림 클릭 이벤트 리스너 등록
  chrome.notifications.onClicked.addListener(handleNotificationClick);
  
  // 알림 버튼 클릭 이벤트 처리
  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    console.log('Notification button clicked:', notificationId, buttonIndex);
    
    if (notificationId === POMODORO_COMPLETE_NOTIFICATION) {
      // 알림 닫기
      chrome.notifications.clear(notificationId);
      
      // 확장 프로그램 팝업 열기
      try {
        chrome.action.openPopup();
      } catch (error) {
        console.error('Error opening popup:', error);
      }
    }
  });
  
  // 알람 이벤트 처리
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === POMODORO_ALARM) {
      console.log('Pomodoro timer completed!');
      
      // 타이머 상태 업데이트
      timerState.isRunning = false;
      timerState.totalSeconds = 0;
      timerState.startTime = null;
      timerState.endTime = null;
      
      // 상태 저장
      saveTimerState();
      
      // 알림 표시
      showCompletionNotification();
      
      // 팝업에게 타이머 상태 변경 알림
      notifyPopup({ action: 'timerCompleted', timerState });
    }
  });
  
  // 스토리지 변경 감지하여 설정 업데이트
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.pomodoroTime && namespace === 'sync') {
      timerState.pomodoroTime = changes.pomodoroTime.newValue;
      console.log('Pomodoro time updated:', timerState.pomodoroTime);
      
      // 타이머가 실행 중이 아닐 때만 총 시간을 업데이트
      if (!timerState.isRunning) {
        timerState.totalSeconds = changes.pomodoroTime.newValue * 60;
        // 상태 저장
        saveTimerState();
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
        resetTimer(message.pomodoroTime);
        sendResponse({ status: 'success', timerState });
        break;
        
      case 'getTimerState':
        // 실행 중인 타이머의 현재 상태 계산
        if (timerState.isRunning && timerState.startTime && timerState.endTime) {
          const now = Math.floor(Date.now() / 1000);
          const previousSeconds = timerState.totalSeconds;
          timerState.totalSeconds = Math.max(0, timerState.endTime - now);
          
          // 타이머가 종료되었는지 확인
          if (timerState.totalSeconds <= 0) {
            console.log('Timer completed (detected in getTimerState)');
            timerState.isRunning = false;
            timerState.totalSeconds = 0;
            timerState.startTime = null;
            timerState.endTime = null;
            
            // 알람 취소 (이미 종료됨)
            chrome.alarms.clear(POMODORO_ALARM);
            // 상태 저장
            saveTimerState();
            
            // 타이머가 방금 0이 됐다면 완료 알림도 함께 보냄
            if (previousSeconds > 0) {
              // 알림 표시
              showCompletionNotification();
              
              // 팝업에게 타이머 완료 알림
              notifyPopup({ action: 'timerCompleted', timerState });
            }
          }
        }
        sendResponse({ status: 'success', timerState });
        break;
        
      default:
        sendResponse({ status: 'error', message: 'Unknown action' });
    }
    
    // 비동기 응답을 위해 true 반환
    return true;
  });
}

// 확장 프로그램 설치 또는 업데이트시 초기화
chrome.runtime.onInstalled.addListener(() => {
  console.log('Smile Pomodoro extension installed/updated');
  initialize();
});

// 서비스 워커가 시작될 때도 초기화 실행
initialize();

// 타이머 시작
function startTimer() {
  if (timerState.isRunning) return;
  
  console.log('Starting timer for', timerState.totalSeconds, 'seconds');
  
  // 현재 시간 설정
  timerState.startTime = Date.now();
  timerState.endTime = Math.floor(Date.now() / 1000) + timerState.totalSeconds;
  timerState.isRunning = true;
  
  // 알람 설정
  chrome.alarms.create(POMODORO_ALARM, {
    when: Date.now() + (timerState.totalSeconds * 1000)
  });
  
  // 상태 저장
  saveTimerState();
  
  // 팝업에게 타이머 상태 변경 알림
  notifyPopup({ action: 'timerUpdate', timerState });
}

// 타이머 일시 정지
function pauseTimer() {
  if (!timerState.isRunning) return;
  
  console.log('Pausing timer');
  
  // 남은 시간 계산
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - timerState.startTime) / 1000);
  timerState.totalSeconds = Math.max(timerState.totalSeconds - elapsedSeconds, 0);
  
  // 타이머 상태 업데이트
  timerState.isRunning = false;
  timerState.startTime = null;
  timerState.endTime = null;
  
  // 알람 취소
  chrome.alarms.clear(POMODORO_ALARM);
  
  // 상태 저장
  saveTimerState();
  
  // 팝업에게 타이머 상태 변경 알림
  notifyPopup({ action: 'timerUpdate', timerState });
}

// 타이머 리셋
function resetTimer(pomodoroTime) {
  console.log('Resetting timer');
  
  // 알람 취소
  chrome.alarms.clear(POMODORO_ALARM);
  
  // pomodoroTime 파라미터가 전달된 경우 설정 업데이트
  if (pomodoroTime) {
    timerState.pomodoroTime = pomodoroTime;
    // 스토리지에도 저장
    chrome.storage.sync.set({ pomodoroTime });
  }
  
  // 타이머 상태 초기화
  timerState.isRunning = false;
  timerState.totalSeconds = timerState.pomodoroTime * 60;
  timerState.startTime = null;
  timerState.endTime = null;
  
  // 상태 저장
  saveTimerState();
  
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

// 타이머 완료 알림 표시
function showCompletionNotification() {
  // 알림 표시
  chrome.notifications.create(POMODORO_COMPLETE_NOTIFICATION, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('images/icon.png'),
    title: 'Rest time!',
    message: 'Take a break! Keep smiling.',
    requireInteraction: true, // 사용자가 직접 닫을 때까지 알림 유지
    priority: 2, // 높은 우선순위
    buttons: [
      { title: '확인하기' }
    ]
  });
}

// 알림 클릭 이벤트 처리
function handleNotificationClick(notificationId) {
  console.log('Notification clicked:', notificationId);
  
  if (notificationId === POMODORO_COMPLETE_NOTIFICATION) {
    // 알림 닫기
    chrome.notifications.clear(notificationId);
    
    // 확장 프로그램 팝업 열기
    try {
      chrome.action.openPopup();
    } catch (error) {
      console.error('Error opening popup:', error);
    }
  }
} 