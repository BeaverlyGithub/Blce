document.addEventListener('DOMContentLoaded', function () {
    // Hide loading screen and show auth container
    const loadingScreen = document.getElementById('loading-screen');
    const authContainer = document.getElementById('auth-container');
    
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            if (authContainer) {
                authContainer.classList.remove('hidden');
            }
        }, 1000);
    }

    // Check if we're on an auth page - if not, don't initialize auth functionality
    const loginScreen = document.getElementById('login-screen');
    const signupScreen = document.getElementById('signup-screen');
    if (!loginScreen && !signupScreen) {
        return; // Exit if not on auth page
    }

    // Get auth form elements
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const googleSignupBtn = document.getElementById('google-signup-btn');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login');
    
    // Get screen elements
    const loginScreen = document.getElementById('login-screen');
    const signupScreen = document.getElementById('signup-screen');
    const forgotPasswordScreen = document.getElementById('forgot-password-screen');

    let isLoginMode = true;

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
        }
    } catch (err) {
        console.warn('Silent auth check failed:', err);
    }
})();


    // Screen switching functionality
    if (showSignupLink) {
        showSignupLink.addEventListener('click', function(e) {
            e.preventDefault();
            loginScreen.classList.add('hidden');
            signupScreen.classList.remove('hidden');
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            signupScreen.classList.add('hidden');
            loginScreen.classList.remove('hidden');
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            loginScreen.classList.add('hidden');
            if (forgotPasswordScreen) {
                forgotPasswordScreen.classList.remove('hidden');
            }
        });
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (forgotPasswordScreen) {
                forgotPasswordScreen.classList.add('hidden');
            }
            loginScreen.classList.remove('hidden');
        });
    }

    // Google login functionality
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


    // Login form handler
    if (loginBtn) {
        loginBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value.trim();

            if (!email || !password) {
                alert('Please fill in all fields');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing In...';

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
                alert(error.message || 'Connection failed.');
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
        });
    }

    // Signup form handler
    if (signupBtn) {
        signupBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();
            const confirmPassword = document.getElementById('confirm-password').value.trim();

            if (!email || !password || !confirmPassword) {
                alert('Please fill in all fields');
                return;
            }

            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            signupBtn.disabled = true;
            signupBtn.textContent = 'Creating Account...';

            try {
                const response = await fetch('https://cook.beaverlyai.com/api/register', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
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
                alert(error.message || 'Connection failed.');
            } finally {
                signupBtn.disabled = false;
                signupBtn.textContent = 'Create Account';
            }
        });
    }

    // No additional helper functions needed - using inline alerts and DOM manipulation
});
