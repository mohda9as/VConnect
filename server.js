const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins, or specify your domain
        methods: ["GET", "POST"]
    }
});

// Store active rooms and users
const rooms = new Map();
// Store meeting links for email invitations
const meetingLinks = new Map();

// Email transporter setup
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    console.log('Email service enabled');
} else {
    console.log('Email service disabled - set EMAIL_USER and EMAIL_PASS in .env');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../')); // Serve static files from parent directory

// Generate unique meeting token
function generateMeetingToken() {
    return crypto.randomBytes(16).toString('hex');
}

// API endpoint to send email invitations
app.post('/api/send-invitation', async (req, res) => {
    try {
        if (!transporter) {
            return res.status(500).json({
                success: false,
                message: 'Email service not configured'
            });
        }

        const { toEmail, toName, meetingTitle, meetingLink, hostName } = req.body;

        if (!toEmail || !meetingLink) {
            return res.status(400).json({
                success: false,
                message: 'Email and meeting link are required'
            });
        }

        // Generate token for secure join link
        const token = generateMeetingToken();
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        const joinLink = `${baseUrl}/join?token=${token}&room=${encodeURIComponent(meetingLink.split('room=')[1])}`;

        // Store the meeting link temporarily
        meetingLinks.set(token, {
            meetingLink: meetingLink,
            email: toEmail,
            expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        });

        // Email content
        const mailOptions = {
            from: `"VCONNECT" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `Meeting Invitation: ${meetingTitle || 'Video Conference'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f6fa; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #44bd32, #273c75); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0;">VCONNECT</h1>
                        <p style="font-size: 18px; margin: 10px 0 0 0;">Video Conference Invitation</p>
                    </div>

                    <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2>You're invited to a meeting!</h2>
                        <p>Hello ${toName || 'there'},</p>
                        <p>${hostName || 'A VCONNECT user'} has invited you to join a video conference meeting.</p>

                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #44bd32; margin-top: 0;">Meeting Details:</h3>
                            <p><strong>Title:</strong> ${meetingTitle || 'Video Conference'}</p>
                            <p><strong>Host:</strong> ${hostName || 'VCONNECT User'}</p>
                            <p><strong>Status:</strong> Meeting is waiting to start</p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${joinLink}"
                               style="background: #44bd32; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                                Join Meeting Now
                            </a>
                        </div>

                        <p>Or copy and paste this link in your browser:</p>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 14px;">
                            ${joinLink}
                        </div>

                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                        <p><strong>Tips for the meeting:</strong></p>
                        <ul style="color: #555;">
                            <li>Use Chrome, Firefox, or Edge for best experience</li>
                            <li>Allow camera and microphone access when prompted</li>
                            <li>Use headphones to avoid echo</li>
                            <li>Join a few minutes early to test your setup</li>
                        </ul>

                        <p style="color: #777; font-size: 14px; margin-top: 30px;">
                            This invitation was sent from VCONNECT Video Conferencing.
                            If you received this email by mistake, please ignore it.
                        </p>
                    </div>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.json({
            success: true,
            message: 'Invitation sent successfully',
            joinLink: joinLink
        });

    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send email',
            error: error.message
        });
    }
});

// Join meeting via token
app.get('/join', (req, res) => {
    const { token, room } = req.query;

    if (room) {
        // Direct join with room parameter
        return res.redirect(`/room?room=${room}`);
    }

    if (!token) {
        return res.redirect('/conference');
    }

    const meetingData = meetingLinks.get(token);
    if (!meetingData) {
        return res.send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h2>Invalid or expired meeting link</h2>
                    <p>This meeting link has expired or is invalid.</p>
                    <a href="/">Go to Homepage</a>
                </body>
            </html>
        `);
    }

    // Extract room ID from meeting link
    const roomId = meetingData.meetingLink.split('room=')[1];
    if (roomId) {
        res.redirect(`/room?room=${roomId}`);
    } else {
        res.redirect('/conference');
    }
});

// Clean up expired tokens every hour
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of meetingLinks.entries()) {
        if (data.expires < now) {
            meetingLinks.delete(token);
        }
    }
}, 60 * 60 * 1000);

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join room
    socket.on('join-room', ({ roomId, username, isReconnecting = false }) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = username;

        // Add user to room
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        rooms.get(roomId).set(socket.id, {
            username,
            socketId: socket.id,
            isMuted: false,
            isVideoOff: false,
            isObserver: isReconnecting || false
        });

        if (!isReconnecting) {
            // Notify others in the room about new participant
            socket.to(roomId).emit('user-connected', {
                socketId: socket.id,
                username: username,
                isObserver: false
            });
        }

        // Send current participants to the new user
        const participants = Array.from(rooms.get(roomId).values())
            .filter(user => user.socketId !== socket.id)
            .map(user => ({
                socketId: user.socketId,
                username: user.username,
                isMuted: user.isMuted,
                isVideoOff: user.isVideoOff,
                isObserver: user.isObserver
            }));

        socket.emit('current-participants', participants);

        // Update all participants
        updateParticipants(roomId);

        console.log(`${username} joined room ${roomId}${isReconnecting ? ' (observer)' : ''}`);
    });

    // Handle WebRTC signaling
    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', {
            ...data,
            from: socket.id
        });
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        io.to(data.roomId).emit('chat-message', {
            username: data.username,
            message: data.message,
            timestamp: new Date().toISOString()
        });
    });

    // Handle participant updates (mute/unmute, video on/off)
    socket.on('participant-update', (data) => {
        // Update user state in room
        if (rooms.has(data.roomId)) {
            const room = rooms.get(data.roomId);
            const user = room.get(socket.id);
            if (user) {
                user.isMuted = data.isMuted;
                user.isVideoOff = data.isVideoOff;
                user.isObserver = data.isObserver || false;
            }
        }

        socket.to(data.roomId).emit('participant-updated', {
            socketId: socket.id,
            username: data.username,
            isMuted: data.isMuted,
            isVideoOff: data.isVideoOff,
            isObserver: data.isObserver || false
        });
    });

    // Handle raise hand
    socket.on('raise-hand', (data) => {
        io.to(data.roomId).emit('hand-raised', {
            socketId: socket.id,
            username: data.username
        });
    });

    // Handle system messages
    socket.on('system-message', (data) => {
        io.to(data.roomId).emit('system-message', {
            message: data.message,
            timestamp: new Date().toISOString()
        });
    });

    // Handle end meeting for all
    socket.on('end-meeting-for-all', (data) => {
        io.to(data.roomId).emit('meeting-ended', {
            endedBy: data.username,
            timestamp: new Date().toISOString()
        });

        // Clean up room
        if (rooms.has(data.roomId)) {
            rooms.delete(data.roomId);
        }
    });

    // Handle user leaving as observer
    socket.on('leave-as-observer', ({ roomId, username }) => {
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            const user = room.get(socket.id);
            if (user) {
                user.isObserver = true;

                // Notify others
                socket.to(roomId).emit('participant-updated', {
                    socketId: socket.id,
                    username: username,
                    isObserver: true
                });

                console.log(`${username} is now observer in room ${roomId}`);
            }
        }
    });

    // Handle user rejoining
    socket.on('rejoin-meeting', ({ roomId, username }) => {
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            const user = room.get(socket.id);
            if (user) {
                user.isObserver = false;

                // Notify others
                socket.to(roomId).emit('participant-updated', {
                    socketId: socket.id,
                    username: username,
                    isObserver: false
                });

                console.log(`${username} rejoined meeting in room ${roomId}`);
            }
        }
    });

    // Handle leaving room
    socket.on('leave-room', ({ roomId, username }) => {
        leaveRoom(socket, roomId, username);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (roomId) {
            leaveRoom(socket, roomId, socket.username);
        }
        console.log('Client disconnected:', socket.id);
    });
});

function leaveRoom(socket, roomId, username) {
    if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        const user = room.get(socket.id);

        if (user) {
            // Notify others
            socket.to(roomId).emit('user-disconnected', socket.id);

            // Remove user from room
            room.delete(socket.id);

            // Remove room if empty
            if (room.size === 0) {
                rooms.delete(roomId);
            } else {
                updateParticipants(roomId);
            }

            console.log(`${username || 'User'} left room ${roomId}`);
        }
    }
    socket.leave(roomId);
}

function updateParticipants(roomId) {
    if (rooms.has(roomId)) {
        const participants = Array.from(rooms.get(roomId).values())
            .map(user => ({
                socketId: user.socketId,
                username: user.username,
                isMuted: user.isMuted,
                isVideoOff: user.isVideoOff,
                isObserver: user.isObserver || false
            }));
        io.to(roomId).emit('participants-updated', participants);
    }
}

// Serve the main pages
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '../' });
});

app.get('/conference', (req, res) => {
    res.sendFile('conference.html', { root: '../' });
});

app.get('/room', (req, res) => {
    res.sendFile('room.html', { root: '../' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rooms: rooms.size,
        emailEnabled: !!transporter,
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 VCONNECT Server running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
    console.log(`📧 Email service: ${transporter ? 'ENABLED' : 'DISABLED'}`);
});