// Enhanced Authentication with Server-Side Validation
class ChillaAuth {
    constructor() {
        this.csrfToken = null;
        this.sessionValidated = false;
        this.initAuth();
    }

    async initAuth() {
        await this.validateSession();
        this.setupEventListeners();
        await this.loadCSRFToken();
    }

    async loadCSRFToken() {
        try {
            const response = await fetch('https://cook.beaverlyai.com/api/csrf_token', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.csrfToken = data.csrf_token;
            }
        } catch (error) {
            console.error('Failed to load CSRF token:', error);
        }
    }

    async validateSession() {
        try {
            const response = await fetch('https://cook.beaverlyai.com/api/verify_token', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'valid') {
                    this.sessionValidated = true;
                    window.location.href = 'dashboard.html';
                    return;
                }
            }

            this.sessionValidated = false;
            this.showAuthScreen();
        } catch (error) {
            console.error('Session validation error:', error);
            this.showAuthScreen();
        }
    }

    showAuthScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const authContainer = document.getElementById('auth-container');

        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (authContainer) authContainer.classList.remove('hidden');
    }

    setupEventListeners() {
        // Login form
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Signup form
        const signupBtn = document.getElementById('signup-btn');
        if (signupBtn) {
            signupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }

        // Google OAuth
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleGoogleAuth();
            });
        }

        // Password reset
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handlePasswordReset();
            });
        }

        // Navigation between forms
        this.setupFormNavigation();
    }

    async handleLogin() {
        const email = this.sanitizeInput(document.getElementById('login-email')?.value);
        const password = document.getElementById('login-password')?.value;

        if (!this.validateLoginInput(email, password)) {
            return;
        }

        try {
            const response = await fetch('https://cook.beaverlyai.com/api/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': this.csrfToken || ''
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                // Server sets secure HTTP-only cookie
                window.location.href = 'dashboard.html';
            } else {
                this.showError(data.detail || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    async handleSignup() {
        const formData = this.collectSignupData();

        if (!this.validateSignupInput(formData)) {
            return;
        }

        try {
            const response = await fetch('https://cook.beaverlyai.com/api/register', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': this.csrfToken || ''
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess('Registration successful! Please check your email for verification.');
                this.showLoginScreen();
            } else {
                this.showError(data.detail || 'Registration failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    async handleGoogleAuth() {
        try {
            const response = await fetch('https://cook.beaverlyai.com/api/oauth_config', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const config = await response.json();
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${config.client_id}&` +
                `redirect_uri=${encodeURIComponent(config.redirect_uri)}&` +
                `scope=${encodeURIComponent(config.scope)}&` +
                `response_type=code&` +
                `state=${config.state}`;

            window.location.href = authUrl;
        } catch (error) {
            console.error('Google auth error:', error);
            this.showError('Authentication service unavailable');
        }
    }

    async handlePasswordReset() {
        const email = this.sanitizeInput(document.getElementById('reset-email')?.value);

        if (!this.validateEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            const response = await fetch('https://cook.beaverlyai.com/api/forgot_password', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': this.csrfToken || ''
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            this.showSuccess(data.message || 'Reset link sent if account exists');
        } catch (error) {
            console.error('Password reset error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    collectSignupData() {
        return {
            email: this.sanitizeInput(document.getElementById('signup-email')?.value),
            password: document.getElementById('signup-password')?.value,
            confirm_password: document.getElementById('confirm-password')?.value,
            first_name: this.sanitizeInput(document.getElementById('first-name')?.value),
            middle_name: this.sanitizeInput(document.getElementById('middle-name')?.value),
            last_name: this.sanitizeInput(document.getElementById('last-name')?.value),
            date_of_birth: document.getElementById('date-of-birth')?.value
        };
    }

    validateLoginInput(email, password) {
        if (!email || !password) {
            this.showError('Email and password are required');
            return false;
        }

        if (!this.validateEmail(email)) {
            this.showError('Please enter a valid email address');
            return false;
        }

        return true;
    }

    validateSignupInput(data) {
        if (!data.email || !data.password || !data.confirm_password || !data.first_name || !data.last_name) {
            this.showError('Please fill in all required fields');
            return false;
        }

        if (!this.validateEmail(data.email)) {
            this.showError('Please enter a valid email address');
            return false;
        }

        if (data.password !== data.confirm_password) {
            this.showError('Passwords do not match');
            return false;
        }

        if (data.password.length < 8) {
            this.showError('Password must be at least 8 characters long');
            return false;
        }

        return true;
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    sanitizeInput(input) {
        if (!input) return '';
        return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    setupFormNavigation() {
        const showSignup = document.getElementById('show-signup');
        const showLogin = document.getElementById('show-login');
        const forgotPasswordLink = document.getElementById('forgot-password-link');
        const backToLogin = document.getElementById('back-to-login');

        if (showSignup) {
            showSignup.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSignupScreen();
            });
        }

        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginScreen();
            });
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForgotPasswordScreen();
            });
        }

        if (backToLogin) {
            backToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginScreen();
            });
        }
    }

    showLoginScreen() {
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('signup-screen')?.classList.add('hidden');
        document.getElementById('forgot-password-screen')?.classList.add('hidden');
    }

    showSignupScreen() {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('signup-screen')?.classList.remove('hidden');
        document.getElementById('forgot-password-screen')?.classList.add('hidden');
    }

    showForgotPasswordScreen() {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('signup-screen')?.classList.add('hidden');
        document.getElementById('forgot-password-screen')?.classList.remove('hidden');
    }

    showError(message) {
        // Create or update error display
        let errorDiv = document.querySelector('.auth-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'auth-error';
            const currentScreenElement = document.querySelector('.screen:not(.hidden)');
            const authForm = currentScreenElement?.querySelector('.auth-form');
            if(authForm) {
                authForm.prepend(errorDiv);
            } else {
                document.body.prepend(errorDiv); // Fallback if .auth-form not found
            }
        }
        errorDiv.textContent = message;
        errorDiv.style.color = '#ff4444';
        errorDiv.style.padding = '10px';
        errorDiv.style.marginBottom = '10px';
        errorDiv.style.border = '1px solid #ff4444';
        errorDiv.style.backgroundColor = '#ffebeb';
        errorDiv.style.borderRadius = '8px';
        errorDiv.style.textAlign = 'center';
    }

    showSuccess(message) {
        let successDiv = document.querySelector('.auth-success');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.className = 'auth-success';
            const currentScreenElement = document.querySelector('.screen:not(.hidden)');
            const authForm = currentScreenElement?.querySelector('.auth-form');
            if(authForm) {
                authForm.prepend(successDiv);
            } else {
                document.body.prepend(successDiv); // Fallback if .auth-form not found
            }
        }
        successDiv.textContent = message;
        successDiv.style.color = '#44ff44';
        successDiv.style.padding = '10px';
        successDiv.style.marginBottom = '10px';
        successDiv.style.border = '1px solid #4CAF50';
        successDiv.style.backgroundColor = '#e8f5e9';
        successDiv.style.borderRadius = '8px';
        successDiv.style.textAlign = 'center';
    }
}

// Initialize authentication when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new ChillaAuth();
});