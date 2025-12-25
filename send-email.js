const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Email configuration - Use environment variables in production
const transporter = nodemailer.createTransport({
    service: 'gmail', // or use SMTP settings
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Store temporary meeting links (in production, use a database)
const meetingLinks = new Map();

// Generate unique meeting token
function generateMeetingToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Send meeting invitation email
router.post('/send-invitation', async (req, res) => {
    try {
        const { toEmail, toName, meetingTitle, meetingHost, meetingLink } = req.body;

        if (!toEmail || !meetingTitle || !meetingLink) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Generate meeting token
        const meetingToken = generateMeetingToken();
        const meetingId = meetingLink.split('room=')[1]?.split('&')[0] || 'general';

        // Store meeting link with token
        meetingLinks.set(meetingToken, {
            email: toEmail,
            meetingId: meetingId,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        });

        const joinLink = `${process.env.BASE_URL || 'https://your-vercel-app.vercel.app'}/join?token=${meetingToken}`;

        // Email content
        const mailOptions = {
            from: `"VCONNECT" <${process.env.EMAIL_USER || 'noreply@vconnect.com'}>`,
            to: toEmail,
            subject: `Meeting Invitation: ${meetingTitle}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
                        .header { background: linear-gradient(135deg, #44bd32, #273c75); color: white; padding: 30px; text-align: center; }
                        .content { padding: 30px; background: #f5f6fa; }
                        .button { display: inline-block; padding: 15px 30px; background: #44bd32; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
                        .details { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
                        .footer { text-align: center; padding: 20px; color: #718093; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>VCONNECT</h1>
                            <h2>Meeting Invitation</h2>
                        </div>
                        <div class="content">
                            <p>Hello ${toName || 'there'},</p>
                            <p>You have been invited to join a video conference meeting.</p>

                            <div class="details">
                                <h3>Meeting Details:</h3>
                                <p><strong>Meeting Title:</strong> ${meetingTitle}</p>
                                <p><strong>Host:</strong> ${meetingHost || 'VCONNECT User'}</p>
                                <p><strong>Meeting ID:</strong> ${meetingId}</p>
                                <p><strong>Time:</strong> Right now (ongoing)</p>
                            </div>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${joinLink}" class="button">Join Meeting Now</a>
                            </div>

                            <p>Or copy and paste this link in your browser:</p>
                            <p style="background: white; padding: 10px; border-radius: 5px; word-break: break-all;">
                                ${joinLink}
                            </p>

                            <p><strong>Meeting Guidelines:</strong></p>
                            <ul>
                                <li>Make sure you have a stable internet connection</li>
                                <li>Use Chrome, Firefox, or Edge for best experience</li>
                                <li>Allow camera and microphone access when prompted</li>
                                <li>Join 5 minutes early to test your setup</li>
                            </ul>

                            <p>If you didn't expect this invitation, please ignore this email.</p>

                            <p>Best regards,<br>The VCONNECT Team</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message. Please do not reply to this email.</p>
                            <p>© ${new Date().getFullYear()} VCONNECT Video Conferencing</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        // Clean up expired tokens periodically
        cleanupExpiredTokens();

        res.json({
            success: true,
            message: 'Invitation sent successfully',
            messageId: info.messageId,
            joinLink: joinLink
        });

    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send invitation',
            error: error.message
        });
    }
});

// Join meeting via token
router.get('/join/:token', (req, res) => {
    const { token } = req.params;
    const meetingData = meetingLinks.get(token);

    if (!meetingData) {
        return res.status(404).send('Invalid or expired meeting link');
    }

    if (meetingData.expiresAt < Date.now()) {
        meetingLinks.delete(token);
        return res.status(410).send('Meeting link has expired');
    }

    // Redirect to conference page with meeting ID
    res.redirect(`/conference.html?room=${meetingData.meetingId}`);
});

// Clean up expired tokens
function cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of meetingLinks.entries()) {
        if (data.expiresAt < now) {
            meetingLinks.delete(token);
        }
    }
}

// Clean up every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = router;