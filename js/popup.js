// 필요한 변수 정의
const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
let totalSeconds = 0; // 타이머 초 단위 시간
let timerRunning = false; // 타이머 실행 상태
let timerInterval = null; // 타이머 인터벌 ID
let faceDetectionInterval = null; // 얼굴 인식 인터벌
let smileDetected = false; // 미소 감지 여부
let smileDetectionStartTime = null; // 미소 감지 시작 시간
let smileTimer = 0; // 미소 유지 시간 (초)
const requiredSmileTime = 5; // 미소를 유지해야 하는 시간 (초)

// UI 요소들 참조
let startButton;
let pauseButton;
let resetButton;
let darkModeToggle;
let minutesDisplay;
let secondsDisplay;

// 기본 설정값
let settings = {
  pomodoroTime: 25, // 기본 25분
  darkMode: false
};

// 타이머 표시 업데이트 함수
const updateTimerDisplay = () => {
  if (!minutesDisplay || !secondsDisplay) return;
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  // 시간을 2자리 형식으로 표시 (01:05)
  minutesDisplay.textContent = minutes.toString().padStart(2, '0');
  secondsDisplay.textContent = seconds.toString().padStart(2, '0');
  document.title = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} - 스마일 포모도로`;
};

// 타이머 상태 업데이트 함수
const updateTimerState = (seconds, isRunning) => {
  totalSeconds = seconds;
  timerRunning = isRunning;
  updateTimerDisplay();
  
  // 버튼 상태 업데이트
  if (startButton && pauseButton) {
    startButton.disabled = timerRunning;
    pauseButton.disabled = !timerRunning;
  }
  
  // 타이머가 실행 중이면 업데이트 인터벌 시작
  if (timerRunning) {
    startTimerUpdateInterval();
  }
};

// 설정 로드 함수
const loadSettings = () => {
  // 확장 프로그램 환경에서는 chrome.storage 사용
  if (isExtension) {
    chrome.storage.sync.get({
      pomodoroTime: 25,
      darkMode: false
    }, (items) => {
      settings = items;
      console.log('Loaded settings from storage:', settings);
      applySettings();
    });
  } else {
    // 일반 웹 환경에서는 localStorage 사용
    const savedSettings = localStorage.getItem('pomodoroSettings');
    if (savedSettings) {
      settings = JSON.parse(savedSettings);
    }
    applySettings();
  }
};

// 설정 적용 함수
const applySettings = () => {
  const pomodoroTimeInput = document.getElementById('pomodoro-time');
  if (pomodoroTimeInput) {
    pomodoroTimeInput.value = settings.pomodoroTime;
  }
  
  // Set dark mode
  if (darkModeToggle) {
    if (settings.darkMode) {
      document.body.setAttribute('data-theme', 'dark');
      darkModeToggle.checked = true;
    } else {
      document.body.removeAttribute('data-theme');
      darkModeToggle.checked = false;
    }
  }

  // 확장프로그램 환경에서는 백그라운드에서 타이머 상태를 가져오므로 
  // 여기서는 UI 설정만 적용하고 타이머 초기화는 하지 않음
  if (!isExtension) {
    // 확장 프로그램이 아닌 경우에만 타이머 초기화
    totalSeconds = settings.pomodoroTime * 60;
    updateTimerDisplay();
  }
  
  // 백그라운드 타이머 설정만 업데이트 (확장 프로그램인 경우)
  if (isExtension && !timerRunning) {
    chrome.runtime.sendMessage({
      action: 'resetTimer',
      pomodoroTime: settings.pomodoroTime
    });
  }
};

// 타이머 상태 체크 및 UI 업데이트 인터벌 시작
const startTimerUpdateInterval = () => {
  // 기존 인터벌 제거
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  if (isExtension) {
    console.log('Starting timer update interval');
    // 매 초마다 백그라운드 상태를 가져와 UI 업데이트
    timerInterval = setInterval(() => {
      chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting timer state:', chrome.runtime.lastError);
          clearInterval(timerInterval);
          
          // 백그라운드 통신 실패 시 로컬 타이머로 전환
          handleBackgroundCommunicationError();
          return;
        }
        
        if (response && response.status === 'success') {
          // 백그라운드 상태 업데이트
          const newState = response.timerState;
          
          // 타이머 상태가 변경되었는지 확인
          if (totalSeconds !== newState.totalSeconds || timerRunning !== newState.isRunning) {
            console.log('Timer state changed:', newState);
            totalSeconds = newState.totalSeconds;
            timerRunning = newState.isRunning;
            
            // UI 업데이트
            updateTimerDisplay();
            if (startButton && pauseButton) {
              startButton.disabled = timerRunning;
              pauseButton.disabled = !timerRunning;
            }
          }
          
          // 타이머가 끝났거나 일시정지된 경우
          if (!timerRunning && newState.totalSeconds === 0) {
            console.log('Timer completed');
            clearInterval(timerInterval);
            // 타이머 완료 처리
            handleTimerCompleted();
          } else if (!newState.isRunning) {
            console.log('Timer paused');
            clearInterval(timerInterval);
          }
        } else {
          console.error('Failed to get timer state:', response);
          clearInterval(timerInterval);
          
          // 백그라운드 통신 실패 시 로컬 타이머로 전환
          handleBackgroundCommunicationError();
        }
      });
    }, 1000);
  } else {
    // 확장 프로그램이 아닌 경우 직접 UI 업데이트
    timerInterval = setInterval(() => {
      if (timerRunning && totalSeconds > 0) {
        totalSeconds--;
        updateTimerDisplay();
        
        if (totalSeconds === 0) {
          timerRunning = false;
          clearInterval(timerInterval);
          handleTimerCompleted();
        }
      }
    }, 1000);
  }
};

// 타이머 완료 처리
const handleTimerCompleted = () => {
  console.log('Timer completed! Showing smile detection...');
  timerRunning = false;
  if (startButton && pauseButton) {
    startButton.disabled = false;
    pauseButton.disabled = true;
  }
  
  // 확장 프로그램 환경에서의 처리
  if (isExtension) {
    // 문서가 보이는 상태일 때만 스마일 감지 모달 표시
    if (document.visibilityState === 'visible') {
      const smileDetectionModal = document.getElementById('smile-detection-modal');
      if (smileDetectionModal) {
        // 기존에 hidden 클래스가 있는지 확인하고 로그
        console.log('Modal initially hidden:', smileDetectionModal.classList.contains('hidden'));
        
        // 클래스를 명시적으로 제거
        smileDetectionModal.classList.remove('hidden');
        
        // 스타일을 직접 설정하여 확실히 보이게 함
        smileDetectionModal.style.display = 'flex';
        
        // 모달이 보이는지 확인
        console.log('Modal displayed:', !smileDetectionModal.classList.contains('hidden'), 
                    'style.display:', smileDetectionModal.style.display);
        
        // 약간의 지연 후 스마일 감지 시작 (UI가 렌더링될 시간 제공)
        setTimeout(() => {
          console.log('Starting smile detection after delay...');
          startSmileDetection();
        }, 100);
      } else {
        console.error('Smile detection modal element not found!');
      }
    } else {
      console.log('Document not visible, skipping smile detection');
    }
  } else {
    // 일반 웹 환경에서는 브라우저 알림
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('포모도로 타이머 완료', {
        body: '휴식 시간입니다. 미소를 지어주세요!',
        icon: 'icon.png'
      });
    }
  }
};

// 백그라운드 통신 오류 처리
const handleBackgroundCommunicationError = () => {
  console.warn('Switching to local timer due to background communication error');
  
  // 로컬 타이머로 전환
  if (timerRunning) {
    timerInterval = setInterval(() => {
      if (timerRunning && totalSeconds > 0) {
        totalSeconds--;
        updateTimerDisplay();
        
        if (totalSeconds === 0) {
          timerRunning = false;
          clearInterval(timerInterval);
          handleTimerCompleted();
        }
      }
    }, 1000);
  }
};

// 타이머 시작 함수
const startTimer = () => {
  if (timerRunning) return;
  
  timerRunning = true;
  if (startButton && pauseButton) {
    startButton.disabled = true;
    pauseButton.disabled = false;
  }
  
  if (isExtension) {
    console.log('Sending start timer message to background');
    chrome.runtime.sendMessage({ action: 'startTimer' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error starting timer:', chrome.runtime.lastError);
        // 백그라운드 통신 실패 시 로컬 타이머로 전환
        handleBackgroundCommunicationError();
        return;
      }
      
      if (!response || response.status !== 'success') {
        console.error('Failed to start timer:', response);
        // 백그라운드 응답 실패 시 로컬 타이머로 전환
        handleBackgroundCommunicationError();
        return;
      }
      
      console.log('Timer started successfully');
      startTimerUpdateInterval();
    });
  } else {
    // 확장 프로그램이 아닌 경우 직접 타이머 실행
    startTimerUpdateInterval();
  }
};

// 타이머 일시정지 함수
const pauseTimer = () => {
  if (!timerRunning) return;
  
  if (isExtension) {
    console.log('Sending pause timer message to background');
    chrome.runtime.sendMessage({ action: 'pauseTimer' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error pausing timer:', chrome.runtime.lastError);
        
        // 백그라운드 통신 실패 시 로컬 처리
        clearInterval(timerInterval);
        timerRunning = false;
        if (startButton && pauseButton) {
          startButton.disabled = false;
          pauseButton.disabled = true;
        }
        return;
      }
      
      if (!response || response.status !== 'success') {
        console.error('Failed to pause timer:', response);
        
        // 백그라운드 응답 실패 시 로컬 처리
        clearInterval(timerInterval);
        timerRunning = false;
        if (startButton && pauseButton) {
          startButton.disabled = false;
          pauseButton.disabled = true;
        }
        return;
      }
      
      console.log('Timer paused successfully');
    });
  } else {
    // 확장 프로그램이 아닌 경우 직접 타이머 정지
    clearInterval(timerInterval);
    timerRunning = false;
    if (startButton && pauseButton) {
      startButton.disabled = false;
      pauseButton.disabled = true;
    }
  }
};

// 타이머 리셋 함수
const resetTimer = () => {
  if (isExtension) {
    console.log('Sending reset timer message to background');
    chrome.runtime.sendMessage({ 
      action: 'resetTimer',
      pomodoroTime: settings.pomodoroTime 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error resetting timer:', chrome.runtime.lastError);
        
        // 백그라운드 통신 실패 시 로컬 처리
        clearInterval(timerInterval);
        totalSeconds = settings.pomodoroTime * 60;
        timerRunning = false;
        updateTimerDisplay();
        if (startButton && pauseButton) {
          startButton.disabled = false;
          pauseButton.disabled = true;
        }
        return;
      }
      
      if (!response || response.status !== 'success') {
        console.error('Failed to reset timer:', response);
        
        // 백그라운드 응답 실패 시 로컬 처리
        clearInterval(timerInterval);
        totalSeconds = settings.pomodoroTime * 60;
        timerRunning = false;
        updateTimerDisplay();
        if (startButton && pauseButton) {
          startButton.disabled = false;
          pauseButton.disabled = true;
        }
        return;
      }
      
      console.log('Timer reset successfully');
    });
  } else {
    // 확장 프로그램이 아닌 경우 직접 타이머 리셋
    clearInterval(timerInterval);
    totalSeconds = settings.pomodoroTime * 60;
    timerRunning = false;
    updateTimerDisplay();
    if (startButton && pauseButton) {
      startButton.disabled = false;
      pauseButton.disabled = true;
    }
  }
};

// 다크 모드 토글 함수
const toggleDarkMode = () => {
  if (!darkModeToggle) return;
  
  settings.darkMode = darkModeToggle.checked;
  
  if (settings.darkMode) {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }
  
  saveSettings();
};

// 설정 저장 함수
const saveSettings = () => {
  const pomodoroTimeInput = document.getElementById('pomodoro-time');
  if (pomodoroTimeInput) {
    settings.pomodoroTime = parseInt(pomodoroTimeInput.value, 10) || 25;
  }
  
  if (isExtension) {
    chrome.storage.sync.set(settings, () => {
      console.log('Settings saved:', settings);
    });
    
    // 백그라운드 타이머 설정도 업데이트
    if (!timerRunning) {
      resetTimer();
    }
  } else {
    localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
    
    // 타이머 상태 업데이트
    if (!timerRunning) {
      totalSeconds = settings.pomodoroTime * 60;
      updateTimerDisplay();
    }
  }
};

// 카메라 권한 확인 함수
const checkCameraPermission = () => {
  const cameraPermissionStatus = document.getElementById('camera-status');
  const allowCameraButton = document.getElementById('request-camera-btn');
  
  if (!cameraPermissionStatus || !allowCameraButton) return;
  
  navigator.permissions.query({name: 'camera'}).then(permissionStatus => {
    console.log('Camera permission status:', permissionStatus.state);
    
    const updatePermissionStatus = (state) => {
      if (state === 'granted') {
        cameraPermissionStatus.textContent = '카메라 접근 권한이 허용되었습니다.';
        cameraPermissionStatus.style.color = 'green';
        allowCameraButton.disabled = true;
      } else if (state === 'denied') {
        cameraPermissionStatus.textContent = '카메라 접근이 차단되었습니다. 브라우저 설정에서 권한을 변경해주세요.';
        cameraPermissionStatus.style.color = 'red';
      } else {
        cameraPermissionStatus.textContent = '타이머 완료 후 스마일 감지를 위해 카메라 접근을 허용해주세요.';
        cameraPermissionStatus.style.color = '';
      }
    };
    
    // 초기 상태 업데이트
    updatePermissionStatus(permissionStatus.state);
    
    // 상태 변경 감지
    permissionStatus.onchange = () => {
      updatePermissionStatus(permissionStatus.state);
    };
  }).catch(err => {
    console.error('Error checking camera permission:', err);
    cameraPermissionStatus.textContent = '카메라 권한을 확인할 수 없습니다.';
  });
  
  // 권한 요청 버튼 이벤트 처리
  allowCameraButton.addEventListener('click', () => {
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      } 
    })
    .then(stream => {
      stream.getTracks().forEach(track => track.stop());
      console.log('Camera access granted');
      cameraPermissionStatus.textContent = '카메라 접근 권한이 허용되었습니다.';
      cameraPermissionStatus.style.color = 'green';
      allowCameraButton.disabled = true;
    })
    .catch(err => {
      console.error('Error requesting camera permission:', err);
      
      if (err.name === 'NotAllowedError') {
        cameraPermissionStatus.textContent = '카메라 접근이 차단되었습니다. 브라우저 설정에서 권한을 변경해주세요.';
      } else if (err.name === 'NotFoundError') {
        cameraPermissionStatus.textContent = '카메라를 찾을 수 없습니다.';
      } else {
        cameraPermissionStatus.textContent = `카메라 접근 오류: ${err.message}`;
      }
      
      cameraPermissionStatus.style.color = 'red';
    });
  });
};

// 얼굴 인식 모델 로드
const loadFaceDetectionModels = async () => {
  console.log('Loading face detection models...');
  try {
    // 수정: models 폴더 경로 수정
    let modelsPath = isExtension ? chrome.runtime.getURL('models') : 'models';
    
    // CDN 모델 경로 (로컬이 없는 경우를 위한 대체)
    const cdnModelsPath = 'https://justadudewhohacks.github.io/face-api.js/models';
    
    try {
      // SSD MobileNet 모델 로드 시도
      await faceapi.loadSsdMobilenetv1Model(modelsPath);
      console.log('Successfully loaded SSD MobileNet model from', modelsPath);
    } catch (localError) {
      // 로컬 로딩 실패 시 CDN 사용
      console.warn('Failed to load models from local path, trying CDN:', localError);
      modelsPath = cdnModelsPath;
      await faceapi.loadSsdMobilenetv1Model(modelsPath);
    }
    
    // 나머지 모델 로드
    await faceapi.loadFaceLandmarkModel(modelsPath);
    await faceapi.loadFaceExpressionModel(modelsPath);
    
    console.log('Face detection models loaded successfully from', modelsPath);
    return true;
  } catch (error) {
    console.error('Error loading face detection models:', error);
    
    // 모달에 에러 메시지 표시
    const smileDetectionModal = document.getElementById('smile-detection-modal');
    if (smileDetectionModal) {
      const modalContent = smileDetectionModal.querySelector('.modal-content');
      if (modalContent) {
        const errorMsg = document.createElement('p');
        errorMsg.style.color = 'red';
        errorMsg.textContent = '얼굴 인식 모델을 로드하는데 실패했습니다. 새로고침 후 다시 시도해 주세요.';
        modalContent.appendChild(errorMsg);
      }
    }
    
    return false;
  }
};

// 스마일 감지 시작
const startSmileDetection = async () => {
  console.log('Starting smile detection...');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const progressCircle = document.getElementById('smile-progress-circle');
  const circumference = 2 * Math.PI * 50; // 원 둘레 (반지름이 50인 원)
  
  if (!video || !canvas || !progressCircle) {
    console.error('Video, canvas or progress circle element not found');
    return;
  }
  
  // 프로그레스 원 초기화
  progressCircle.style.strokeDasharray = circumference;
  progressCircle.style.strokeDashoffset = circumference;
  
  // 미소 감지 상태 초기화
  smileDetected = false;
  smileDetectionStartTime = null;
  smileTimer = 0;
  
  // 기존 스트림이 있다면 정리
  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
  }
  
  // 기존 감지 인터벌 정리
  if (faceDetectionInterval) {
    clearInterval(faceDetectionInterval);
    faceDetectionInterval = null;
  }
  
  try {
    // 얼굴 인식 모델 로드 (이미 로드되어 있지 않은 경우)
    if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
      console.log('Loading face detection models...');
      const modelLoaded = await loadFaceDetectionModels();
      if (!modelLoaded) {
        console.error('Failed to load face detection models');
        return;
      }
    }
    
    // 카메라 스트림 가져오기
    console.log('Requesting camera access...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      }
    });
    
    video.srcObject = stream;
    
    // 비디오 플레이 시작
    try {
      await video.play();
      console.log('Video playback started');
    } catch (error) {
      console.error('Error playing video:', error);
      throw error;
    }
    
    // 비디오 크기에 맞게 캔버스 설정
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);
    
    // 얼굴 인식 시작
    console.log('Starting face detection interval...');
    faceDetectionInterval = setInterval(async () => {
      if (video.paused || video.ended) return;
      
      try {
        // 얼굴 인식
        const detections = await faceapi.detectAllFaces(video)
          .withFaceLandmarks()
          .withFaceExpressions();
        
        // 디스플레이 크기에 맞게 결과 조정
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // 캔버스 초기화
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 결과 그리기
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
        
        // 미소 감지
        if (detections.length > 0) {
          const expressions = detections[0].expressions;
          const smileScore = expressions.happy;
          console.log('Smile score:', smileScore);
          
          if (smileScore > 0.7) { // 미소 임계값
            if (!smileDetected) {
              smileDetected = true;
              smileDetectionStartTime = Date.now();
            }
            
            const smileDuration = (Date.now() - smileDetectionStartTime) / 1000;
            smileTimer = Math.min(smileDuration, requiredSmileTime);
            
            // 프로그레스 바 업데이트
            const progress = smileTimer / requiredSmileTime;
            const dashOffset = circumference * (1 - progress);
            progressCircle.style.strokeDashoffset = dashOffset;
            
            // 지정된 시간동안 미소 유지 시 성공
            if (smileTimer >= requiredSmileTime) {
              console.log('Smile detected for required time! Completing session...');
              
              // 감지 인터벌 정리
              clearInterval(faceDetectionInterval);
              faceDetectionInterval = null;
              
              // 비디오 스트림 종료
              if (stream) {
                stream.getTracks().forEach(track => track.stop());
              }
              video.srcObject = null;
              
              // 캔버스 초기화
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // 스마일 감지 모달 숨기기
              const smileDetectionModal = document.getElementById('smile-detection-modal');
              if (smileDetectionModal) {
                smileDetectionModal.classList.add('hidden');
              }
              
              // 새로운 포모도로 타이머 세션 준비
              console.log('Resetting timer...');
              resetTimer();
            }
          } else {
            // 미소가 사라지면 타이머 리셋
            if (smileDetected) {
              smileDetected = false;
              smileDetectionStartTime = null;
              smileTimer = 0;
              progressCircle.style.strokeDashoffset = circumference;
            }
          }
        } else {
          // 얼굴이 감지되지 않으면 타이머 리셋
          if (smileDetected) {
            smileDetected = false;
            smileDetectionStartTime = null;
            smileTimer = 0;
            progressCircle.style.strokeDashoffset = circumference;
          }
        }
      } catch (error) {
        console.error('Error during face detection:', error);
      }
    }, 100);
  } catch (error) {
    console.error('Error accessing camera:', error);
    
    // 카메라 접근 오류 처리
    const smileDetectionModal = document.getElementById('smile-detection-modal');
    if (smileDetectionModal) {
      const modalContent = smileDetectionModal.querySelector('.modal-content');
      if (modalContent) {
        const errorMsg = document.createElement('p');
        errorMsg.style.color = 'red';
        errorMsg.textContent = '카메라 접근에 실패했습니다: ' + error.message;
        modalContent.appendChild(errorMsg);
      }
    }
  }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup initialized');
  
  // UI 요소 초기화
  startButton = document.getElementById('start-btn');
  pauseButton = document.getElementById('pause-btn');
  resetButton = document.getElementById('reset-btn');
  darkModeToggle = document.getElementById('dark-mode-toggle');
  minutesDisplay = document.getElementById('minutes');
  secondsDisplay = document.getElementById('seconds');
  
  // UI 초기화에 오류가 있다면 로그
  if (!startButton || !pauseButton || !resetButton || !minutesDisplay || !secondsDisplay) {
    console.error('일부 UI 요소를 찾을 수 없습니다:', {
      startButton,
      pauseButton, 
      resetButton,
      minutesDisplay,
      secondsDisplay
    });
  }
  
  // 얼굴 인식 모델 미리 로드
  console.log('Pre-loading face detection models...');
  loadFaceDetectionModels().then(success => {
    console.log('Face detection models pre-loaded:', success);
  }).catch(error => {
    console.error('Error pre-loading face detection models:', error);
  });
  
  // 우선 UI만 초기화
  updateTimerDisplay();
  startButton.disabled = false;
  pauseButton.disabled = true;
  
  // 카메라 권한 확인
  checkCameraPermission();
  
  // 확장 프로그램인 경우 백그라운드 상태 먼저 확인
  if (isExtension) {
    console.log('Checking for background script...');
    
    // 백그라운드에서 타이머 상태 가져오기
    chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error communicating with background script:', chrome.runtime.lastError);
        console.warn('Using local timer instead of background timer');
        // 백그라운드 통신 실패 시 설정 로드
        loadSettings();
        return;
      }
      
      if (response && response.status === 'success') {
        console.log('Received timer state from background:', response.timerState);
        
        // 항상 백그라운드의 타이머 상태를 적용 (실행 중이든 아니든)
        console.log('Applying timer state from background:', response.timerState.totalSeconds, response.timerState.isRunning);
        updateTimerState(response.timerState.totalSeconds, response.timerState.isRunning);
        
        // 타이머가 0초라면 완료된 상태
        if (response.timerState.totalSeconds === 0) {
          console.log('Timer appears to be completed, showing smile detection modal');
          // 팝업이 열릴 때 타이머가 완료된 상태라면 모달 표시
          setTimeout(() => {
            handleTimerCompleted();
          }, 500); // 약간의 지연을 주어 UI가 준비된 후 표시
        }
        
        // 이후 다른 설정들 로드 (타이머 상태는 덮어쓰지 않음)
        loadSettings();
      } else {
        console.error('Failed to get timer state from background:', response);
        console.warn('Using local timer settings');
        // 백그라운드 응답 실패 시 설정 로드
        loadSettings();
      }
    });
  } else {
    // 확장 프로그램이 아닌 경우 바로 설정 로드
    loadSettings();
  }
  
  // 백그라운드 메시지 리스너 설정
  if (isExtension) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Received message from background:', message);
      
      if (message.action === 'timerUpdate') {
        // 타이머 상태 업데이트
        updateTimerState(message.timerState.totalSeconds, message.timerState.isRunning);
      }
      else if (message.action === 'timerCompleted') {
        // 타이머 완료 처리
        updateTimerState(0, false);
        
        // 타이머 완료 UI 처리
        handleTimerCompleted();
      }
      
      // 비동기 응답을 위해 true 반환
      return true;
    });
  }
  
  // Event listeners
  startButton.addEventListener('click', startTimer);
  pauseButton.addEventListener('click', pauseTimer);
  resetButton.addEventListener('click', resetTimer);
  
  // darkModeToggle이 있을 때만 이벤트 리스너 등록
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', toggleDarkMode);
  } else {
    console.warn('darkModeToggle을 찾을 수 없습니다');
  }
  
  // Settings change listener
  const pomodoroTimeInput = document.getElementById('pomodoro-time');
  if (pomodoroTimeInput) {
    pomodoroTimeInput.addEventListener('change', saveSettings);
  } else {
    console.warn('pomodoro-time 입력 요소를 찾을 수 없습니다');
  }
});