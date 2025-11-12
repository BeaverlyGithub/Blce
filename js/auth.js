// Enhanced Authentication with Pure Server-Side Validation

// small local helper that uses APP_CONFIG when available
function _apiUrl(path) {
    try {
        if (window.APP_CONFIG && typeof window.APP_CONFIG.apiUrl === 'function') return window.APP_CONFIG.apiUrl(path);
    } catch (e) {
        /* ignore */
    }
    // fallback: assume absolute path provided
    return path;
}
// Small on-page status panel for troubleshooting login issues (mobile-friendly)
;(function createAuthStatusPanel(){
    if (window.__authStatusPanelCreated) return;
    window.__authStatusPanelCreated = true;

    function onReady() {
        try {
            const container = document.getElementById('auth-container') || document.body;
            const panel = document.createElement('div');
            panel.id = 'auth-status-panel';
            panel.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99999;background:rgba(0,0,0,0.7);color:#fff;padding:8px 10px;border-radius:8px;font-size:13px;max-width:calc(100vw - 24px);box-shadow:0 6px 18px rgba(0,0,0,0.4);';
            panel.innerHTML = '<strong style="display:block;margin-bottom:6px;">Status</strong><div id="auth-status-content" style="max-height:120px;overflow:auto;font-size:12px;line-height:1.2;">Initializing…</div>';
            document.body.appendChild(panel);
            window.__authStatusWrite = function(msg, level){
                try{
                    const c = document.getElementById('auth-status-content');
                    const time = new Date().toLocaleTimeString();
                    const node = document.createElement('div');
                    node.style.padding = '4px 0';
                    node.textContent = `[${time}] ${msg}`;
                    if (level === 'error') node.style.color = '#ffdddd';
                    if (level === 'warn') node.style.color = '#ffe6c2';
                    c.insertBefore(node, c.firstChild);
                    while (c.children.length > 20) c.removeChild(c.lastChild);
                }catch(e){}
            };
        }catch(e){console.error('auth status panel init failed', e)}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
})();
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
        // Load security verification after session validation
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
            const response = await fetch(_apiUrl('/api/csrf_token'), {
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
                console.log('✅ Security verification ready');
                if (window.__authStatusWrite) window.__authStatusWrite('CSRF token loaded');
                return this.csrfToken;
            } else {
                console.error('❌ Security verification unavailable:', response.status);
                if (window.__authStatusWrite) window.__authStatusWrite('CSRF token unavailable: '+response.status, 'warn');
                this.csrfToken = null;
                this.sessionId = null;
            }
        } catch (error) {
            console.error('❌ Security verification error:', error);
            if (window.__authStatusWrite) window.__authStatusWrite('CSRF token fetch error: '+(error && error.message?error.message:error), 'error');
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
            const url = new URL(_apiUrl('/api/csrf_token'));
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
                console.log('✅ Security verification ready for email');
                return this.csrfToken;
            } else {
                console.error('❌ Security verification unavailable:', response.status);
                this.csrfToken = null;
                this.sessionId = null;
            }
        } catch (error) {
            console.error('❌ Security verification error:', error);
            this.csrfToken = null;
            this.sessionId = null;
        } finally {
            this.csrfTokenLoading = false;
        }

        return this.csrfToken;
    }

    async validateSession() {
        try {
            if (window.__authStatusWrite) window.__authStatusWrite('Validating session...');
            const response = await fetch(_apiUrl('/api/verify_token'), {
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
                    if (window.__authStatusWrite) window.__authStatusWrite('Session valid; redirecting...');
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
                if (window.__authStatusWrite) window.__authStatusWrite('Session validation failed: 401', 'warn');
                this.showAuthScreen();
                return;
            }

            if (window.__authStatusWrite) window.__authStatusWrite('Session not valid; showing auth screen');
            this.showAuthScreen();
        } catch (error) {
            console.error('Session validation error:', error);
            if (window.__authStatusWrite) window.__authStatusWrite('Session validation error: '+(error && error.message?error.message:error), 'error');
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

        // Ensure we have a valid security verification
        const csrfToken = await this.ensureCSRFToken();
        if (!csrfToken) {
            this.showError('Security check failed — please refresh and try again');
            return;
        }

        try {
            const requestBody = { email, password };
            if (this.sessionId) {
                requestBody.session_id = this.sessionId;
            }

            const response = await fetch(_apiUrl('/api/login'), {
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
                // Security verification invalid - refresh and retry once
                console.log('🔄 Security check expired, refreshing...');
                await this.loadCSRFToken(true);
                this.showError('Session expired — please try logging in again');
            } else if (data.show_verification_modal) {
                // Server tells us to show verification modal
                this.showLoginVerificationModal(email);
            } else {
                // Check for password compliance issues
                if (data.detail && (data.detail.includes('password does not meet') || 
                    data.detail.includes('password compliance') || 
                    data.detail.includes('password standards') ||
                    data.detail.includes('update your password'))) {
                    // Show password compliance modal
                    this.showPasswordComplianceModal(email);
                    return;
                }

                // Show specific error messages from server
                let errorMessage = 'Login failed';
                if (data.detail) {
                    errorMessage = data.detail;
                } else if (data.message) {
                    errorMessage = data.message;
                } else if (response.status === 401) {
                    errorMessage = "Email or password isn't quite right — please try again";
                } else if (response.status === 422) {
                    errorMessage = 'Please check your email and password';
                } else if (response.status >= 500) {
                    errorMessage = 'Something went wrong — please try again in a moment';
                }
                this.showError(errorMessage);
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Could not connect — please check your internet and try again');
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

        // Get security verification with email parameter for consistent validation
        const csrfToken = await this.loadCSRFTokenForEmail(formData.email);
        if (!csrfToken) {
            this.showError('Security check failed — please refresh and try again');
            return;
        }

        try {
            const requestBody = { ...formData };
            if (this.sessionId) {
                requestBody.session_id = this.sessionId;
            }

            const response = await fetch(_apiUrl('/api/register'), {
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
                // Security verification invalid - refresh and retry once automatically
                console.log('🔄 Security check expired, refreshing and retrying...');
                const newCsrfToken = await this.loadCSRFToken(true);
                if (newCsrfToken) {
                    // Retry the registration with new token
                    try {
                        const retryRequestBody = { ...formData };
                        if (this.sessionId) {
                            retryRequestBody.session_id = this.sessionId;
                        }

                        const retryResponse = await fetch(_apiUrl('/api/register'), {
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
                this.showError('Session expired — please try again');
            } else {
                this.showError(data.detail || data.message || 'Could not complete registration — please try again');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('Could not connect — please check your internet and try again');
        }
    }

    async handleGoogleAuth() {
        try {
            const response = await fetch(_apiUrl('/api/oauth_config'), {
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
            this.showError('Could not start Google sign-in — please try again');
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

        // Ensure we have a valid security verification
        const csrfToken = await this.ensureCSRFToken();
        if (!csrfToken) {
            this.showError('Security check failed — please refresh and try again');
            return;
        }

        try {
            const response = await fetch(_apiUrl('/api/forgot_password'), {
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
                // Security verification invalid - refresh and retry once
                console.log('🔄 Security check expired, refreshing...');
                await this.loadCSRFToken(true);
                this.showError('Session expired — please try again');
            } else {
                this.showError(data.detail || data.message || 'Could not reset password — please try again');
            }
        } catch (error) {
            console.error('Password reset error:', error);
            this.showError('Could not connect — please check your internet and try again');
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
                <div style="margin-bottom: 1rem; display:flex; justify-content:center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48">
                        <path d="M4 22v-2"/>
                        <path d="M20 22v-2"/>
                        <path d="M5 19l14-9"/>
                        <path d="M5 12l14 7"/>
                        <path d="M8 22v-3"/>
                        <path d="M16 22v-3"/>
                        <path d="M12 2v5"/>
                    </svg>
                </div>
                <h3 style="margin: 0 0 1rem 0; color: black;">Registration Successful!</h3>
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
                    background: black;
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
                <div style="margin-bottom: 1rem; display:flex; justify-content:center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40">
                        <path d="M22 12V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v5"/>
                        <path d="M22 12l-10 7L2 12"/>
                        <path d="M2 7l10 7L22 7"/>
                    </svg>
                </div>
                <h3 style="margin: 0 0 1rem 0; color: #333;">Email Verification Required</h3>
                <p style="margin-bottom: 1rem; color: #666;">
                    Please verify your email address before logging in.
                </p>
                <p style="margin-bottom: 1rem; color: #666;">
                    We'll send a verification email to <strong>${email}</strong>.
                </p>
                <p style="margin-bottom: 2rem; color: #666; font-size: 14px;">
                    After clicking the verification link in your email, you can close this dialog and try logging in again.
                </p>
                <button id="send-login-verification-btn" style="
                    background: black;
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
            const response = await fetch(_apiUrl('/api/send_verification_email'), {
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
                        <div style="margin-bottom: 1rem; display:flex; justify-content:center;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                        <h3 style="margin: 0 0 1rem 0; color: #333;">Verification Email Sent!</h3>
                        <p style="margin-bottom: 1rem; color: #666;">
                            We've sent a verification email to <strong>${email}</strong>.
                        </p>
                        <p style="margin-bottom: 2rem; color: #666;">
                            Please check your inbox and click the verification link. After verifying, you can close this dialog and try logging in again.
                        </p>
                        <button id="close-success-verification-btn" style="
                            background: black;
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
                this.showError(result.error || result.message || 'Could not send verification email — please try again');
            }
        } catch (error) {
            console.error('Verification email error:', error);
            this.showError('Could not connect — please try again');
        }
    }

    closeLoginVerificationModal() {
        const modal = document.getElementById('login-verification-modal');
        if (modal) {
            modal.remove();
        }
    }

    showPasswordComplianceModal(email) {
        // Create and show password compliance modal
        const modal = document.createElement('div');
        modal.id = 'password-compliance-modal';
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
                <div style="margin-bottom: 1rem; display:flex; justify-content:center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>
                <h3 style="margin: 0 0 1rem 0; color: #333;">Password Update Required</h3>
                <p style="margin-bottom: 1rem; color: #666;">
                    Your current password doesn't meet our updated security standards.
                </p>
                <p style="margin-bottom: 1rem; color: #666;">
                    For your account security, please update your password to continue.
                </p>
                <p style="margin-bottom: 2rem; color: #666; font-size: 14px;">
                    We'll send a secure password reset link to <strong>${email}</strong> so you can create a new, compliant password.
                </p>
                <button id="send-compliance-reset-btn" style="
                    background: black;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin-right: 12px;
                ">Send Password Reset</button>
                <button id="close-compliance-modal-btn" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                ">Cancel</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('send-compliance-reset-btn')?.addEventListener('click', async () => {
            await this.sendCompliancePasswordReset(email);
        });

        document.getElementById('close-compliance-modal-btn')?.addEventListener('click', () => {
            this.closePasswordComplianceModal();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePasswordComplianceModal();
            }
        });
    }

    async sendCompliancePasswordReset(email) {
        try {
            const csrfToken = await this.ensureCSRFToken();
            const response = await fetch(_apiUrl('/api/forgot_password'), {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ 
                    email,
                    reason: 'password_compliance' // Let backend know this is for compliance
                })
            });

            const result = await response.json();
            if (response.ok) {
                // Update modal content to show success
                const modal = document.getElementById('password-compliance-modal');
                if (modal) {
                    const content = modal.querySelector('div');
                    content.innerHTML = `
                        <div style="margin-bottom: 1rem; display:flex; justify-content:center;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                        <h3 style="margin: 0 0 1rem 0; color: #333;">Password Reset Sent!</h3>
                        <p style="margin-bottom: 1rem; color: #666;">
                            We've sent a password reset email to <strong>${email}</strong>.
                        </p>
                        <p style="margin-bottom: 1rem; color: #666;">
                            Please check your inbox and follow the instructions to create a new, secure password.
                        </p>
                        <p style="margin-bottom: 2rem; color: #666; font-size: 14px;">
                            Once you've updated your password, you can return here and log in normally.
                        </p>
                        <button id="close-success-compliance-btn" style="
                            background: black;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 16px;
                        ">Got It</button>
                    `;

                    document.getElementById('close-success-compliance-btn')?.addEventListener('click', () => {
                        this.closePasswordComplianceModal();
                    });
                }
            } else {
                this.showError(result.detail || result.message || 'Could not send reset email — please try again');
            }
        } catch (error) {
            console.error('Password reset error:', error);
            this.showError('Could not connect — please try again');
        }
    }

    closePasswordComplianceModal() {
        const modal = document.getElementById('password-compliance-modal');
        if (modal) {
            modal.remove();
        }
    }
}

// Password visibility toggle
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const eyeIcon = field.nextElementSibling;
    if (!field || !eyeIcon) return;

    if (field.type === 'password') {
        field.type = 'text';
        eyeIcon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
                <path d="M2 2l20 20" />
                <path d="M10.73 5.08A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.86 21.86 0 0 1-1.67 2.68" />
                <path d="M6.16 6.16A21.88 21.88 0 0 0 1 12s4 7 11 7a10.94 10.94 0 0 0 5.39-1.41" />
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            </svg>`;
    } else {
        field.type = 'password';
        eyeIcon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>`;
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