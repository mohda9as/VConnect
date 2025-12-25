// conference.js - Join Room Dashboard

document.addEventListener('DOMContentLoaded', function() {
    // Initialize animations
    initAnimations();

    // Setup room suggestions
    setupRoomSuggestions();

    // Setup interactive buttons
    setupInteractiveButtons();

    // Setup form validation and submission
    setupFormSubmission();

    // Load saved data if available
    loadSavedData();

    // Initialize statistics updater
    initStatistics();
});

function initAnimations() {
    // Floating icons animation
    const icons = document.querySelectorAll('.floating-icons i');
    icons.forEach((icon, index) => {
        icon.style.animationDelay = `${index * 0.5}s`;
    });

    // Background circles animation
    const circles = document.querySelectorAll('.circle');
    circles.forEach((circle, index) => {
        circle.style.animationDelay = `${index * 0.3}s`;
    });
}

function setupRoomSuggestions() {
    const suggestions = document.querySelectorAll('.suggestion');
    suggestions.forEach(suggestion => {
        suggestion.addEventListener('click', function() {
            const roomInput = document.getElementById('room');
            roomInput.value = this.getAttribute('data-room');
            roomInput.focus();
            highlightInput(roomInput, '#44bd32');
        });
    });
}

function setupInteractiveButtons() {
    // Quick join button
    const quickRoomBtn = document.getElementById('quickRoomBtn');
    quickRoomBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const quickRooms = ['quick-chat', 'lobby', 'general', 'hangout', 'meeting-room', 'casual-talk'];
        const randomRoom = quickRooms[Math.floor(Math.random() * quickRooms.length)];
        const roomInput = document.getElementById('room');
        roomInput.value = randomRoom;
        highlightInput(roomInput, '#44bd32');
        showMessage(`Quick joined: ${randomRoom}`, 'info');
    });

    // Create private room
    const createRoomBtn = document.querySelector('.create-room-btn');
    createRoomBtn.addEventListener('click', function() {
        const username = prompt('Enter your name for the private room:', 'Host');
        if (username) {
            const roomId = `private-${generateRoomId()}`;
            const usernameInput = document.getElementById('username');
            const roomInput = document.getElementById('room');

            usernameInput.value = username;
            roomInput.value = roomId;

            highlightInput(usernameInput, '#44bd32');
            highlightInput(roomInput, '#44bd32');

            showMessage(`✅ Private room created: ${roomId}`, 'success');

            // Auto-focus join button
            setTimeout(() => {
                document.querySelector('.join-btn').focus();
            }, 100);
        }
    });

    // Demo mode
    const demoBtn = document.querySelector('.demo-btn');
    demoBtn.addEventListener('click', function() {
        document.getElementById('username').value = 'Demo User';
        document.getElementById('room').value = 'demo-room';
        document.getElementById('rememberMe').checked = true;

        showMessage('🎮 Demo mode activated! Click "Join Conference" to experience the platform.', 'info');

        // Add demo effects
        document.body.classList.add('demo-mode');
        setTimeout(() => {
            document.body.classList.remove('demo-mode');
        }, 3000);
    });

    // Sound toggle
    const soundToggle = document.getElementById('soundToggle');
    soundToggle.addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (icon.classList.contains('fa-volume-up')) {
            icon.classList.replace('fa-volume-up', 'fa-volume-mute');
            showMessage('🔇 Sound muted', 'info');
        } else {
            icon.classList.replace('fa-volume-mute', 'fa-volume-up');
            playClickSound();
            showMessage('🔊 Sound enabled', 'info');
        }
    });

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');
        const icon = this.querySelector('i');
        if (icon.classList.contains('fa-moon')) {
            icon.classList.replace('fa-moon', 'fa-sun');
            showMessage('☀️ Light theme activated', 'info');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
            showMessage('🌙 Dark theme activated', 'info');
        }
        // Save theme preference
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    }

    // Input focus effects
    const inputs = document.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            highlightInput(this, '#00a8ff');
        });

        input.addEventListener('input', function() {
            if (this.value.length >= 3) {
                highlightInput(this, '#44bd32');
            } else {
                highlightInput(this, '#e84118');
            }
        });

        input.addEventListener('blur', function() {
            if (this.value.length >= 3) {
                highlightInput(this, '#44bd32');
            } else if (this.value.length > 0) {
                highlightInput(this, '#e84118');
            } else {
                this.style.borderColor = '';
                this.style.boxShadow = '';
            }
        });
    });
}

function setupFormSubmission() {
    const joinForm = document.getElementById('joinForm');
    const errorMsg = document.getElementById('error-msg');

    joinForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const room = document.getElementById('room').value.trim();
        const rememberMe = document.getElementById('rememberMe').checked;

        // Clear previous errors
        errorMsg.textContent = '';
        errorMsg.className = 'error-message';

        // Validation
        if (!validateForm(username, room)) {
            return;
        }

        // Save to localStorage if "Remember me" is checked
        if (rememberMe) {
            localStorage.setItem('savedUsername', username);
            localStorage.setItem('savedRoom', room);
        } else {
            localStorage.removeItem('savedUsername');
            localStorage.removeItem('savedRoom');
        }

        // Show loading state
        const joinBtn = document.querySelector('.join-btn');
        const originalText = joinBtn.innerHTML;
        joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        joinBtn.disabled = true;

        // Add connecting animation
        document.body.classList.add('connecting');

        // Simulate connection delay with progress
        showMessage('🔄 Connecting to conference server...', 'info');

        // Redirect to room page with parameters
        setTimeout(() => {
            // Save to sessionStorage for room page
            sessionStorage.setItem('username', username);
            sessionStorage.setItem('room', room);

            // Show success message
            showMessage('✅ Connected! Redirecting to video conference...', 'success');

            // Reset button
            joinBtn.innerHTML = originalText;
            joinBtn.disabled = false;
            document.body.classList.remove('connecting');

            // Redirect to room page
            setTimeout(() => {
                window.location.href = `room.html?room=${encodeURIComponent(room)}&username=${encodeURIComponent(username)}`;
            }, 1000);
        }, 2000);
    });
}

function validateForm(username, room) {
    const errorMsg = document.getElementById('error-msg');

    if (!username) {
        showError('⚠️ Please enter your display name');
        document.getElementById('username').focus();
        return false;
    }

    if (!room) {
        showError('⚠️ Please enter a room name');
        document.getElementById('room').focus();
        return false;
    }

    if (username.length < 3) {
        showError('⚠️ Name must be at least 3 characters');
        document.getElementById('username').focus();
        return false;
    }

    if (room.length < 3) {
        showError('⚠️ Room name must be at least 3 characters');
        document.getElementById('room').focus();
        return false;
    }

    if (username.length > 20) {
        showError('⚠️ Name must be less than 20 characters');
        document.getElementById('username').focus();
        return false;
    }

    if (room.length > 30) {
        showError('⚠️ Room name must be less than 30 characters');
        document.getElementById('room').focus();
        return false;
    }

    // Check for special characters
    const specialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
    if (specialChars.test(username)) {
        showError('⚠️ Name cannot contain special characters');
        document.getElementById('username').focus();
        return false;
    }

    return true;
}

function loadSavedData() {
    const savedUsername = localStorage.getItem('savedUsername');
    const savedRoom = localStorage.getItem('savedRoom');

    if (savedUsername) {
        document.getElementById('username').value = savedUsername;
        document.getElementById('rememberMe').checked = true;
    }

    if (savedRoom) {
        document.getElementById('room').value = savedRoom;
    }
}

function initStatistics() {
    // Simulate updating statistics
    setInterval(() => {
        const activeRooms = document.getElementById('activeRooms');
        const onlineUsers = document.getElementById('onlineUsers');

        // Generate random but realistic numbers
        const rooms = Math.floor(200 + Math.random() * 100);
        const users = Math.floor(1000 + Math.random() * 500);

        activeRooms.textContent = rooms;
        onlineUsers.textContent = users.toLocaleString();
    }, 5000);
}

// Helper Functions
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function highlightInput(input, color) {
    input.style.borderColor = color;
    input.style.boxShadow = `0 0 0 3px ${color}20`;
}

function showMessage(message, type) {
    const errorMsg = document.getElementById('error-msg');
    errorMsg.textContent = message;
    errorMsg.className = 'error-message';

    if (type === 'success') {
        errorMsg.style.color = '#44bd32';
    } else if (type === 'error') {
        errorMsg.style.color = '#e84118';
    } else {
        errorMsg.style.color = '#00a8ff';
    }

    // Auto-hide info messages after 3 seconds
    if (type === 'info') {
        setTimeout(() => {
            if (errorMsg.textContent === message) {
                errorMsg.textContent = '';
            }
        }, 3000);
    }
}

function showError(message) {
    showMessage(message, 'error');
    // Shake animation for error
    document.querySelector('.conference-card').classList.add('shake');
    setTimeout(() => {
        document.querySelector('.conference-card').classList.remove('shake');
    }, 500);
}

function playClickSound() {
    // In a real app, you would play a sound here
    console.log('Click sound played');
}

// Add CSS for demo mode and connecting animation
const style = document.createElement('style');
style.textContent = `
    .demo-mode {
        animation: demoPulse 0.5s ease-in-out 3;
    }

    @keyframes demoPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
    }

    .connecting {
        position: relative;
    }

    .connecting::after {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.1);
        z-index: 999;
        animation: connectingPulse 1s infinite;
    }

    @keyframes connectingPulse {
        0%, 100% { opacity: 0.1; }
        50% { opacity: 0.2; }
    }
`;
document.head.appendChild(style);