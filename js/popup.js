// DOM Elements
const minutesElement = document.getElementById('minutes');
const secondsElement = document.getElementById('seconds');
const startButton = document.getElementById('start-btn');
const pauseButton = document.getElementById('pause-btn');
const resetButton = document.getElementById('reset-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const smileDetectionModal = document.getElementById('smile-detection-modal');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const smileProgressCircle = document.getElementById('smile-progress-circle');
const requestCameraButton = document.getElementById('request-camera-btn');
const cameraStatusText = document.getElementById('camera-status');

// Timer variables
let timerInterval;
let totalSeconds = 25 * 60; // Default 25 minutes
let timerRunning = false;
let smileDetected = false;
let smileTimer = 0;
let smileRequired = 5; // 5 seconds of smile required
const circleCircumference = 314.16; // 2 * π * 50 (반지름)

// Settings variables with defaults
let settings = {
  pomodoroTime: 25,
  darkMode: false
};

// Check if we're in a Chrome extension environment
const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

// Camera permission state
let cameraPermissionGranted = false;

// Get stored settings or use defaults
const loadSettings = () => {
  if (isExtension) {
    try {
      chrome.storage.sync.get({
        pomodoroTime: 25,
        darkMode: false
      }, (items) => {
        settings = items;
        applySettings();
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      applySettings();
    }
  } else {
    // Use localStorage if not in a Chrome extension
    try {
      const savedSettings = localStorage.getItem('pomodoroSettings');
      if (savedSettings) {
        settings = JSON.parse(savedSettings);
      }
      applySettings();
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      applySettings();
    }
  }
};

// Apply loaded settings to UI
const applySettings = () => {
  document.getElementById('pomodoro-time').value = settings.pomodoroTime;
  
  // Set dark mode
  if (settings.darkMode) {
    document.body.setAttribute('data-theme', 'dark');
    darkModeToggle.checked = true;
  } else {
    document.body.removeAttribute('data-theme');
    darkModeToggle.checked = false;
  }

  // Initialize timer with saved pomodoro time
  totalSeconds = settings.pomodoroTime * 60;
  updateTimerDisplay();
};

// Save settings
const saveSettings = () => {
  const pomodoroTime = parseInt(document.getElementById('pomodoro-time').value);
  const darkMode = darkModeToggle.checked;

  settings = {
    pomodoroTime,
    darkMode
  };

  if (isExtension) {
    try {
      chrome.storage.sync.set(settings);
      
      // 타이머가 실행 중이 아닌 경우에만 현재 타이머 시간 업데이트
      if (!timerRunning) {
        totalSeconds = pomodoroTime * 60;
        updateTimerDisplay();
        
        // 백그라운드에도 알림
        chrome.runtime.sendMessage({ 
          action: 'resetTimer'
        });
      }
    } catch (error) {
      console.error('Error saving settings to chrome storage:', error);
    }
  } else {
    // Use localStorage if not in a Chrome extension
    try {
      localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
      
      // 타이머가 실행 중이 아닌 경우에만 현재 타이머 시간 업데이트
      if (!timerRunning) {
        totalSeconds = pomodoroTime * 60;
        updateTimerDisplay();
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }
};

// Update timer display
const updateTimerDisplay = () => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  minutesElement.textContent = minutes.toString().padStart(2, '0');
  secondsElement.textContent = seconds.toString().padStart(2, '0');
};

// 백그라운드 통신 함수: 타이머 시작
const startTimer = () => {
  if (timerRunning) return;
  
  if (isExtension) {
    chrome.runtime.sendMessage({ action: 'startTimer' }, (response) => {
      if (response && response.status === 'success') {
        timerRunning = true;
        startButton.disabled = true;
        pauseButton.disabled = false;
        
        // 타이머 UI 업데이트 위한 로컬 인터벌 시작
        startTimerUpdateInterval();
      } else {
        console.error('Failed to start timer:', response);
      }
    });
  } else {
    // 확장 프로그램이 아닌 경우 직접 타이머 실행
    timerRunning = true;
    startButton.disabled = true;
    pauseButton.disabled = false;
    
    // 웹 페이지 환경에서 직접 타이머 설정
    timerInterval = setInterval(() => {
      totalSeconds--;
      updateTimerDisplay();
      
      if (totalSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        handleTimerCompleted();
      }
    }, 1000);
  }
};

// 백그라운드 통신 함수: 타이머 일시정지
const pauseTimer = () => {
  if (!timerRunning) return;
  
  if (isExtension) {
    chrome.runtime.sendMessage({ action: 'pauseTimer' }, (response) => {
      if (response && response.status === 'success') {
        timerRunning = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
        
        // 타이머 UI 업데이트 인터벌 정지
        clearInterval(timerInterval);
      } else {
        console.error('Failed to pause timer:', response);
      }
    });
  } else {
    // 확장 프로그램이 아닌 경우 직접 타이머 일시정지
    clearInterval(timerInterval);
    timerRunning = false;
    startButton.disabled = false;
    pauseButton.disabled = true;
  }
};

// 백그라운드 통신 함수: 타이머 리셋
const resetTimer = () => {
  if (isExtension) {
    chrome.runtime.sendMessage({ action: 'resetTimer' }, (response) => {
      if (response && response.status === 'success') {
        timerRunning = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
        
        // 타이머 UI 업데이트 인터벌 정지
        clearInterval(timerInterval);
        
        // 타이머 표시 업데이트
        totalSeconds = parseInt(document.getElementById('pomodoro-time').value) * 60;
        updateTimerDisplay();
      } else {
        console.error('Failed to reset timer:', response);
      }
    });
  } else {
    // 확장 프로그램이 아닌 경우 직접 타이머 리셋
    clearInterval(timerInterval);
    timerRunning = false;
    startButton.disabled = false;
    pauseButton.disabled = true;
    
    // 타이머 표시 업데이트
    totalSeconds = parseInt(document.getElementById('pomodoro-time').value) * 60;
    updateTimerDisplay();
  }
};

// 타이머 상태 체크 및 UI 업데이트 인터벌 시작
const startTimerUpdateInterval = () => {
  // 기존 인터벌 제거
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  if (isExtension) {
    // 매 초마다 백그라운드 상태를 가져와 UI 업데이트
    timerInterval = setInterval(() => {
      chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
        if (response && response.status === 'success') {
          // 백그라운드 상태 업데이트
          totalSeconds = response.timerState.totalSeconds;
          timerRunning = response.timerState.isRunning;
          
          // UI 업데이트
          updateTimerDisplay();
          
          // 타이머가 끝났거나 일시정지된 경우
          if (!timerRunning) {
            clearInterval(timerInterval);
            startButton.disabled = false;
            pauseButton.disabled = true;
          }
        } else {
          console.error('Failed to get timer state:', response);
        }
      });
    }, 1000);
  } else {
    // 확장 프로그램이 아닌 경우 직접 UI 업데이트
    // 이미 startTimer 함수에서 처리하므로 여기서는 추가 작업 불필요
  }
};

// Show browser notification
const showBrowserNotification = (title, message) => {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { 
        body: message,
        icon: 'images/icon.png'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { 
            body: message,
            icon: 'images/icon.png'
          });
        }
      });
    }
  }
};

// Check camera permission on startup
const checkCameraPermission = () => {
  // Chrome 스토리지에서 카메라 권한 상태 확인
  if (isExtension) {
    try {
      chrome.storage.sync.get('cameraPermissionGranted', (result) => {
        if (result.cameraPermissionGranted) {
          // 권한이 있는 경우
          cameraPermissionGranted = true;
          requestCameraButton.classList.add('granted');
          requestCameraButton.textContent = "Camera Access Granted";
          cameraStatusText.textContent = "You can now use smile detection feature";
        } else {
          // 권한이 없는 경우
          cameraPermissionGranted = false;
          cameraStatusText.textContent = "Camera permission needed. Please click the button below.";
        }
      });
    } catch (error) {
      console.error('Error accessing chrome storage:', error);
      // 권한 API 사용 시도
      checkCameraPermissionAPI();
    }
  } else {
    // 확장 프로그램이 아닌 경우 권한 API 사용
    checkCameraPermissionAPI();
  }
};

// Browser Permissions API를 사용한 권한 체크 (fallback)
const checkCameraPermissionAPI = async () => {
  try {
    const permissionStatus = await navigator.permissions.query({ name: 'camera' });
    
    if (permissionStatus.state === 'granted') {
      cameraPermissionGranted = true;
      requestCameraButton.classList.add('granted');
      requestCameraButton.textContent = "Camera Access Granted";
      cameraStatusText.textContent = "You can now use smile detection feature";
    } else if (permissionStatus.state === 'denied') {
      cameraStatusText.textContent = "Camera access blocked. Please update your browser settings.";
    } else {
      cameraStatusText.textContent = "Camera permission needed for smile detection";
    }
  } catch (error) {
    console.error('Error checking camera permission API:', error);
    cameraStatusText.textContent = "Click the button below to check camera permission";
  }
};

// 카메라 권한 요청 버튼 클릭 이벤트
requestCameraButton.addEventListener('click', () => {
  if (isExtension) {
    // 확장 프로그램이라면 옵션 페이지로 이동
    chrome.runtime.openOptionsPage();
  } else {
    // 일반 웹 페이지라면 권한 직접 요청
    requestCameraPermissionDirectly();
  }
});

// 웹 페이지에서 직접 권한 요청 (확장 프로그램이 아닌 경우)
const requestCameraPermissionDirectly = async () => {
  try {
    requestCameraButton.disabled = true;
    cameraStatusText.textContent = "Requesting permission...";
    
    // 간단한 비디오 제약 조건으로 카메라 접근 시도
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true
    });
    
    // 접근이 성공하면 스트림 중지
    stream.getTracks().forEach(track => track.stop());
    console.log('Camera permission granted');
    
    // 권한 확인 상태 업데이트
    cameraPermissionGranted = true;
    requestCameraButton.classList.add('granted');
    requestCameraButton.textContent = "Camera Access Granted";
    cameraStatusText.textContent = "You can now use smile detection feature";
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    requestCameraButton.disabled = false;
    
    if (error.name === 'NotAllowedError') {
      cameraStatusText.textContent = "Camera access denied. Please try again or check your browser settings.";
    } else if (error.name === 'NotFoundError') {
      cameraStatusText.textContent = "No camera found. Please connect a camera.";
    } else {
      cameraStatusText.textContent = "Error: " + error.message;
    }
  }
};

// Show smile detection modal
const showSmileDetectionModal = async () => {
  smileDetectionModal.classList.remove('hidden');
  
  // 카메라 권한이 없는 경우
  if (!cameraPermissionGranted) {
    // 메시지 표시하고 옵션 페이지 링크 제공
    const modal = document.querySelector('.modal-content');
    const permissionMessage = document.createElement('div');
    
    if (isExtension) {
      permissionMessage.innerHTML = '<p>카메라 권한이 필요합니다</p><p>카메라 접근 권한을 허용하려면 <button id="open-options" class="btn">설정 페이지</button>를 클릭하세요.</p>';
    } else {
      permissionMessage.innerHTML = '<p>카메라 권한이 필요합니다</p><p>설정 영역에서 "Allow Camera Access" 버튼을 클릭하여 권한을 요청하세요.</p>';
    }
    
    permissionMessage.style.margin = '20px 0';
    permissionMessage.style.color = 'var(--error-color)';
    permissionMessage.style.fontWeight = 'bold';
    modal.appendChild(permissionMessage);
    
    // 옵션 페이지 버튼에 이벤트 리스너 추가
    if (isExtension) {
      const optionsButton = permissionMessage.querySelector('#open-options');
      optionsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }
    
    // 닫기 버튼 추가
    const closeButton = document.createElement('button');
    closeButton.textContent = '닫기';
    closeButton.className = 'btn';
    closeButton.style.marginLeft = '10px';
    closeButton.addEventListener('click', () => {
      modal.removeChild(permissionMessage);
      if (modal.contains(closeButton)) modal.removeChild(closeButton);
      smileDetectionModal.classList.add('hidden');
    });
    
    modal.appendChild(closeButton);
    return;
  }
  
  // 카메라 권한이 있다면 얼굴 감지 초기화
  try {
    await initFaceDetection();
  } catch (error) {
    console.error('Failed to initialize camera:', error);
    // Handle error in UI
    const modal = document.querySelector('.modal-content');
    const errorMessage = document.createElement('div');
    errorMessage.textContent = '카메라 초기화 오류가 발생했습니다. 다시 시도해주세요.';
    errorMessage.style.color = 'var(--error-color)';
    errorMessage.style.margin = '10px 0';
    errorMessage.style.fontWeight = 'bold';
    modal.appendChild(errorMessage);
    
    // Add a button to try again
    const retryButton = document.createElement('button');
    retryButton.textContent = '다시 시도';
    retryButton.className = 'btn';
    retryButton.style.margin = '10px auto';
    retryButton.style.display = 'block';
    retryButton.addEventListener('click', () => {
      modal.removeChild(errorMessage);
      modal.removeChild(retryButton);
      showSmileDetectionModal();
    });
    modal.appendChild(retryButton);
  }
};

// Initialize face detection
const initFaceDetection = async () => {
  try {
    // Check if faceapi is available
    if (typeof faceapi === 'undefined') {
      console.error('face-api.js is not loaded. Please check the script tag.');
      alert('Face recognition library has not been loaded. Please try again in a moment.');
      smileDetectionModal.classList.add('hidden');
      return;
    }
    
    // Load face-api.js models
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('models'),
        faceapi.nets.faceExpressionNet.loadFromUri('models')
      ]);
    } catch (modelError) {
      console.error('Error loading face-api.js models:', modelError);
      alert('Failed to load face recognition model, please make sure the model file is in the correct location.');
      smileDetectionModal.classList.add('hidden');
      return;
    }
    
    // Get camera access with clear instructions
    let stream;
    try {
      // 최대한 단순한 제약 조건으로 카메라 접근 시도
      const constraints = {
        audio: false,
        video: true
      };
      
      console.log('Accessing camera...');
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      video.srcObject = stream;
      console.log('Camera access successful');
    } catch (cameraError) {
      console.error('Error accessing camera:', cameraError);
      
      // 옵션 페이지로 이동 안내 추가
      if (isExtension) {
        alert("카메라 접근에 문제가 있습니다. 설정 페이지로 이동하여 권한을 허용해주세요.");
        chrome.runtime.openOptionsPage();
      } else {
        if (cameraError.name === 'NotAllowedError') {
          alert("카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라 접근을 허용해주세요.");
        } else if (cameraError.name === 'NotFoundError') {
          alert("카메라를 찾을 수 없습니다. 카메라가 제대로 연결되어 있는지 확인해주세요.");
        } else {
          alert("카메라 접근 오류: " + cameraError.message);
        }
      }
      
      smileDetectionModal.classList.add('hidden');
      return;
    }
    
    // Start detection once video is playing
    video.addEventListener('play', () => {
      // 비디오 크기를 직접 설정합니다
      const videoWidth = video.offsetWidth || 300;
      const videoHeight = video.offsetHeight || 300;
      
      // 캔버스 크기를 비디오 크기에 맞게 설정합니다
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      const displaySize = { width: videoWidth, height: videoHeight };
      faceapi.matchDimensions(canvas, displaySize);
      
      console.log('Video dimensions:', displaySize);
      
      // 진행 원이 초기화 되었는지 확인
      smileProgressCircle.style.strokeDashoffset = circleCircumference;
      
      // Run detection every 100ms
      const detectionInterval = setInterval(async () => {
        if (!video.srcObject) {
          // Video stream was stopped
          clearInterval(detectionInterval);
          return;
        }
        
        try {
          const detections = await faceapi.detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions()
          ).withFaceExpressions();
          
          // 감지 결과 로깅
          if (detections.length > 0) {
            console.log('Face detected, expressions:', detections[0].expressions);
          } else {
            console.log('No face detected');
          }
          
          // 캔버스 초기화
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (detections.length > 0) {
            const expressions = detections[0].expressions;
            const happy = expressions.happy;
            
            console.log('Happiness level:', happy);
            
            // 파란 박스와 표정 텍스트 대신 상태 텍스트만 표시
            ctx.font = 'bold 28px Roboto';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            if (happy > 0.7) {
              // 웃는 경우
              ctx.fillStyle = 'rgba(76, 175, 80, 0.9)'; // 초록색
              // 텍스트 그림자 추가
              ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
              ctx.fillText('Cool!', canvas.width / 2, 20);
              // 그림자 초기화
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              smileTimer += 0.1; // Add 100ms
              console.log('Smiling detected, timer:', smileTimer);
              
              // Update progress circle
              const progress = (smileTimer / smileRequired);
              const dashoffset = circleCircumference * (1 - progress);
              smileProgressCircle.style.strokeDashoffset = dashoffset;
              console.log('Progress:', progress, 'Dashoffset:', dashoffset);
              
              // 완료되면 클리어 효과 추가 및 폐쇄
              if (smileTimer >= smileRequired) {
                console.log('Smile duration completed!');
                
                // 클리어 효과 추가
                playClearEffect(stream);
                
                clearInterval(detectionInterval);
              }
            } else {
              // 웃지 않는 경우
              ctx.fillStyle = 'rgba(255, 152, 0, 0.9)'; // 주황색
              // 텍스트 그림자 추가
              ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
              ctx.fillText('Please smile!', canvas.width / 2, 20);
              // 그림자 초기화
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              // Reset timer if not smiling
              smileTimer = 0;
              smileProgressCircle.style.strokeDashoffset = circleCircumference;
            }
          } else {
            // 얼굴이 감지되지 않은 경우
            ctx.font = 'bold 28px Roboto';
            ctx.fillStyle = 'rgba(244, 67, 54, 0.9)'; // 빨간색
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            // 텍스트 그림자 추가
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillText('No face detected 🔍', canvas.width / 2, 20);
            // 그림자 초기화
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Reset timer if no face
            smileTimer = 0;
            smileProgressCircle.style.strokeDashoffset = circleCircumference;
          }
        } catch (detectionError) {
          console.error('Error during face detection:', detectionError);
          // Don't stop the interval, just skip this frame
        }
      }, 100);
    });
  } catch (error) {
    console.error('Face detection error:', error);
    alert('An error occurred during face recognition initialization.');
    smileDetectionModal.classList.add('hidden');
  }
};

// 클리어 효과 재생 및 닫기
const playClearEffect = (stream) => {
  // 비디오 컨테이너에 클리어 효과 애니메이션 추가
  const videoContainer = document.querySelector('.video-container');
  videoContainer.classList.add('clear-animation');
  
  // 프로그레스 바 깜빡이는 효과 추가
  smileProgressCircle.classList.add('progress-flash');
  smileProgressCircle.style.strokeDashoffset = '0'; // 완전히 채워진 상태로 유지
  
  // 클리어 사운드 효과 (선택적)
  try {
    const audio = new Audio();
    audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAiIiIiIiIiIiIiIiIiIiIiIjMzMzMzMzMzMzMzMzMzMzMzMz///////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAWt/wAAAAAAAEQCAAAP//NEAAAAAAAA/+NAwAAAAHUAKu8TQ/gAO6wIAAAMYBAQAF9/9OALu84IAAYwGu7vf//HgYxjGD35/+cEDeD/5/8+DnP/n/yBhIGFwfB8HwfBAf/8H//4P////g+D4Pg+D8EDe//Bw/////wQfwfB8HwfB8ED//gAAIIAYC4EAYYZQDQGQVAqBACEIpGFzwPgkABPwLgGQZAxB0EYQrQUgRhgEgMgtB8DIBgVAAkoCcNQVAnCEKQ5BUDQQQoCQNwQPAkAwNwMgcDAFZuCoJQhCkCAYg6CMIQUhiGIgicJQNBmDkKQRhCFIQgTEIA';
    audio.play();
  } catch (e) {
    console.log('Sound effect not supported');
  }
  
  // 텍스트 피드백
  const modal = document.querySelector('.modal-content');
  const feedbackText = document.createElement('div');
  feedbackText.textContent = 'Completed! Good job.';
  feedbackText.style.color = 'var(--success-color)';
  feedbackText.style.fontWeight = 'bold';
  feedbackText.style.margin = '10px 0';
  feedbackText.style.fontSize = '18px';
  modal.appendChild(feedbackText);
  
  // 애니메이션이 끝나면 모달 닫기
  setTimeout(() => {
    videoContainer.classList.remove('clear-animation');
    smileProgressCircle.classList.remove('progress-flash');
    
    dismissSmileDetection(stream);
    
    // 피드백 텍스트 제거 (다음 번에 사용할 때를 위해)
    if (modal.contains(feedbackText)) {
      modal.removeChild(feedbackText);
    }
  }, 1500); // 더 긴 시간으로 설정
};

// Dismiss smile detection
const dismissSmileDetection = (stream) => {
  if (stream && stream.getTracks) {
    // Stop all tracks in the stream
    stream.getTracks().forEach(track => track.stop());
  }
  
  // Hide modal
  smileDetectionModal.classList.add('hidden');
  
  // Clear canvas
  if (canvas && canvas.getContext) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // Reset smile variables
  smileTimer = 0;
  smileProgressCircle.style.strokeDashoffset = circleCircumference;
  
  // 타이머가 자동으로 시작되지 않도록 변경
  // 대신 타이머를 초기화된 상태로 유지
  totalSeconds = parseInt(document.getElementById('pomodoro-time').value) * 60;
  updateTimerDisplay();
  startButton.disabled = false;
  pauseButton.disabled = true;
};

// Toggle dark mode
const toggleDarkMode = () => {
  if (darkModeToggle.checked) {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }
  saveSettings();
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Load settings
  loadSettings();
  
  // Check camera permission
  checkCameraPermission();
  
  // 확장 프로그램인 경우에만 백그라운드 통신 실행
  if (isExtension) {
    // 백그라운드로부터 현재 타이머 상태 가져오기
    chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
      if (response && response.status === 'success') {
        // 백그라운드 상태로 UI 업데이트
        totalSeconds = response.timerState.totalSeconds;
        timerRunning = response.timerState.isRunning;
        
        // 버튼 상태 업데이트
        startButton.disabled = timerRunning;
        pauseButton.disabled = !timerRunning;
        
        // 타이머 표시 업데이트
        updateTimerDisplay();
        
        // 타이머가 실행 중이면 업데이트 인터벌 시작
        if (timerRunning) {
          startTimerUpdateInterval();
        }
      }
    });
    
    // 백그라운드 메시지 리스너 설정
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Received message from background:', message);
      
      if (message.action === 'timerUpdate') {
        // 타이머 상태 업데이트
        totalSeconds = message.timerState.totalSeconds;
        timerRunning = message.timerState.isRunning;
        
        // UI 업데이트
        updateTimerDisplay();
        startButton.disabled = timerRunning;
        pauseButton.disabled = !timerRunning;
      }
      else if (message.action === 'timerCompleted') {
        // 타이머 완료 처리
        timerRunning = false;
        totalSeconds = 0;
        updateTimerDisplay();
        
        // 버튼 상태 업데이트
        startButton.disabled = false;
        pauseButton.disabled = true;
        
        // 타이머 완료 UI 처리
        handleTimerCompleted();
      }
      
      // 비동기 응답을 위해 true 반환
      return true;
    });
  } else {
    // 확장 프로그램이 아닌 경우 초기 타이머 UI 설정
    updateTimerDisplay();
    startButton.disabled = false;
    pauseButton.disabled = true;
  }
  
  // Event listeners
  startButton.addEventListener('click', startTimer);
  pauseButton.addEventListener('click', pauseTimer);
  resetButton.addEventListener('click', resetTimer);
  darkModeToggle.addEventListener('change', toggleDarkMode);
  
  // Settings change listener
  document.getElementById('pomodoro-time').addEventListener('change', saveSettings);
});

// 타이머 완료 처리
const handleTimerCompleted = () => {
  // 스마일 감지 모달 표시
  showSmileDetectionModal();
  
  // Reset the timer for next pomodoro
  totalSeconds = parseInt(document.getElementById('pomodoro-time').value) * 60;
  updateTimerDisplay();
}; 