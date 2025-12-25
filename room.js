// room.js - Video Conference Room

let socket;
let localStream;
let screenStream = null;
let peers = {};
let roomId;
let username;
let isMuted = false;
let isVideoOff = false;
let isScreenSharing = false;
let isObserver = false;
let meetingStartTime;
let timerInterval;
let currentUser = {
    name: '',
    id: ''
};

// Email and End Call related variables
let emailInviteModal;
let endCallModal;
let callEndedScreen;

document.addEventListener('DOMContentLoaded', function() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('room') || generateRoomId();
    username = urlParams.get('username') || sessionStorage.getItem('username') || 'Guest';
    const isReconnecting = urlParams.get('reconnect') === 'true';

    // Update current user info
    currentUser.name = username;
    currentUser.id = generateUserId();

    // Update UI
    document.getElementById('roomName').textContent = roomId;
    document.getElementById('localUserName').textContent = username;

    // Initialize modals
    initializeModals();

    // Initialize the room
    initializeRoom(isReconnecting);
});

function generateRoomId() {
    return 'room-' + Math.random().toString(36).substr(2, 9);
}

function generateUserId() {
    return 'user-' + Math.random().toString(36).substr(2, 9);
}

function initializeModals() {
    // Create email invite modal HTML
    const emailModalHTML = `
        <div class="modal" id="emailInviteModal">
            <div class="modal-content">
                <h3><i class="fas fa-envelope"></i> Send Email Invitation</h3>

                <div class="email-form">
                    <div class="form-group">
                        <label for="recipientEmail">Recipient Email*</label>
                        <input type="email" id="recipientEmail" placeholder="friend@example.com" required>
                    </div>

                    <div class="form-group">
                        <label for="recipientName">Recipient Name</label>
                        <input type="text" id="recipientName" placeholder="John Doe">
                    </div>

                    <div class="form-group">
                        <label for="meetingTitle">Meeting Title</label>
                        <input type="text" id="meetingTitle" placeholder="My VCONNECT Meeting">
                    </div>

                    <div class="invite-preview">
                        <h4>Preview:</h4>
                        <p><strong>Meeting Link:</strong> <span id="previewLink">Loading...</span></p>
                        <p><strong>Host:</strong> <span id="previewHost">You</span></p>
                    </div>

                    <div class="email-status" id="emailStatus"></div>

                    <div class="modal-actions">
                        <button class="btn-secondary" id="cancelEmail">
                            Cancel
                        </button>
                        <button class="btn-primary" id="sendEmailBtn">
                            <i class="fas fa-paper-plane"></i> Send Invitation
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Create end call modal HTML
    const endCallModalHTML = `
        <div class="modal" id="endCallModal">
            <div class="modal-content">
                <h3><i class="fas fa-phone-slash"></i> End Call Options</h3>

                <div class="end-call-options">
                    <div class="end-option" data-action="leave">
                        <div class="option-icon">
                            <i class="fas fa-user-slash"></i>
                        </div>
                        <div class="option-content">
                            <h4>Leave Call (Stay on Page)</h4>
                            <p>Disconnect from the call but stay on this page. You can rejoin later.</p>
                        </div>
                    </div>

                    <div class="end-option" data-action="end-all">
                        <div class="option-icon">
                            <i class="fas fa-users-slash"></i>
                        </div>
                        <div class="option-content">
                            <h4>End Meeting for All</h4>
                            <p>End the meeting for everyone. All participants will be disconnected.</p>
                        </div>
                    </div>

                    <div class="end-option" data-action="leave-page">
                        <div class="option-icon">
                            <i class="fas fa-sign-out-alt"></i>
                        </div>
                        <div class="option-content">
                            <h4>Leave Page</h4>
                            <p>Leave the meeting and go back to the homepage.</p>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn-secondary" id="cancelEndCall">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    // Create call ended screen HTML
    const callEndedScreenHTML = `
        <div class="call-ended-screen" id="callEndedScreen">
            <div class="ended-content">
                <div class="ended-icon">
                    <i class="fas fa-phone-slash"></i>
                </div>
                <h2>You have left the meeting</h2>
                <p>You are no longer connected to the call, but you can still:</p>

                <div class="ended-actions">
                    <button class="btn-primary" id="rejoinBtn">
                        <i class="fas fa-redo"></i> Rejoin Meeting
                    </button>
                    <button class="btn-secondary" id="newMeetingBtn">
                        <i class="fas fa-plus-circle"></i> Start New Meeting
                    </button>
                    <button class="btn-outline" id="goHomeBtn">
                        <i class="fas fa-home"></i> Go to Homepage
                    </button>
                </div>

                <div class="meeting-info">
                    <h4>Meeting Information</h4>
                    <p><strong>Room:</strong> <span id="endedRoomName">${roomId}</span></p>
                    <p><strong>Meeting ID:</strong> <span id="endedMeetingId">${roomId}</span></p>
                    <p><strong>Duration:</strong> <span id="endedDuration">00:00:00</span></p>
                </div>
            </div>
        </div>
    `;

    // Append modals to body
    document.body.insertAdjacentHTML('beforeend', emailModalHTML);
    document.body.insertAdjacentHTML('beforeend', endCallModalHTML);
    document.body.insertAdjacentHTML('beforeend', callEndedScreenHTML);

    // Initialize modal references
    emailInviteModal = document.getElementById('emailInviteModal');
    endCallModal = document.getElementById('endCallModal');
    callEndedScreen = document.getElementById('callEndedScreen');
}

async function initializeRoom(isReconnecting = false) {
    try {
        // Start meeting timer
        meetingStartTime = new Date();
        startMeetingTimer();

        // Connect to Socket.IO server
        socket = io('http://localhost:3000');

        // Socket event handlers
        socket.on('connect', () => {
            console.log('Connected to server');
            socket.emit('join-room', {
                roomId,
                username,
                isReconnecting
            });
        });

        socket.on('user-connected', (data) => {
            console.log('User connected:', data);
            if (!data.isObserver) {
                connectToNewUser(data.socketId);
            }
            updateParticipantCount();
        });

        socket.on('user-disconnected', (userId) => {
            console.log('User disconnected:', userId);
            if (peers[userId]) {
                peers[userId].close();
                delete peers[userId];
            }
            removeVideoElement(userId);
            updateParticipantCount();
            addSystemMessage(`User ${userId.substring(0, 5)} left the meeting`);
        });

        socket.on('signal', (data) => {
            handleSignal(data);
        });

        socket.on('chat-message', (data) => {
            addChatMessage(data.username, data.message);
        });

        socket.on('participant-updated', (data) => {
            updateParticipantStatus(data);
        });

        socket.on('hand-raised', (data) => {
            showRaisedHandNotification(data);
        });

        socket.on('system-message', (data) => {
            addSystemMessage(data.message);
        });

        socket.on('meeting-ended', (data) => {
            handleMeetingEnded(data);
        });

        socket.on('current-participants', (participants) => {
            participants.forEach(participant => {
                if (participant.socketId !== socket.id && !participant.isObserver) {
                    connectToNewUser(participant.socketId);
                }
            });
            updateParticipantCount();
        });

        // Get user media (camera and microphone) if not observer
        if (!isReconnecting) {
            await getUserMedia();
        } else {
            // Observer mode - no media
            isObserver = true;
            const localVideo = document.getElementById('localVideo');
            localVideo.style.display = 'none';
            updateUIForObserverMode();
        }

        // Setup event listeners
        setupEventListeners();

        // Update participant list
        updateParticipantList();

        // Generate invite link
        generateInviteLink();

        // Add welcome message
        addSystemMessage(`Welcome to the meeting, ${username}!`);

    } catch (error) {
        console.error('Error initializing room:', error);
        alert('Failed to initialize video conference. Please check your camera and microphone permissions.');
    }
}

async function getUserMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        localVideo.play();

        // Add local user to participant list
        addParticipant(username, true);

        // Initialize controls
        updateControlButtons();

    } catch (error) {
        console.error('Error accessing media devices:', error);

        // Try audio only
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

            const localVideo = document.getElementById('localVideo');
            localVideo.style.display = 'none';

            addParticipant(username, true);
            updateControlButtons();

            showNotification('Using audio only mode', 'warning');
        } catch (audioError) {
            console.error('Error accessing audio:', audioError);
            showNotification('Failed to access media devices', 'error');
        }
    }
}

function updateControlButtons() {
    const micBtn = document.getElementById('micToggle');
    const videoBtn = document.getElementById('videoToggle');

    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        const videoTracks = localStream.getVideoTracks();

        isMuted = audioTracks.length > 0 ? !audioTracks[0].enabled : true;
        isVideoOff = videoTracks.length > 0 ? !videoTracks[0].enabled : true;

        // Update mic button
        if (isMuted) {
            micBtn.classList.remove('active');
            micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Unmute</span>';
        } else {
            micBtn.classList.add('active');
            micBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Mute</span>';
        }

        // Update video button
        if (isVideoOff) {
            videoBtn.classList.remove('active');
            videoBtn.innerHTML = '<i class="fas fa-video-slash"></i><span>Start Video</span>';
        } else {
            videoBtn.classList.add('active');
            videoBtn.innerHTML = '<i class="fas fa-video"></i><span>Stop Video</span>';
        }
    }
}

function setupEventListeners() {
    // Mic toggle
    document.getElementById('micToggle').addEventListener('click', toggleMic);

    // Video toggle
    document.getElementById('videoToggle').addEventListener('click', toggleVideo);

    // Screen share
    document.getElementById('screenShareBtn').addEventListener('click', toggleScreenShare);

    // End call - updated to show options
    document.getElementById('endCallBtn').addEventListener('click', showEndCallOptions);

    // Leave button
    document.getElementById('leaveBtn').addEventListener('click', () => {
        if (confirm('Leave the meeting?')) {
            leaveMeeting();
        }
    });

    // Invite button
    document.getElementById('inviteBtn').addEventListener('click', showInviteModal);

    // Email invite button (new)
    const emailInviteBtn = document.createElement('button');
    emailInviteBtn.className = 'control-btn';
    emailInviteBtn.innerHTML = '<i class="fas fa-envelope"></i><span>Email</span>';
    emailInviteBtn.id = 'emailInviteBtn';
    document.querySelector('.control-center').prepend(emailInviteBtn);

    emailInviteBtn.addEventListener('click', showEmailInviteModal);

    // Chat input
    document.getElementById('sendMessage').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Modal close
    document.getElementById('closeInviteModal').addEventListener('click', hideInviteModal);
    document.getElementById('copyLinkBtn').addEventListener('click', copyInviteLink);

    // Chat toggle
    document.getElementById('chatToggle').addEventListener('click', toggleChat);

    // Theme toggle
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-theme');
            const icon = this.querySelector('i');
            if (icon.classList.contains('fa-moon')) {
                icon.classList.replace('fa-moon', 'fa-sun');
            } else {
                icon.classList.replace('fa-sun', 'fa-moon');
            }
            localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
        });

        // Load saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
        }
    }

    // Add email option to existing invite modal
    const inviteModalContent = document.querySelector('#inviteModal .invite-content');
    if (inviteModalContent) {
        const emailOption = document.createElement('div');
        emailOption.className = 'invite-method';
        emailOption.innerHTML = `
            <h4><i class="fas fa-envelope"></i> Send Email Invitation</h4>
            <p>Send an email invitation with the meeting link</p>
            <button class="btn-primary" id="openEmailModalBtn" style="width: 100%; margin-top: 10px;">
                <i class="fas fa-envelope"></i> Open Email Form
            </button>
        `;
        inviteModalContent.appendChild(emailOption);

        document.getElementById('openEmailModalBtn').addEventListener('click', () => {
            hideInviteModal();
            showEmailInviteModal();
        });
    }

    // Setup email modal events
    document.getElementById('cancelEmail').addEventListener('click', () => {
        hideModal(emailInviteModal);
    });

    document.getElementById('sendEmailBtn').addEventListener('click', sendEmailInvitation);

    // Setup end call modal events
    document.querySelectorAll('.end-option').forEach(option => {
        option.addEventListener('click', function() {
            const action = this.dataset.action;
            handleEndCall(action);
        });
    });

    document.getElementById('cancelEndCall').addEventListener('click', () => {
        hideModal(endCallModal);
    });

    // Setup call ended screen events
    document.getElementById('rejoinBtn').addEventListener('click', rejoinMeeting);
    document.getElementById('newMeetingBtn').addEventListener('click', () => {
        window.location.href = 'conference.html';
    });
    document.getElementById('goHomeBtn').addEventListener('click', () => {
        window.location.href = '/';
    });
}

// ========== EMAIL FUNCTIONALITY ==========

function showEmailInviteModal() {
    // Update preview
    document.getElementById('previewLink').textContent = window.location.href;
    document.getElementById('previewHost').textContent = username;
    document.getElementById('meetingTitle').value = document.getElementById('roomName').textContent;

    showModal(emailInviteModal);
}

async function sendEmailInvitation() {
    const email = document.getElementById('recipientEmail').value;
    const name = document.getElementById('recipientName').value || 'Friend';
    const title = document.getElementById('meetingTitle').value || document.getElementById('roomName').textContent;

    if (!email) {
        showNotification('Please enter recipient email', 'error');
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    const btn = document.getElementById('sendEmailBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    btn.disabled = true;

    const statusEl = document.getElementById('emailStatus');

    try {
        const meetingLink = window.location.href;
        const response = await fetch('/api/send-invitation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                toEmail: email,
                toName: name,
                meetingTitle: title,
                meetingLink: meetingLink,
                hostName: username
            })
        });

        const result = await response.json();

        if (result.success) {
            statusEl.textContent = 'Invitation sent successfully!';
            statusEl.className = 'email-status success';

            // Clear form
            document.getElementById('recipientEmail').value = '';
            document.getElementById('recipientName').value = '';

            // Add to chat
            addSystemMessage(`Email invitation sent to ${name} (${email})`);

            // Hide modal after delay
            setTimeout(() => {
                hideModal(emailInviteModal);
                statusEl.textContent = '';
                statusEl.className = 'email-status';
            }, 2000);

            showNotification(`Invitation sent to ${email}`, 'success');

        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error('Email sending failed:', error);
        statusEl.textContent = 'Failed to send invitation: ' + error.message;
        statusEl.className = 'email-status error';
        showNotification('Failed to send email: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ========== END CALL FUNCTIONALITY ==========

function showEndCallOptions() {
    showModal(endCallModal);
}

function handleEndCall(action) {
    switch(action) {
        case 'leave':
            leaveCallButStayOnPage();
            break;
        case 'end-all':
            endMeetingForAll();
            break;
        case 'leave-page':
            leaveMeeting();
            break;
    }
    hideModal(endCallModal);
}

function leaveCallButStayOnPage() {
    // Stop local media streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    // Close all peer connections
    Object.values(peers).forEach(peer => peer.close());
    peers = {};

    // Update socket status
    if (socket) {
        socket.emit('leave-as-observer', { roomId, username });
    }

    // Update UI for observer mode
    document.querySelector('.room-container').classList.add('observer-mode');
    callEndedScreen.style.display = 'flex';
    document.querySelector('.room-controls').style.display = 'none';

    // Save meeting info for rejoin
    document.getElementById('endedRoomName').textContent = roomId;
    document.getElementById('endedMeetingId').textContent = roomId;

    // Calculate duration
    const duration = calculateMeetingDuration();
    document.getElementById('endedDuration').textContent = duration;

    // Add system message
    addSystemMessage(`${username} has left the meeting (observer mode)`);

    showNotification('You have left the call but can rejoin anytime', 'info');

    // Update observer status
    isObserver = true;
}

function rejoinMeeting() {
    // Hide ended screen
    callEndedScreen.style.display = 'none';

    // Restore controls
    document.querySelector('.room-controls').style.display = 'flex';
    document.querySelector('.room-container').classList.remove('observer-mode');

    // Reinitialize media and connections
    reconnectToMeeting();

    showNotification('Rejoining meeting...', 'info');
    addSystemMessage(`${username} has rejoined the meeting`);

    // Update observer status
    isObserver = false;
}

async function reconnectToMeeting() {
    try {
        await getUserMedia();

        // Reconnect to existing participants
        Object.keys(peers).forEach(userId => {
            connectToNewUser(userId);
        });

        // Update socket
        if (socket) {
            socket.emit('rejoin-meeting', { roomId, username });
            socket.emit('participant-update', {
                roomId,
                username,
                isMuted,
                isVideoOff,
                isObserver: false
            });
        }

    } catch (error) {
        console.error('Error reconnecting:', error);
        showNotification('Failed to reconnect', 'error');
    }
}

function endMeetingForAll() {
    if (confirm('Are you sure you want to end the meeting for everyone? This cannot be undone.')) {
        // Send end meeting signal to all participants
        if (socket) {
            socket.emit('end-meeting-for-all', {
                roomId,
                username
            });
        }

        // Stop all media
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        if (screenStream) screenStream.getTracks().forEach(track => track.stop());

        // Clear timer
        clearInterval(timerInterval);

        // Close connections
        Object.values(peers).forEach(peer => peer.close());
        peers = {};

        // Add system message
        addSystemMessage(`${username} ended the meeting for all participants`);

        // Redirect to homepage after delay
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);

        showNotification('Meeting ended for all participants', 'info');
    }
}

function handleMeetingEnded(data) {
    showNotification(`${data.endedBy} ended the meeting`, 'error');
    addSystemMessage(`${data.endedBy} ended the meeting`);

    // Clear timer
    clearInterval(timerInterval);

    // Stop all media
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());

    // Close connections
    Object.values(peers).forEach(peer => peer.close());
    peers = {};

    // Redirect to homepage
    setTimeout(() => {
        window.location.href = '/';
    }, 3000);
}

function leaveMeeting() {
    // Stop all media
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());

    // Close connections
    Object.values(peers).forEach(peer => peer.close());

    // Disconnect socket
    if (socket) {
        socket.emit('leave-room', { roomId, username });
        socket.disconnect();
    }

    // Clear timer
    clearInterval(timerInterval);

    // Redirect to conference page
    window.location.href = 'conference.html';
}

// ========== HELPER FUNCTIONS ==========

function showModal(modal) {
    modal.style.display = 'flex';
}

function hideModal(modal) {
    modal.style.display = 'none';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    // Add to body
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function addSystemMessage(message) {
    const chatMessages = document.getElementById('chatMessages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message system-message';

    const messageSpan = document.createElement('div');
    messageSpan.className = 'message-text';
    messageSpan.textContent = message;

    const timestamp = document.createElement('div');
    timestamp.className = 'message-time';
    timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.appendChild(messageSpan);
    messageDiv.appendChild(timestamp);

    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startMeetingTimer() {
    meetingStartTime = new Date();
    const timerElement = document.getElementById('meetingTimer');

    timerInterval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now - meetingStartTime) / 1000);

        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;

        timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function calculateMeetingDuration() {
    const now = new Date();
    const diff = Math.floor((now - meetingStartTime) / 1000);

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateUIForObserverMode() {
    // Disable media controls
    document.getElementById('micToggle').disabled = true;
    document.getElementById('videoToggle').disabled = true;
    document.getElementById('screenShareBtn').disabled = true;

    // Update button text
    document.getElementById('micToggle').innerHTML = '<i class="fas fa-microphone-slash"></i><span>Observer</span>';
    document.getElementById('videoToggle').innerHTML = '<i class="fas fa-video-slash"></i><span>Observer</span>';

    // Add observer badge to local video
    const localContainer = document.querySelector('.local-video-container');
    if (localContainer) {
        const observerBadge = document.createElement('div');
        observerBadge.className = 'observer-badge';
        observerBadge.innerHTML = '<i class="fas fa-eye"></i> Observer';
        localContainer.appendChild(observerBadge);
    }
}

function showRaisedHandNotification(data) {
    showNotification(`${data.username} raised their hand`, 'info');
}

// ========== EXISTING FUNCTIONS (updated as needed) ==========

// ... [Keep all your existing WebRTC functions but update them to handle observer mode] ...

function connectToNewUser(userId) {
    // Don't create peer connection for observers
    if (isObserver) return;

    // Create peer connection
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });

    peers[userId] = peerConnection;

    // Add local stream to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        createVideoElement(userId, remoteStream);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', {
                to: userId,
                from: socket.id,
                candidate: event.candidate
            });
        }
    };

    // Create offer
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('signal', {
                to: userId,
                from: socket.id,
                offer: peerConnection.localDescription
            });
        })
        .catch(error => {
            console.error('Error creating offer:', error);
        });
}

function handleSignal(data) {
    const peerConnection = peers[data.from] || new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });

    if (!peers[data.from]) {
        peers[data.from] = peerConnection;

        // Add local stream if not observer
        if (localStream && !isObserver) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }

        // Handle incoming tracks
        peerConnection.ontrack = (event) => {
            const remoteStream = event.streams[0];
            createVideoElement(data.from, remoteStream);
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('signal', {
                    to: data.from,
                    from: socket.id,
                    candidate: event.candidate
                });
            }
        };
    }

    if (data.offer) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
            .then(() => peerConnection.createAnswer())
            .then(answer => peerConnection.setLocalDescription(answer))
            .then(() => {
                socket.emit('signal', {
                    to: data.from,
                    from: socket.id,
                    answer: peerConnection.localDescription
                });
            })
            .catch(error => {
                console.error('Error handling offer:', error);
            });
    } else if (data.answer) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            .catch(error => {
                console.error('Error setting remote description:', error);
            });
    } else if (data.candidate) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch(error => {
                console.error('Error adding ICE candidate:', error);
            });
    }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (socket && !isObserver) {
        socket.emit('leave-room', { roomId, username });
    }
});

// Add to your existing CSS or create a new CSS section
const observerModeStyles = `
    .observer-mode .control-btn:not(#endCallBtn):not(#chatToggle) {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .observer-badge {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(52, 152, 219, 0.9);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
        z-index: 10;
    }

    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    }

    .notification.success {
        background: #44bd32;
        color: white;
    }

    .notification.error {
        background: #e84118;
        color: white;
    }

    .notification.info {
        background: #3498db;
        color: white;
    }

    .notification.warning {
        background: #fbc531;
        color: #333;
    }

    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    .system-message {
        background: rgba(52, 152, 219, 0.1);
        border-left: 3px solid #3498db;
        padding: 10px;
        margin: 5px 0;
        font-style: italic;
        font-size: 0.9rem;
    }

    .message-time {
        font-size: 0.8rem;
        color: #666;
        text-align: right;
        margin-top: 2px;
    }
`;

// Inject styles
const styleSheet = document.createElement("style");
styleSheet.textContent = observerModeStyles;
document.head.appendChild(styleSheet);