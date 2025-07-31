const API_BASE = 'https://cook.beaverlyai.com';

class ChillaAuth {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTheme();
        this.checkAuthentication();
        this.simulateLoading();
    }

    async checkAuthentication() {
        try {
            const response = await fetch(`${API_BASE}/api/verify_token`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: null })
            });

            if (response.ok) {
                const json = await response.json();
                if (json.status === 'valid') {
                    // User is authenticated, redirect to dashboard
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
                    return;
                }
            }
        } catch (error) {
            console.warn('Silent auth check failed:', error);
        }

        // Show auth if not authenticated
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
        }, 1500);
    }

    setupEventListeners() {
        // Auth form listeners
        document.getElementById('show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            this.showScreen('signup-screen');
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showScreen('login-screen');
        });

        document.getElementById('forgot-password-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.showScreen('forgot-password-screen');
        });

        document.getElementById('back-to-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showScreen('login-screen');
        });

        // Auth buttons
        document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());
        document.getElementById('signup-btn').addEventListener('click', () => this.handleSignup());
        document.getElementById('reset-btn').addEventListener('click', () => this.handlePasswordReset());
        document.getElementById('google-login-btn').addEventListener('click', () => this.handleGoogleAuth());
        document.getElementById('google-signup-btn').addEventListener('click', () => this.handleGoogleAuth());

        // Enter key listeners
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const activeScreen = document.querySelector('.auth-screen:not(.hidden)');
                if (activeScreen) {
                    const button = activeScreen.querySelector('.primary-btn');
                    if (button) button.click();
                }
            }
        });
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('chilla-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    simulateLoading() {
        // Loading handled by checkAuthentication
    }

    showScreen(screenId) {
        const screens = document.querySelectorAll('.auth-screen');
        screens.forEach(screen => screen.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        this.showLoading('login-btn');

        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.status === 'success') {
                    // Store user email for later use
                    localStorage.setItem('chilla_user_email', email);
                    this.showNotification('Login successful!', 'success');
                    window.location.href = 'dashboard.html';
                } else {
                    this.showNotification(data.message || 'Login failed', 'error');
                }
            } else {
                this.showNotification(data.detail || data.message || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }

        this.hideLoading('login-btn');
    }

    async handleSignup() {
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const firstName = document.getElementById('first-name').value;
        const middleName = document.getElementById('middle-name').value;
        const lastName = document.getElementById('last-name').value;
        const dateOfBirth = document.getElementById('date-of-birth').value;

        if (!email || !password || !firstName || !lastName || !dateOfBirth) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        this.showLoading('signup-btn');

        const fullName = `${firstName} ${middleName} ${lastName}`.trim();

        try {
            const response = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, full_name: fullName })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.status === 'success') {
                    // Store user email for later use
                    localStorage.setItem('chilla_user_email', email);
                    this.showNotification('Account created! Check your email for verification.', 'success');
                    window.location.href = 'dashboard.html';
                } else {
                    this.showNotification(data.message || 'Registration failed', 'error');
                }
            } else {
                this.showNotification(data.detail || data.message || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }

        this.hideLoading('signup-btn');
    }

    async handlePasswordReset() {
        const email = document.getElementById('reset-email').value;

        if (!email) {
            this.showNotification('Please enter your email', 'error');
            return;
        }

        this.showLoading('reset-btn');

        try {
            const response = await fetch(`${API_BASE}/api/forgot_password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Password reset link sent to your email', 'success');
                this.showScreen('login-screen');
            } else {
                this.showNotification(data.detail || 'Reset failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }

        this.hideLoading('reset-btn');
    }

    async handleGoogleAuth() {
        const clientId = "514107671303-canjqpiuhlk97eigl1o9cv24i1bjpe54.apps.googleusercontent.com";
        const redirectUri = `${API_BASE}/auth/callback`;
        const scope = "https://www.googleapis.com/auth/userinfo.email";
        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=online&prompt=select_account`;

        window.location.href = oauthUrl;
    }

    showLoading(buttonId) {
        const button = document.getElementById(buttonId);
        button.disabled = true;
        button.innerHTML = '<span class="loading-spinner"></span>';
    }

    hideLoading(buttonId) {
        const button = document.getElementById(buttonId);
        button.disabled = false;

        const buttonTexts = {
            'login-btn': 'Sign In',
            'signup-btn': 'Create Account',
            'reset-btn': 'Send Reset Link'
        };

        button.innerHTML = buttonTexts[buttonId] || 'Submit';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize auth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChillaAuth();
});

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
