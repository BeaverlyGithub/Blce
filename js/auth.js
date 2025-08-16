document.addEventListener('DOMContentLoaded', function () {
    // Get main containers
    const loadingScreen = document.getElementById('loading-screen');
    const authContainer = document.getElementById('auth-container');
    const loginScreen = document.getElementById('login-screen');
    const signupScreen = document.getElementById('signup-screen');
    const forgotPasswordScreen = document.getElementById('forgot-password-screen');

    // Check if we're on the main auth page
    if (!authContainer) {
        return; // Exit if not on auth page
    }

    // Get form elements
    const loginForm = loginScreen.querySelector('.auth-form');
    const signupForm = signupScreen.querySelector('.auth-form');
    const forgotPasswordForm = forgotPasswordScreen.querySelector('.auth-form');

    // Get buttons and links
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const googleSignupBtn = document.getElementById('google-signup-btn');

    let currentScreen = 'login';

    // Check cookie-based auth by pinging backend
    (async () => {
        try {
            const res = await fetch('https://cook.beaverlyai.com/api/verify_token', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: null })
            });

            if (!res.ok) return;

            const json = await res.json();
            if (json.status === "valid") {
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);
                return;
            }
        } catch (err) {
            console.warn('Silent auth check failed:', err);
        }

        // Show auth container after auth check
        loadingScreen.classList.add('hidden');
        authContainer.classList.remove('hidden');
    })();

    // Screen switching functions
    function showLoginScreen() {
        loginScreen.classList.remove('hidden');
        signupScreen.classList.add('hidden');
        forgotPasswordScreen.classList.add('hidden');
        currentScreen = 'login';
    }

    function showSignupScreen() {
        loginScreen.classList.add('hidden');
        signupScreen.classList.remove('hidden');
        forgotPasswordScreen.classList.add('hidden');
        currentScreen = 'signup';
    }

    function showForgotPasswordScreen() {
        loginScreen.classList.add('hidden');
        signupScreen.classList.add('hidden');
        forgotPasswordScreen.classList.remove('hidden');
        currentScreen = 'forgot';
    }

    // Event listeners for screen switching
    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSignupScreen();
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginScreen();
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showForgotPasswordScreen();
        });
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginScreen();
        });
    }

    // Gmail login functionality
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            const clientId = "514107671303-canjqpiuhlk97eigl1o9cv24i1bjpe54.apps.googleusercontent.com";
            const redirectUri = "https://cook.beaverlyai.com/auth/callback";
            const scope = "https://www.googleapis.com/auth/userinfo.email";
            const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=online&prompt=select_account`;

            window.location.href = oauthUrl;
        });
    }

    if (googleSignupBtn) {
        googleSignupBtn.addEventListener('click', () => {
            const clientId = "514107671303-canjqpiuhlk97eigl1o9cv24i1bjpe54.apps.googleusercontent.com";
            const redirectUri = "https://cook.beaverlyai.com/auth/callback";
            const scope = "https://www.googleapis.com/auth/userinfo.email";
            const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=online&prompt=select_account`;

            window.location.href = oauthUrl;
        });
    }

    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value.trim();
            const loginBtn = document.getElementById('login-btn');

            if (!email || !password) {
                showError('Please fill in all fields');
                return;
            }

            setLoadingState(loginBtn, true, 'Signing In...');

            try {
                const response = await fetch('https://cook.beaverlyai.com/api/login', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Login failed');
                }

                const data = await response.json();

                if (data.status === 'success') {
                    localStorage.setItem('chilla_user_email', email);
                    window.location.href = 'dashboard.html';
                } else {
                    throw new Error(data.message || 'Login failed');
                }

            } catch (error) {
                console.error(error);
                showError(error.message || 'Connection failed.');
            } finally {
                setLoadingState(loginBtn, false, 'Sign In');
            }
        });
    }

    // Signup form submission
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();
            const confirmPassword = document.getElementById('confirm-password').value.trim();
            const firstName = document.getElementById('first-name').value.trim();
            const lastName = document.getElementById('last-name').value.trim();
            const signupBtn = document.getElementById('signup-btn');

            if (!email || !password || !confirmPassword || !firstName || !lastName) {
                showError('Please fill in all required fields');
                return;
            }

            if (password !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }

            setLoadingState(signupBtn, true, 'Creating Account...');

            try {
                const response = await fetch('https://cook.beaverlyai.com/api/register', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email, 
                        password,
                        first_name: firstName,
                        last_name: lastName,
                        middle_name: document.getElementById('middle-name').value.trim(),
                        date_of_birth: document.getElementById('date-of-birth').value
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Registration failed');
                }

                const data = await response.json();

                if (data.status === 'success') {
                    localStorage.setItem('chilla_user_email', email);
                    window.location.href = 'dashboard.html';
                } else {
                    throw new Error(data.message || 'Registration failed');
                }

            } catch (error) {
                console.error(error);
                showError(error.message || 'Connection failed.');
            } finally {
                setLoadingState(signupBtn, false, 'Create Account');
            }
        });
    }

    // Forgot password form submission
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('reset-email').value.trim();
            const resetBtn = document.getElementById('reset-btn');

            if (!email) {
                showError('Please enter your email address');
                return;
            }

            setLoadingState(resetBtn, true, 'Sending...');

            try {
                const response = await fetch('https://cook.beaverlyai.com/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (response.ok) {
                    showSuccess('Password reset link sent to your email');
                    setTimeout(() => showLoginScreen(), 2000);
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to send reset link');
                }

            } catch (error) {
                console.error(error);
                showError(error.message || 'Connection failed.');
            } finally {
                setLoadingState(resetBtn, false, 'Send Reset Link');
            }
        });
    }

    function setLoadingState(button, loading, text) {
        if (button) {
            button.disabled = loading;
            button.textContent = text;
        }
    }

    function showError(message) {
        // Create or update error message
        let errorDiv = document.querySelector('.error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = `
                background: #fee;
                color: #c33;
                padding: 1rem;
                border-radius: 8px;
                margin: 1rem 0;
                border: 1px solid #fcc;
            `;
            // Prepending to the first form found, assuming one main form wrapper
            const formContainer = document.querySelector('.auth-container') || document.body;
            const firstForm = formContainer.querySelector('.auth-form');
            if (firstForm) {
                firstForm.prepend(errorDiv);
            } else {
                formContainer.prepend(errorDiv);
            }
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    function showSuccess(message) {
        // Create or update success message
        let successDiv = document.querySelector('.success-message');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.className = 'success-message';
            successDiv.style.cssText = `
                background: #efe;
                color: #363;
                padding: 1rem;
                border-radius: 8px;
                margin: 1rem 0;
                border: 1px solid #cfc;
            `;
            // Prepending to the first form found, assuming one main form wrapper
            const formContainer = document.querySelector('.auth-container') || document.body;
            const firstForm = formContainer.querySelector('.auth-form');
            if (firstForm) {
                firstForm.prepend(successDiv);
            } else {
                formContainer.prepend(successDiv);
            }
        }
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }
});