
// Enhanced Authentication with Pure Server-Side Validation
class ChillaAuth {
    constructor() {
        this.csrfToken = null;
        this.sessionId = null;
        this.csrfTokenLoading = false;
        this.initAuth();
    }

    async initAuth() {
        await this.validateSession();
        this.setupEventListeners();
        // Load CSRF token after session validation
        await this.loadCSRFToken();
    }

    async loadCSRFToken(forceRefresh = false) {
        if (this.csrfTokenLoading && !forceRefresh) {
            // Wait for existing request to complete
            while (this.csrfTokenLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.csrfToken;
        }

        this.csrfTokenLoading = true;

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
                this.sessionId = data.session_id; // Store session ID for validation
                console.log('✅ CSRF token loaded successfully');
                return this.csrfToken;
            } else {
                console.error('❌ Failed to load CSRF token:', response.status);
                this.csrfToken = null;
                this.sessionId = null;
            }
        } catch (error) {
            console.error('❌ CSRF token request error:', error);
            this.csrfToken = null;
            this.sessionId = null;
        } finally {
            this.csrfTokenLoading = false;
        }

        return this.csrfToken;
    }

    async loadCSRFTokenForEmail(email) {
        this.csrfTokenLoading = true;

        try {
            const url = new URL('https://cook.beaverlyai.com/api/csrf_token');
            if (email) {
                url.searchParams.append('email', email);
            }

            const response = await fetch(url, {
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
                this.sessionId = data.session_id; // Store session ID for validation
                console.log('✅ CSRF token loaded successfully for email');
                return this.csrfToken;
            } else {
                console.error('❌ Failed to load CSRF token:', response.status);
                this.csrfToken = null;
                this.sessionId = null;
            }
        } catch (error) {
            console.error('❌ CSRF token request error:', error);
            this.csrfToken = null;
            this.sessionId = null;
        } finally {
            this.csrfTokenLoading = false;
        }

        return this.csrfToken;
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
                    // Server decides where user goes - no client-side decision making
                    if (data.redirect_to) {
                        window.location.href = data.redirect_to;
                        return;
                    }
                    window.location.href = 'dashboard.html';
                    return;
                }
            } else if (response.status === 401) {
                console.error('Session validation failed: 401 Unauthorized');
                this.showAuthScreen();
                return;
            }

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

        // Google OAuth - Login
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleGoogleAuth();
            });
        }

        // Google OAuth - Signup
        const googleSignupBtn = document.getElementById('google-signup-btn');
        if (googleSignupBtn) {
            googleSignupBtn.addEventListener('click', (e) => {
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

    async ensureCSRFToken() {
        if (!this.csrfToken) {
            await this.loadCSRFToken();
        }

        // If still no token, try one more time
        if (!this.csrfToken) {
            await this.loadCSRFToken(true);
        }

        return this.csrfToken;
    }

    async handleLogin() {
        // Get and validate form data
        const rawEmail = document.getElementById('login-email')?.value;
        const rawPassword = document.getElementById('login-password')?.value;

        // Client-side validation
        if (!rawEmail || !rawEmail.trim()) {
            this.showError('Please enter your email address');
            return;
        }

        if (!rawPassword) {
            this.showError('Please enter your password');
            return;
        }

        if (!rawEmail.includes('@') || !rawEmail.includes('.')) {
            this.showError('Please enter a valid email address');
            return;
        }

        let email, password;

        try {
            const loginData = this.validateInputTypes({
                email: rawEmail,
                password: rawPassword
            });

            email = loginData.email;
            password = loginData.password;
        } catch (error) {
            this.showError('Invalid input format detected');
            return;
        }

        // Ensure we have a valid CSRF token
        const csrfToken = await this.ensureCSRFToken();
        if (!csrfToken) {
            this.showError('Security token unavailable. Please refresh the page and try again.');
            return;
        }

        try {
            const requestBody = { email, password };
            if (this.sessionId) {
                requestBody.session_id = this.sessionId;
            }

            const response = await fetch('https://cook.beaverlyai.com/api/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': csrfToken,
                    'X-Session-ID': this.sessionId || ''
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                // Server handles all logic - just redirect to server-specified location
                window.location.href = data.redirect_to || 'dashboard.html';
            } else if (response.status === 403 && data.detail?.includes('CSRF')) {
                // CSRF token invalid - refresh and retry once
                console.log('🔄 CSRF token invalid, refreshing...');
                await this.loadCSRFToken(true);
                this.showError('Security token expired. Please try logging in again.');
            } else if (data.show_verification_modal) {
                // Server tells us to show verification modal
                this.showLoginVerificationModal(email);
            } else {
                // Show specific error messages from server
                let errorMessage = 'Login failed';
                if (data.detail) {
                    errorMessage = data.detail;
                } else if (data.message) {
                    errorMessage = data.message;
                } else if (response.status === 401) {
                    errorMessage = 'Invalid email or password. Please try again.';
                } else if (response.status === 422) {
                    errorMessage = 'Please check your email and password format.';
                } else if (response.status >= 500) {
                    errorMessage = 'Server error. Please try again later.';
                }
                this.showError(errorMessage);
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    async handleSignup() {
        // Collect and validate form data
        const rawFormData = this.collectSignupData();

        // Client-side validation
        if (!rawFormData.email || !rawFormData.email.trim()) {
            this.showError('Please enter your email address');
            return;
        }

        if (!rawFormData.email.includes('@') || !rawFormData.email.includes('.')) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (!rawFormData.password) {
            this.showError('Please enter a password');
            return;
        }

        if (rawFormData.password.length < 8) {
            this.showError('Password must be at least 8 characters long');
            return;
        }

        if (rawFormData.password !== rawFormData.confirm_password) {
            this.showError('Passwords do not match');
            return;
        }

        if (!rawFormData.first_name || !rawFormData.first_name.trim()) {
            this.showError('Please enter your first name');
            return;
        }

        if (!rawFormData.last_name || !rawFormData.last_name.trim()) {
            this.showError('Please enter your last name');
            return;
        }

        if (!rawFormData.date_of_birth) {
            this.showError('Please enter your date of birth');
            return;
        }

        let formData;

        try {
            formData = this.validateInputTypes(rawFormData);
        } catch (error) {
            this.showError('Invalid input format detected');
            return;
        }

        // Get CSRF token with email parameter for consistent validation
        const csrfToken = await this.loadCSRFTokenForEmail(formData.email);
        if (!csrfToken) {
            this.showError('Security token unavailable. Please refresh the page and try again.');
            return;
        }

        try {
            const requestBody = { ...formData };
            if (this.sessionId) {
                requestBody.session_id = this.sessionId;
            }

            const response = await fetch('https://cook.beaverlyai.com/api/register', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': csrfToken,
                    'X-Session-ID': this.sessionId || ''
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (response.ok) {
                this.showRegistrationSuccess(data.message || 'Registration successful! Please check your email for verification.');
                // Don't immediately switch to login screen
                return;
            } else if (response.status === 403 && (data.detail?.includes('CSRF') || data.detail?.includes('Invalid CSRF'))) {
                // CSRF token invalid - refresh and retry once automatically
                console.log('🔄 CSRF token invalid, refreshing and retrying...');
                const newCsrfToken = await this.loadCSRFToken(true);
                if (newCsrfToken) {
                    // Retry the registration with new token
                    try {
                        const retryRequestBody = { ...formData };
                        if (this.sessionId) {
                            retryRequestBody.session_id = this.sessionId;
                        }

                        const retryResponse = await fetch('https://cook.beaverlyai.com/api/register', {
                            method: 'POST',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-Token': newCsrfToken,
                                'X-Session-ID': this.sessionId || ''
                            },
                            body: JSON.stringify(retryRequestBody)
                        });

                        const retryData = await retryResponse.json();
                        if (retryResponse.ok) {
                            this.showRegistrationSuccess(retryData.message || 'Registration successful! Please check your email for verification.');
                            return;
                        } else {
                            let errorMessage = 'Registration failed';
                            if (retryData.detail) {
                                errorMessage = retryData.detail;
                            } else if (retryData.message) {
                                errorMessage = retryData.message;
                            } else if (retryResponse.status === 409) {
                                errorMessage = 'An account with this email already exists.';
                            } else if (retryResponse.status === 422) {
                                errorMessage = 'Please check your input and try again.';
                            }
                            this.showError(errorMessage);
                            return;
                        }
                    } catch (retryError) {
                        console.error('Registration retry error:', retryError);
                    }
                }
                this.showError('Security token issue. Please try again.');
            } else {
                this.showError(data.detail || data.message || 'Registration failed');
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

            if (!response.ok) {
                throw new Error(`OAuth config request failed: ${response.status}`);
            }

            const config = await response.json();

            // Validate config before using
            if (!config.client_id || !config.redirect_uri || !config.scope) {
                throw new Error('Invalid OAuth configuration received');
            }

            // Generate a random state for security
            const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(config.client_id)}&` +
                `redirect_uri=${encodeURIComponent(config.redirect_uri)}&` +
                `scope=${encodeURIComponent(config.scope)}&` +
                `response_type=code&` +
                `state=${encodeURIComponent(state)}&` +
                `access_type=online&` +
                `prompt=select_account`;

            console.log('🔄 Redirecting to Google OAuth...');
            window.location.href = authUrl;
        } catch (error) {
            console.error('Google auth error:', error);
            this.showError(`Authentication service unavailable: ${error.message}`);
        }
    }

    async handlePasswordReset() {
        // Get and validate email
        const rawEmail = document.getElementById('reset-email')?.value;

        if (!rawEmail || !rawEmail.trim()) {
            this.showError('Please enter your email address');
            return;
        }

        if (!rawEmail.includes('@') || !rawEmail.includes('.')) {
            this.showError('Please enter a valid email address');
            return;
        }

        const email = this.sanitizeInput(rawEmail);

        // Ensure we have a valid CSRF token
        const csrfToken = await this.ensureCSRFToken();
        if (!csrfToken) {
            this.showError('Security token unavailable. Please refresh the page and try again.');
            return;
        }

        try {
            const response = await fetch('https://cook.beaverlyai.com/api/forgot_password', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess(data.message || 'Reset link sent if account exists');
            } else if (response.status === 403 && data.detail?.includes('CSRF')) {
                // CSRF token invalid - refresh and retry once
                console.log('🔄 CSRF token invalid, refreshing...');
                await this.loadCSRFToken(true);
                this.showError('Security token expired. Please try again.');
            } else {
                this.showError(data.detail || data.message || 'Password reset failed');
            }
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

    sanitizeInput(input) {
        if (!input) return '';

        // Basic XSS protection
        let sanitized = input.toString().trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // NoSQL injection protection - remove MongoDB operators
        const nosqlPatterns = ['$ne', '$gt', '$lt', '$gte', '$lte', '$in', '$nin', '$exists', '$or', '$and', '$nor', '$not', 'ObjectId'];
        nosqlPatterns.forEach(pattern => {
            sanitized = sanitized.replace(new RegExp(pattern, 'gi'), '');
        });

        return sanitized;
    }

    validateInputTypes(data) {
        // Ensure all values are proper types
        const validated = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'object' && value !== null) {
                console.error('⚠️ Object values not allowed:', key);
                throw new Error('Invalid input type detected');
            }
            validated[key] = typeof value === 'string' ? this.sanitizeInput(value) : value;
        }
        return validated;
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
        this.clearMessages();
    }

    showSignupScreen() {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('signup-screen')?.classList.remove('hidden');
        document.getElementById('forgot-password-screen')?.classList.add('hidden');
        this.clearMessages();
    }

    showForgotPasswordScreen() {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('signup-screen')?.classList.add('hidden');
        document.getElementById('forgot-password-screen')?.classList.remove('hidden');
        this.clearMessages();
    }

    clearMessages() {
        // Clear any existing error or success messages when switching screens
        const errorDiv = document.querySelector('.auth-error');
        const successDiv = document.querySelector('.auth-success');
        if (errorDiv) errorDiv.remove();
        if (successDiv) successDiv.remove();
    }

    showError(message) {
        this.clearMessages();

        let errorDiv = document.createElement('div');
        errorDiv.className = 'auth-error';

        // Find the currently visible auth form more reliably
        let targetForm = null;
        
        // Check each screen specifically
        const loginScreen = document.getElementById('login-screen');
        const signupScreen = document.getElementById('signup-screen');
        const forgotScreen = document.getElementById('forgot-password-screen');
        
        if (signupScreen && !signupScreen.classList.contains('hidden')) {
            targetForm = signupScreen.querySelector('.auth-form');
        } else if (loginScreen && !loginScreen.classList.contains('hidden')) {
            targetForm = loginScreen.querySelector('.auth-form');
        } else if (forgotScreen && !forgotScreen.classList.contains('hidden')) {
            targetForm = forgotScreen.querySelector('.auth-form');
        } else {
            // Fallback - find any visible auth form
            targetForm = document.querySelector('.auth-form');
        }

        if (targetForm) {
            targetForm.insertBefore(errorDiv, targetForm.firstChild);
        } else {
            // Last resort fallback
            const authContainer = document.getElementById('auth-container') || document.body;
            authContainer.prepend(errorDiv);
        }

        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            color: #ff4444;
            padding: 12px;
            margin-bottom: 15px;
            border: 1px solid #ff4444;
            background-color: #ffebeb;
            border-radius: 8px;
            text-align: center;
            font-size: 14px;
            box-shadow: 0 2px 4px rgba(255, 68, 68, 0.1);
            z-index: 1000;
            position: relative;
            width: 100%;
            box-sizing: border-box;
        `;

        // Auto-hide error after 8 seconds
        setTimeout(() => {
            if (errorDiv && errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 8000);
    }

    showSuccess(message) {
        this.clearMessages();

        let successDiv = document.createElement('div');
        successDiv.className = 'auth-success';

        // Find the currently visible auth form more reliably
        let targetForm = null;
        
        // Check each screen specifically
        const loginScreen = document.getElementById('login-screen');
        const signupScreen = document.getElementById('signup-screen');
        const forgotScreen = document.getElementById('forgot-password-screen');
        
        if (signupScreen && !signupScreen.classList.contains('hidden')) {
            targetForm = signupScreen.querySelector('.auth-form');
        } else if (loginScreen && !loginScreen.classList.contains('hidden')) {
            targetForm = loginScreen.querySelector('.auth-form');
        } else if (forgotScreen && !forgotScreen.classList.contains('hidden')) {
            targetForm = forgotScreen.querySelector('.auth-form');
        } else {
            // Fallback - find any visible auth form
            targetForm = document.querySelector('.auth-form');
        }

        if (targetForm) {
            targetForm.insertBefore(successDiv, targetForm.firstChild);
        } else {
            // Last resort fallback
            const authContainer = document.getElementById('auth-container') || document.body;
            authContainer.prepend(successDiv);
        }

        successDiv.textContent = message;
        successDiv.style.cssText = `
            color: #4CAF50;
            padding: 12px;
            margin-bottom: 15px;
            border: 1px solid #4CAF50;
            background-color: #e8f5e9;
            border-radius: 8px;
            text-align: center;
            font-size: 14px;
            box-shadow: 0 2px 4px rgba(76, 175, 80, 0.1);
            width: 100%;
            box-sizing: border-box;
        `;
    }

    showRegistrationSuccess(message) {
        // Create and show registration success modal
        const modal = document.createElement('div');
        modal.id = 'registration-success-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 12px;
                padding: 2rem;
                max-width: 500px;
                width: 100%;
                text-align: center;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            ">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                <h3 style="margin: 0 0 1rem 0; color: #28a745;">Registration Successful!</h3>
                <p style="margin-bottom: 1rem; color: #666; font-size: 16px;">
                    ${message}
                </p>
                <p style="margin-bottom: 1rem; color: #666; font-size: 16px;">
                    <strong>Important:</strong> You must verify your email address before you can log in.
                </p>
                <p style="margin-bottom: 2rem; color: #666; font-size: 14px;">
                    Please check your inbox (and spam folder) for a verification email. Click the verification link, then return here to log in.
                </p>
                <button id="goto-login-btn" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin-right: 12px;
                ">Go to Login</button>
                <button id="close-success-modal-btn" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                ">Stay Here</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('goto-login-btn')?.addEventListener('click', () => {
            this.closeRegistrationSuccessModal();
            this.showLoginScreen();
        });

        document.getElementById('close-success-modal-btn')?.addEventListener('click', () => {
            this.closeRegistrationSuccessModal();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeRegistrationSuccessModal();
            }
        });
    }

    closeRegistrationSuccessModal() {
        const modal = document.getElementById('registration-success-modal');
        if (modal) {
            modal.remove();
        }
    }

    showLoginVerificationModal(email) {
        // Create and show verification modal for login flow
        const modal = document.createElement('div');
        modal.id = 'login-verification-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 12px;
                padding: 2rem;
                max-width: 500px;
                width: 100%;
                text-align: center;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            ">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📧</div>
                <h3 style="margin: 0 0 1rem 0; color: #333;">Email Verification Required</h3>
                <p style="margin-bottom: 1rem; color: #666;">
                    Please verify your email address before logging in.
                </p>
                <p style="margin-bottom: 1rem; color: #666;">
                    We'll send a verification email to <strong>${email}</strong>.
                </p>
                <p style="margin-bottom: 2rem; color: #666; font-size: 14px;">
                    After clicking the verification link in your email, you can return here and try logging in again.
                </p>
                <button id="send-login-verification-btn" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin-right: 12px;
                ">Send Verification Email</button>
                <button id="close-login-verification-btn" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                ">Close</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('send-login-verification-btn')?.addEventListener('click', async () => {
            await this.sendLoginVerificationEmail(email);
        });

        document.getElementById('close-login-verification-btn')?.addEventListener('click', () => {
            this.closeLoginVerificationModal();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeLoginVerificationModal();
            }
        });
    }

    async sendLoginVerificationEmail(email) {
        try {
            const csrfToken = await this.ensureCSRFToken();
            const response = await fetch('https://cook.beaverlyai.com/api/send_verification_email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ email })
            });

            const result = await response.json();
            if (response.ok) {
                // Update modal content to show success
                const modal = document.getElementById('login-verification-modal');
                if (modal) {
                    const content = modal.querySelector('div');
                    content.innerHTML = `
                        <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                        <h3 style="margin: 0 0 1rem 0; color: #333;">Verification Email Sent!</h3>
                        <p style="margin-bottom: 1rem; color: #666;">
                            We've sent a verification email to <strong>${email}</strong>.
                        </p>
                        <p style="margin-bottom: 2rem; color: #666;">
                            Please check your inbox and click the verification link. After verifying, you can close this dialog and try logging in again.
                        </p>
                        <button id="close-success-verification-btn" style="
                            background: #28a745;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 16px;
                        ">Close</button>
                    `;

                    document.getElementById('close-success-verification-btn')?.addEventListener('click', () => {
                        this.closeLoginVerificationModal();
                    });
                }
            } else {
                this.showError(result.error || result.message || 'Failed to send verification email');
            }
        } catch (error) {
            console.error('Verification email error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    closeLoginVerificationModal() {
        const modal = document.getElementById('login-verification-modal');
        if (modal) {
            modal.remove();
        }
    }
}

// Password visibility toggle
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const eyeIcon = field.nextElementSibling;

    if (field.type === 'password') {
        field.type = 'text';
        eyeIcon.innerHTML = '🙈'; // Hidden/closed eye
    } else {
        field.type = 'password';
        eyeIcon.innerHTML = '👁️'; // Open eye
    }
}

// Password strength checker
function checkPasswordStrength(password) {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    let strength = 'weak';
    let color = '#ff4444';

    if (passedChecks >= 5) {
        strength = 'strong';
        color = '#00c851';
    } else if (passedChecks >= 3) {
        strength = 'medium';
        color = '#ffbb33';
    }

    return { checks, strength, color, score: passedChecks };
}

// Update password strength meter
function updatePasswordMeter(password) {
    const result = checkPasswordStrength(password);
    const meter = document.getElementById('passwordMeter');
    const requirements = document.getElementById('passwordRequirements');

    if (!meter || !requirements) return;

    // Update meter bar
    const percentage = (result.score / 5) * 100;
    meter.style.width = percentage + '%';
    meter.style.backgroundColor = result.color;

    // Update requirements list
    const reqItems = requirements.querySelectorAll('li');
    reqItems[0].className = result.checks.length ? 'req-met' : 'req-unmet';
    reqItems[1].className = result.checks.uppercase ? 'req-met' : 'req-unmet';
    reqItems[2].className = result.checks.lowercase ? 'req-met' : 'req-unmet';
    reqItems[3].className = result.checks.number ? 'req-met' : 'req-unmet';
    reqItems[4].className = result.checks.special ? 'req-met' : 'req-unmet';

    // Show/hide requirements
    requirements.style.display = password ? 'block' : 'none';
}


// Password match validation
function checkPasswordMatch() {
    const password = document.getElementById('signup-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const indicator = document.getElementById('password-match-indicator');
    const text = document.getElementById('password-match-text');

    if (!indicator || !text) return;

    if (!confirmPassword) {
        indicator.style.display = 'none';
        return;
    }

    indicator.style.display = 'block';
    
    if (password === confirmPassword) {
        indicator.className = 'password-match-indicator match';
        text.textContent = 'Passwords match ✓';
    } else {
        indicator.className = 'password-match-indicator no-match';
        text.textContent = 'Passwords don\'t match';
    }
}

// Initialize authentication when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new ChillaAuth();

    // Add password strength meter event listener
    const passwordInput = document.getElementById('signup-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            updatePasswordMeter(this.value);
            checkPasswordMatch();
        });
    }

    // Add confirm password event listener
    const confirmPasswordInput = document.getElementById('confirm-password');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            checkPasswordMatch();
        });
    }

    // Add password toggle event listener
    const passwordToggle = document.getElementById('signup-password-toggle');
    if (passwordToggle) {
        passwordToggle.addEventListener('click', function() {
            togglePassword('signup-password');
        });
    }
});
