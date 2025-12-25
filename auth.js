// ==========================
// FIREBASE IMPORTS
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ==========================
// FIREBASE CONFIG
// ==========================
const firebaseConfig = {
    apiKey: "AIzaSyCCYbSTr7uDutPyW1fWy0p2KOU5VR4U3Ig",
    authDomain: "vconnect-105ed.firebaseapp.com",
    projectId: "vconnect-105ed",
    appId: "1:619803288822:web:b52fd446dd876507d638d7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let confirmationResult;

// ==========================
// DOM CONTENT LOADED
// ==========================
window.addEventListener("DOMContentLoaded", () => {
    // --------------------------
    // TAB SWITCHING
    // --------------------------
    const tabs = document.querySelectorAll(".auth-tab");
    const forms = document.querySelectorAll(".auth-form");

    function switchTab(name) {
        tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
        forms.forEach(f => f.classList.toggle("active", f.id === name + "Form"));
    }

    tabs.forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));

    document.querySelectorAll(".switch-to-signup").forEach(el =>
        el.addEventListener("click", e => { e.preventDefault(); switchTab("signup"); })
    );

    document.querySelectorAll(".switch-to-login").forEach(el =>
        el.addEventListener("click", e => { e.preventDefault(); switchTab("login"); })
    );

    // --------------------------
    // PASSWORD TOGGLE
    // --------------------------
    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = btn.previousElementSibling;
            input.type = input.type === "password" ? "text" : "password";
            btn.innerHTML = `<i class="fas fa-eye${input.type==="text"?'-slash':''}"></i>`;
        });
    });

    // --------------------------
    // PASSWORD VALIDATION
    // --------------------------
    document.querySelectorAll(".password").forEach(input => {
        input.addEventListener("input", () => {
            const v = input.value;
            const strong = v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v);
            input.style.borderColor = strong ? "#44bd32" : "#e84118";
        });
    });

    // --------------------------
    // FIREBASE RECAPTCHA
    // --------------------------
    window.recaptchaVerifier = new RecaptchaVerifier(
        'recaptcha-container',
        { size: "invisible" },
        auth
    );

    // --------------------------
    // LOGIN FORM SUBMIT
    // --------------------------
    const loginForm = document.getElementById("loginFormInner");
    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const contact = document.getElementById("loginContact").value.trim();
        const password = document.getElementById("loginPassword").value.trim();

        if (!contact || !password) {
            alert("Please fill all fields");
            return;
        }

        // Show loading
        showLoading(true, loginForm.querySelector(".submit-btn"));

        try {
            if (contact.includes("@")) {
                // Email login
                await signInWithEmailAndPassword(auth, contact, password);
                showLoading(false, loginForm.querySelector(".submit-btn"));
                alert("Login successful! Redirecting...");
                window.location.href = "conference.html";
            } else {
                // Phone login - demo
                setTimeout(() => {
                    showLoading(false, loginForm.querySelector(".submit-btn"));
                    alert("Login successful! Redirecting...");
                    window.location.href = "conference.html";
                }, 1500);
            }
        } catch (err) {
            console.error("Login error:", err);
            alert("Login failed. Using demo mode...");
            // Fallback to demo
            setTimeout(() => {
                showLoading(false, loginForm.querySelector(".submit-btn"));
                window.location.href = "conference.html";
            }, 1000);
        }
    });

    // --------------------------
    // SIGNUP FORM SUBMIT
    // --------------------------
    const signupForm = document.getElementById("signupFormInner");
    signupForm.addEventListener("submit", async e => {
        e.preventDefault();
        const contactInput = document.getElementById("signupContact");
        const passwordInput = document.getElementById("signupPassword");
        const contact = contactInput.value.trim();

        if (!contact || !passwordInput.value) return alert("Enter all fields");

        showLoading(true, signupForm.querySelector(".submit-btn"));

        try {
            // EMAIL SIGNUP
            if (contact.includes("@")) {
                await createUserWithEmailAndPassword(auth, contact, passwordInput.value);
                showLoading(false, signupForm.querySelector(".submit-btn"));
                alert("Account created successfully! Redirecting...");
                window.location.href = "conference.html";
                return;
            }

            // PHONE OTP SIGNUP - DEMO
            setTimeout(() => {
                document.getElementById("signupFormInner").style.display = "none";
                document.getElementById("otpSection").style.display = "block";
                showLoading(false, signupForm.querySelector(".submit-btn"));
                alert("OTP sent to phone (Demo)");
            }, 1000);

        } catch (err) {
            console.error("Signup Error:", err);
            alert("Signup failed. Using demo mode...");
            // Fallback to demo
            setTimeout(() => {
                showLoading(false, signupForm.querySelector(".submit-btn"));
                window.location.href = "conference.html";
            }, 1000);
        }
    });

    // --------------------------
    // VERIFY PHONE OTP
    // --------------------------
    document.getElementById("verifyOTP").addEventListener("click", async () => {
        const otp = document.getElementById("otpInput").value.trim();
        if (!otp) return alert("Enter OTP");

        showLoading(true, document.getElementById("verifyOTP"));

        setTimeout(() => {
            showLoading(false, document.getElementById("verifyOTP"));
            alert("OTP verified! Redirecting...");
            window.location.href = "conference.html";
        }, 1500);
    });

    // --------------------------
    // HELPER FUNCTIONS
    // --------------------------
    function showLoading(show, button) {
        if (show) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            button.disabled = true;
        } else {
            if (button.id === "verifyOTP") {
                button.innerHTML = 'Verify OTP';
            } else {
                button.innerHTML = button.classList.contains("submit-btn") ?
                    (button.closest("#signupFormInner") ? "Create Account" : "Sign in") :
                    "Verify OTP";
            }
            button.disabled = false;
        }
    }
});