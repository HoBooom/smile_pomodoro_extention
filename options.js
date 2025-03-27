// DOM Elements
const requestPermissionButton = document.getElementById('requestPermission');
const permissionStatusElement = document.getElementById('permissionStatus');

// Function to check camera permission status
const checkCameraPermission = async () => {
  try {
    // Check if permission is already granted using the Permissions API
    const permissionStatus = await navigator.permissions.query({ name: 'camera' });
    
    if (permissionStatus.state === 'granted') {
      permissionStatusElement.innerHTML = '<span class="success-message">✓ Camera permission granted. You can use the smile detection feature.</span>';
      requestPermissionButton.textContent = 'Permission Granted';
      requestPermissionButton.classList.add('success');
      
      // Save the permission status in storage for the popup to access
      chrome.storage.sync.set({ cameraPermissionGranted: true });
    } else if (permissionStatus.state === 'denied') {
      permissionStatusElement.innerHTML = '<span class="error-message">✗ Camera access was denied. Please update your browser settings to enable camera access.</span>';
      
      // Save the permission status in storage for the popup to access
      chrome.storage.sync.set({ cameraPermissionGranted: false });
    } else {
      permissionStatusElement.textContent = "Camera permission is needed for the smile detection feature. Click the button above to grant permission.";
      
      // Save the permission status in storage for the popup to access
      chrome.storage.sync.set({ cameraPermissionGranted: false });
    }
    
    // Listen for changes in permission status
    permissionStatus.onchange = () => {
      checkCameraPermission();
    };
  } catch (error) {
    console.error('Error checking camera permission:', error);
    permissionStatusElement.innerHTML = '<span class="error-message">Error checking camera permission status.</span>';
  }
};

// Function to request camera permission
const requestCameraPermission = async () => {
  try {
    permissionStatusElement.textContent = "Requesting camera permission...";
    
    // Using getUserMedia to trigger the permission dialog
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: false, 
      video: true 
    });
    
    // If we get here, permission was granted
    // Stop the stream immediately as we only need to request permission
    stream.getTracks().forEach(track => track.stop());
    
    permissionStatusElement.innerHTML = '<span class="success-message">✓ Camera permission granted successfully!</span>';
    requestPermissionButton.textContent = 'Permission Granted';
    requestPermissionButton.classList.add('success');
    
    // Save the permission status in storage for the popup to access
    chrome.storage.sync.set({ cameraPermissionGranted: true });
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    
    if (error.name === 'NotAllowedError') {
      permissionStatusElement.innerHTML = '<span class="error-message">✗ Camera access was denied. Please try again or check your browser settings.</span>';
    } else if (error.name === 'NotFoundError') {
      permissionStatusElement.innerHTML = '<span class="error-message">✗ No camera found. Please connect a camera and try again.</span>';
    } else {
      permissionStatusElement.innerHTML = `<span class="error-message">✗ Error: ${error.message}</span>`;
    }
    
    // Save the permission status in storage for the popup to access
    chrome.storage.sync.set({ cameraPermissionGranted: false });
  }
};

// Event listeners
requestPermissionButton.addEventListener('click', requestCameraPermission);

// Check camera permission on page load
document.addEventListener('DOMContentLoaded', checkCameraPermission); 