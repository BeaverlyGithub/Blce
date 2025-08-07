const API_BASE = 'https://cook.beaverlyai.com';

class ChillaDashboard {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentTheme = 'light';
        this.isConnected = false;
        this.verificationPollingInterval = null;

        this.init();
    }

    async init() {
        this.setupTheme();
        this.setupEventListeners();
        this.setupPageVisibilityHandler();

        // Check for Deriv OAuth callback
        this.handleDerivCallback();

        // Small delay to ensure DOM is ready
        setTimeout(async () => {
            await this.checkAuthentication();
        }, 100);
    }

    setupPageVisibilityHandler() {
        // Listen for page visibility changes to refresh verification status
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden && this.isAuthenticated && this.currentUser && !this.currentUser.email_verified) {
                // User returned to the page and email is not verified, check status
                await this.refreshUserData();
            }
        });
    }

    handleDerivCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const isPending = localStorage.getItem('deriv_oauth_pending') === 'true';

        if (code && isPending) {
            // Deriv OAuth success
            localStorage.setItem('deriv_connected', 'true');
            localStorage.setItem('deriv_auth_code', code);
            localStorage.removeItem('deriv_oauth_pending');

            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);

            this.showNotification('Successfully connected to Deriv!', 'success');
            this.updateConnectionStatus(true);
        }
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
                const data = await response.json();
                if (data.status === 'valid') {
                    this.isAuthenticated = true;
                    // Fix user data structure to match backend response
                    this.currentUser = data.users || data.user || {
                        email: data.email || localStorage.getItem('chilla_user_email') || 'user@example.com',
                        email_verified: data.email_verified || false,
                        full_name: data.full_name || 'User',
                        plan: data.plan || "Chilla's Gift",
                        auth_provider: data.auth_provider || null
                    };

                    // Store user email for other components
                    if (this.currentUser.email) {
                        localStorage.setItem('chilla_user_email', this.currentUser.email);
                    }

                    this.showMainApp();
                    this.loadDashboardData();

                    // Set up periodic data refresh
                    this.setupPeriodicRefresh();
                    return;
                }
            }
        } catch (error) {
            console.warn('Auth check failed:', error);
        }

        // Redirect to login if not authenticated
        window.location.href = 'index.html';
    }

    setupEventListeners() {
        // Main app listeners
        document.getElementById('menu-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('nav-connect-btn').addEventListener('click', () => this.handleConnectChilla());
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Sidebar listeners
        document.getElementById('connect-chilla-btn').addEventListener('click', () => this.handleConnectChilla());
        document.getElementById('change-email-btn').addEventListener('click', () => this.changeEmail());
        document.getElementById('change-password-btn').addEventListener('click', () => this.changePassword());
        document.getElementById('verify-email-btn').addEventListener('click', () => this.verifyEmail());
        document.getElementById('contact-btn').addEventListener('click', () => this.showContact());
        document.getElementById('faq-btn').addEventListener('click', () => this.showFAQ());
        document.getElementById('privacy-btn').addEventListener('click', () => this.showPrivacy());
        document.getElementById('terms-btn').addEventListener('click', () => this.showTerms());

        // Bottom nav listeners
        document.getElementById('home-nav').addEventListener('click', () => this.showHome());
        document.getElementById('menu-nav').addEventListener('click', () => this.showPaca());

        // Modal listeners
        document.getElementById('broker-dropdown').addEventListener('change', () => this.handleBrokerSelection());
        document.getElementById('broker-oauth-btn').addEventListener('click', () => this.handleBrokerOAuth());
        document.getElementById('modal-close-btn').addEventListener('click', () => this.closeBrokerModal());
        document.getElementById('confirm-disconnect-btn').addEventListener('click', () => this.confirmDisconnect());
        document.getElementById('cancel-disconnect-btn').addEventListener('click', () => this.closeDisconnectModal());

        // Sidebar overlay listener
        document.querySelector('.sidebar-overlay').addEventListener('click', () => this.closeSidebar());
    }

    setupTheme() {
        this.currentTheme = localStorage.getItem('chilla-theme') || 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }

    showMainApp() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');

        if (this.currentUser) {
            document.getElementById('user-display-name').textContent = this.currentUser.full_name || 'User';
            document.getElementById('user-display-email').textContent = this.currentUser.email;

            const verificationStatus = document.getElementById('verification-status');
            const isGmailUser = this.currentUser.auth_provider === 'gmail';

            // Gmail users are automatically verified
            if (this.currentUser.email_verified || isGmailUser) {
                verificationStatus.innerHTML = '<span class="status-dot verified"></span><span>Verified</span>';
            } else {
                verificationStatus.innerHTML = '<span class="status-dot unverified"></span><span>Unverified</span>';
            }

            // Store user email for other components
            localStorage.setItem('chilla_user_email', this.currentUser.email);
        }
    }

    async loadDashboardData() {
        try {
            await Promise.all([
                this.loadBalance(),
                this.loadPositions(),
                this.checkConnectionStatus()
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.loadFallbackData();
        }
    }

    async loadBalance() {
        // Check actual connection status first
        await this.checkConnectionStatus();

        // Only fetch balance if user is connected to a broker
        if (!this.isConnected) {
            document.getElementById('account-balance').textContent = '$0.00';
            document.getElementById('total-earnings').textContent = '$0.00';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/stats`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('account-balance').textContent = this.formatCurrency(data.balance || 0);
                document.getElementById('total-earnings').textContent = this.formatCurrency(data.equity || 0);
            } else if (response.status === 404) {
                // Fallback for 404 - don't retry
                document.getElementById('account-balance').textContent = '$0.00';
                document.getElementById('total-earnings').textContent = '$0.00';
                return;
            } else {
                throw new Error('Failed to load balance');
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            // Show fallback data and don't retry
            document.getElementById('account-balance').textContent = '$0.00';
            document.getElementById('total-earnings').textContent = '$0.00';
        }
    }

    async loadPositions() {
        // Check actual connection status first
        await this.checkConnectionStatus();

        // Only fetch positions if user is connected to a broker
        if (!this.isConnected) {
            this.displayPositions([]);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/stats`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.displayPositions(data.open_trades || []);
            } else if (response.status === 404) {
                // Fallback for 404 - don't retry
                this.displayPositions([]);
                return;
            } else {
                throw new Error('Failed to load positions');
            }
        } catch (error) {
            console.error('Error loading positions:', error);
            this.displayPositions([]);
        }
    }

    loadFallbackData() {
        document.getElementById('account-balance').textContent = '$0.00';
        document.getElementById('total-earnings').textContent = '$0.00';
        this.displayPositions([]);
    }

    displayPositions(positions) {
        const positionsList = document.getElementById('positions-list');

        if (!positions || positions.length === 0) {
            positionsList.innerHTML = '<div class="position-item"><span>No active positions</span></div>';
            return;
        }

        positionsList.innerHTML = positions.map(position => `
            <div class="position-item">
                <div class="position-info">
                    <span class="position-symbol">${position.symbol || 'Unknown'}</span>
                    <span class="position-type">${position.type || 'N/A'}</span>
                </div>
                <div class="position-performance">
                    <span class="position-pnl ${(position.profit || 0) >= 0 ? 'positive' : 'negative'}">
                        ${this.formatCurrency(position.profit || 0)}
                    </span>
                </div>
            </div>
        `).join('');
    }

    async checkConnectionStatus() {
        // Check local storage for Deriv connection status
        const derivConnected = localStorage.getItem('deriv_connected') === 'true';
        this.updateConnectionStatus(derivConnected);
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        const connectBtn = document.getElementById('connect-chilla-btn');
        const navConnectBtn = document.getElementById('nav-connect-btn');

        if (connected) {
            connectBtn.innerHTML = `
                <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
                </svg>
                <span class="status-dot connected"></span>
                Disconnect Chilla
            `;
            connectBtn.classList.add('disconnect-unique');
            connectBtn.classList.remove('connect-unique');

            // Update nav button
            navConnectBtn.classList.add('connected');
            navConnectBtn.classList.remove('disconnected');

            // Start periodic refresh when connected
            this.setupPeriodicRefresh();
        } else {
            connectBtn.innerHTML = `
                <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
                </svg>
                <span class="status-dot disconnected"></span>
                Connect Chilla
            `;
            connectBtn.classList.add('connect-unique');
            connectBtn.classList.remove('disconnect-unique');

            // Update nav button
            navConnectBtn.classList.add('disconnected');
            navConnectBtn.classList.remove('connected')
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('chilla-theme', this.currentTheme);
    }

    async handleLogout() {
        // Clear local storage first
        localStorage.clear();

        // Clear any polling intervals
        if (this.verificationPollingInterval) {
            clearInterval(this.verificationPollingInterval);
            this.verificationPollingInterval = null;
        }

        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        try {
            await fetch(`${API_BASE}/api/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Logout failed silently:', error);
        }

        window.location.href = 'index.html';
    }

    handleConnectChilla() {
        if (this.isConnected) {
            this.showDisconnectModal();
        } else {
            this.showBrokerModal();
        }
        this.closeSidebar();
    }

    showBrokerModal() {
        document.getElementById('broker-modal').classList.remove('hidden');
    }

    closeBrokerModal() {
        document.getElementById('broker-modal').classList.add('hidden');
        document.getElementById('broker-dropdown').value = '';
        document.getElementById('broker-oauth-btn').disabled = true;
    }

    showDisconnectModal() {
        document.getElementById('disconnect-modal').classList.remove('hidden');
    }

    closeDisconnectModal() {
        document.getElementById('disconnect-modal').classList.add('hidden');
    }

    handleBrokerSelection() {
        const dropdown = document.getElementById('broker-dropdown');
        const oauthBtn = document.getElementById('broker-oauth-btn');

        if (dropdown.value) {
            oauthBtn.disabled = false;
        } else {
            oauthBtn.disabled = true;
        }
    }

    async handleBrokerOAuth() {
        const selectedBroker = document.getElementById('broker-dropdown').value;

        if (!selectedBroker) {
            this.showNotification('Please select a broker', 'error');
            return;
        }

        if (selectedBroker === 'deriv') {

            // Get signed state from backend
            const res = await fetch("/api/generate_oauth_state", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include"  // if needed
            });

            const { state_token } = await res.json();

            // Deriv OAuth integration
            const appId = '85950';
            const redirectUri = encodeURIComponent('https://www.cook.beaverlyai.com/api/connect_oauth/callback');
            
            const derivOAuthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&redirect_uri=${redirectUri}&state=${state_token}`;


            // Store that we're attempting Deriv connection
            localStorage.setItem('deriv_oauth_pending', 'true');

            window.location.href = derivOAuthUrl;
        } else {
            this.showNotification('Other brokers coming soon!', 'info');
        }

        this.closeBrokerModal();
    }

    async confirmDisconnect() {
        // Clear Deriv connection
        localStorage.removeItem('deriv_connected');
        localStorage.removeItem('deriv_auth_code');

        this.updateConnectionStatus(false);
        this.closeDisconnectModal();
        this.showNotification('Chilla disconnected successfully', 'success');
    }

    changeEmail() {
        window.location.href = 'change-email.html';
        this.closeSidebar();
    }

    changePassword() {
        window.location.href = 'change-password.html';
        this.closeSidebar();
    }

    async verifyEmail() {
        const email = this.currentUser?.email || localStorage.getItem('chilla_user_email');
        if (!email) {
            this.showNotification('No email found. Please log in again.', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/send_verification_email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email })
            });

            const result = await response.json();
            if (response.ok) {
                this.showNotification('Verification email sent! Please check your inbox and click the verification link.', 'success');

                // Start periodic checking for verification status
                this.startVerificationPolling();
            } else {
                this.showNotification(result.error || 'Failed to send verification email', 'error');
            }
        } catch (error) {
            console.error('Verification error:', error);
            this.showNotification('Network error', 'error');
        }
        this.closeSidebar();
    }

    startVerificationPolling() {
        // Clear any existing polling interval
        if (this.verificationPollingInterval) {
            clearInterval(this.verificationPollingInterval);
        }

        // Check every 5 seconds for up to 5 minutes
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes (60 * 5 seconds)

        this.verificationPollingInterval = setInterval(async () => {
            attempts++;

            // Stop polling after max attempts
            if (attempts >= maxAttempts) {
                clearInterval(this.verificationPollingInterval);
                this.verificationPollingInterval = null;
                return;
            }

            // Check if user is already verified
            if (this.currentUser?.email_verified) {
                clearInterval(this.verificationPollingInterval);
                this.verificationPollingInterval = null;
                return;
            }

            // Refresh user data to check verification status
            await this.refreshUserData();

            // Show success message if verification is complete
            if (this.currentUser?.email_verified) {
                this.showNotification('Email verified successfully!', 'success');
                clearInterval(this.verificationPollingInterval);
                this.verificationPollingInterval = null;
            }
        }, 5000);
    }

    async refreshUserData() {
        try {
            const response = await fetch(`${API_BASE}/api/verify_token`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: null })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'valid') {
                    this.currentUser = data.users || data.user || {
                        email: data.email,
                        email_verified: data.email_verified,
                        full_name: data.full_name,
                        auth_provider: data.auth_provider
                    };

                    // Update verification status display
                    const verificationStatus = document.getElementById('verification-status');
                    const isGmailUser = this.currentUser.auth_provider === 'gmail';

                    if (this.currentUser.email_verified || isGmailUser) {
                        verificationStatus.innerHTML = '<span class="status-dot verified"></span><span>Verified</span>';
                    } else {
                        verificationStatus.innerHTML = '<span class="status-dot unverified"></span><span>Unverified</span>';
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing user data:', error);
        }
    }

    showContact() {
        window.location.href = 'contact.html';
        this.closeSidebar();
    }

    showFAQ() {
        window.location.href = 'faq.html';
        this.closeSidebar();
    }

    showPrivacy() {
        window.location.href = 'privacy.html';
        this.closeSidebar();
    }

    showTerms() {
        window.location.href = 'terms.html';
        this.closeSidebar();
    }

    showHome() {
        // Switch to home tab
        document.getElementById('home-nav').classList.add('active');
        document.getElementById('menu-nav').classList.remove('active');

        // Show the main app bar
        document.querySelector('.app-bar').style.display = 'flex';

        // Reset app title and dashboard
        document.querySelector('.app-title').textContent = 'Chilla';

        // Restore original sidebar content
        this.restoreOriginalSidebar();

        this.loadDashboardData();
        this.showMainDashboard();
    }

    showMainDashboard() {
        const dashboard = document.getElementById('dashboard');

        dashboard.innerHTML = `
            <div class="balance-card">
                <h2>Account Balance</h2>
                <div class="balance-amount" id="account-balance">$0.00</div>
            </div>

            <div class="positions-card">
                <h2>Open Positions</h2>
                <div class="positions-list" id="positions-list">
                    <div class="position-item">
                        <span>Loading...</span>
                    </div>
                </div>
            </div>
        `;

        // Reload dashboard data
        this.loadDashboardData();
    }

    showPaca() {
        // Switch to paca tab
        document.getElementById('home-nav').classList.remove('active');
        document.getElementById('menu-nav').classList.add('active');

        // Show paca dashboard
        this.displayPacaDashboard();
    }

    displayPacaDashboard() {
        const dashboard = document.getElementById('dashboard');
        const appTitle = document.querySelector('.app-title');

        // Update app title
        appTitle.textContent = 'Paca';

        // Hide the main app bar
        document.querySelector('.app-bar').style.display = 'none';

        // Always show consent screen when clicking on the tab
        dashboard.innerHTML = `
            <div class="paca-app-bar">
                <button id="paca-back-btn" class="icon-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                <h1 class="paca-app-title">Paca</h1>
                <button id="paca-menu-btn" class="icon-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h18M3 6h18"/>
                    </svg>
                </button>
            </div>
            <div class="paca-consent-screen">
                <div class="paca-header">
                    <h1 class="paca-title">Paca by Beaverly®</h1>
                    <p class="paca-tagline">Automate. Don't Code.</p>
                    <p class="paca-description">
                        Paca turns your strategy into a live machine — free, fast, and scalable.
                        Send your logic to M-II. We'll build it out.
                        Deploy your strategy on your own funds.
                        Or Publish it. Let others subscribe. Get paid.
                    </p>
                </div>

                <div class="consent-section">
                    <div class="consent-checkbox">
                        <input type="checkbox" id="consent-checkbox">
                        <label for="consent-checkbox">
                            I consent to the <a href="#" id="terms-link">Terms & IP Agreement</a>
                        </label>
                    </div>
                    <button id="start-automating-btn" class="primary-btn" disabled>Get Automated</button>
                </div>
            </div>
        `;

        // Add event listeners
        const consentCheckbox = document.getElementById('consent-checkbox');
        const startBtn = document.getElementById('start-automating-btn');
        const termsLink = document.getElementById('terms-link');
        // Removed back button listener
        const menuBtn = document.getElementById('paca-menu-btn');

        consentCheckbox.addEventListener('change', () => {
            startBtn.disabled = !consentCheckbox.checked;
        });

        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'lose-terms.html';
        });

        startBtn.addEventListener('click', () => {
            if (consentCheckbox.checked) {
                this.showPacaForm();
            }
        });

        // Removed back button listener
        menuBtn.addEventListener('click', () => {
            this.showPacaSidebar();
        });
    }

    showPacaForm() {
        const dashboard = document.getElementById('dashboard');

        dashboard.innerHTML = `
            <div class="paca-app-bar">
                <button id="paca-back-btn" class="icon-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                <h1 class="paca-app-title">Paca</h1>
                <button id="paca-menu-btn" class="icon-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h18M3 6h18"/>
                    </svg>
                </button>
            </div>
            <div class="paca-form-screen">
                <div class="paca-header">
                    <h2>Get Your Strategy Automated</h2>
                    <p>Upload detailed logic to make automation easier. All markets are accepted.</p>
                </div>

                <form id="strategy-form" class="strategy-form">
                    <div class="form-group">
                        <label for="strategy-name">Strategy Name</label>
                        <input type="text" id="strategy-name" name="strategyName" required placeholder="Enter your strategy name">
                    </div>

                    <div class="form-group">
                        <label for="strategy-description">Detailed Description</label>
                        <textarea id="strategy-description" name="description" rows="5" required placeholder="Provide detailed logic to make automation easier..."></textarea>
                    </div>

                    <div class="form-group">
                        <label for="trading-journal-link">Trading Journal/Plan Link (Google Drive, Dropbox, etc.)</label>
                        <input type="url" id="trading-journal-link" name="tradingJournalLink" placeholder="https://drive.google.com/file/d/... or https://dropbox.com/...">
                        <div class="link-hint">Share a link to your trading journal or strategy plan</div>
                    </div>

                    <div class="form-group">
                        <label for="trade-history-link">Trade History/Performance Link</label>
                        <input type="url" id="trade-history-link" name="tradeHistoryLink" placeholder="https://drive.google.com/file/d/... or https://dropbox.com/...">
                        <div class="link-hint">Share a link to your real-world performance data</div>
                    </div>

                    <div class="form-group">
                        <label for="additional-resources-link">Additional Resources Link (Optional)</label>
                        <input type="url" id="additional-resources-link" name="additionalResourcesLink" placeholder="https://drive.google.com/file/d/... or https://dropbox.com/...">
                        <div class="link-hint">Any additional strategy files or documentation</div>
                    </div>

                    <div class="form-group">
                        <label for="team-note">Any additional info to improve your AI development</label>
                        <textarea id="team-note" name="teamNote" rows="3" placeholder="Optional: Any additional information to enhance your automation..."></textarea>
                    </div>

                    <button type="submit" class="primary-btn">Get Automated</button>
                </form>
            </div>
        `;

        // Add event listeners
        document.getElementById('strategy-form').addEventListener('submit', (e) => {
            this.handleStrategySubmission(e);
        });

        document.getElementById('paca-back-btn').addEventListener('click', () => {
            this.displayPacaDashboard();
        });

        document.getElementById('paca-menu-btn').addEventListener('click', () => {
            this.showPacaSidebar();
        });
    }

    restoreOriginalSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarContent = sidebar.querySelector('.sidebar-content');

        // Restore original sidebar content
        sidebarContent.innerHTML = `
            <div class="sidebar-header">
                <div class="user-info">
                    <div class="user-name" id="user-display-name">${this.currentUser?.full_name || 'User'}</div>
                    <div class="user-email" id="user-display-email">${this.currentUser?.email || 'user@example.com'}</div>
                    <div class="verification-status" id="verification-status">
                        <span class="status-dot ${this.currentUser?.email_verified ? 'verified' : 'unverified'}"></span>
                        <span>${this.currentUser?.email_verified ? 'Verified' : 'Unverified'}</span>
                    </div>
                </div>
            </div>
            <div class="sidebar-menu">
                <button class="menu-item connect-unique" id="connect-chilla-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
                    </svg>
                    <span class="status-dot disconnected"></span>
                    Connect Chilla
                </button>
                <button class="menu-item" id="change-email-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline stroke-linecap="round" stroke-linejoin="round" points="22,6 12,13 2,6"/>
                    </svg>
                    Change Email
                </button>
                <button class="menu-item" id="change-password-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <circle cx="12" cy="16" r="1"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Change Password
                </button>
                <button class="menu-item" id="verify-email-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline stroke-linecap="round" stroke-linejoin="round" points="20,6 9,17 4,12"/>
                    </svg>
                    Verify Email
                </button>
                <button class="menu-item" id="contact-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    Contact
                </button>
                <button id="faq-btn" class="menu-item">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
                        <path d="M12 17h.01"/>
                    </svg>
                    FAQ
                </button>
                <button id="privacy-btn" class="menu-item">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    Privacy Policy
                </button>
                <button id="terms-btn" class="menu-item">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Terms of Service
                </button>
                <button class="menu-item logout" id="logout-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline stroke-linecap="round" stroke-linejoin="round" points="16,17 21,12 16,7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Logout
                </button>
            </div>

            <!-- Floating Theme Toggle -->
            <div class="floating-theme-toggle">
                <button id="theme-toggle" class="theme-toggle-btn">
                    <svg class="theme-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="5"/>
                        <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                    <svg class="theme-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                </button>
            </div>
        `;

        // Re-setup event listeners for original sidebar
        this.setupOriginalSidebarListeners();

        // Update connection status
        this.updateConnectionStatus(this.isConnected);
    }

    setupOriginalSidebarListeners() {
        // Re-setup all the original sidebar event listeners
        document.getElementById('connect-chilla-btn').addEventListener('click', () => this.handleConnectChilla());
        document.getElementById('change-email-btn').addEventListener('click', () => this.changeEmail());
        document.getElementById('change-password-btn').addEventListener('click', () => this.changePassword());
        document.getElementById('verify-email-btn').addEventListener('click', () => this.verifyEmail());
        document.getElementById('contact-btn').addEventListener('click', () => this.showContact());
        document.getElementById('faq-btn').addEventListener('click', () => this.showFAQ());
        document.getElementById('privacy-btn').addEventListener('click', () => this.showPrivacy());
        document.getElementById('terms-btn').addEventListener('click', () => this.showTerms());
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
    }

    showPacaSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarContent = sidebar.querySelector('.sidebar-content');

        // Update sidebar for Paca
        sidebarContent.innerHTML = `
            <div class="sidebar-header">
                <div class="user-info">
                    <div class="user-name" id="user-display-name">${this.currentUser?.full_name || 'User'}</div>
                    <div class="user-email" id="user-display-email">${this.currentUser?.email || 'user@example.com'}</div>
                </div>
            </div>
            <div class="sidebar-menu">
                <button class="menu-item" id="my-store-btn" disabled>
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005 16v1a1 1 0 001 1h1M16 16v1a1 1 0 011 1h1m0-2a1 1 0 01-1-1v-1h-1m0 0V9a1 1 0 011-1h1a1 1 0 011 1v1M9 19v1a1 1 0 001 1h1"/>
                    </svg>
                    My Store (Coming Soon)
                </button>
                <button class="menu-item" id="paca-terms-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Terms & IP
                </button>
                <button class="menu-item" id="paca-privacy-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    Privacy Policy
                </button>
                <button class="menu-item" id="automate-strategy-btn">
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Automate Strategy
                </button>
            </div>
        `;

        // Add event listeners for paca sidebar
        document.getElementById('paca-terms-btn').addEventListener('click', () => {
            window.location.href = 'lose-terms.html';
        });

        document.getElementById('paca-privacy-btn').addEventListener('click', () => {
            window.location.href = 'lose-privacy.html';
        });

        document.getElementById('automate-strategy-btn').addEventListener('click', () => {
            this.showPacaForm();
            this.closeSidebar();
        });

        sidebar.classList.add('open');
    }



    async handleStrategySubmission(e) {
        e.preventDefault();

        const formData = new FormData(e.target);

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        // Retry function with timeout
        const sendWithRetry = async (params, maxRetries = 3) => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Set a shorter timeout for each attempt
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Request timeout')), 15000); // 15 second timeout
                    });

                    // Check if emailjs is loaded
                    if (typeof emailjs === 'undefined') {
                        throw new Error('EmailJS not loaded');
                    }
                    const emailPromise = emailjs.send('service_y3t9c3s', 'template_hjzyaiq', params);

                    await Promise.race([emailPromise, timeoutPromise]);
                    return; // Success
                } catch (error) {
                    console.warn(`Attempt ${attempt} failed:`, error);
                    if (attempt === maxRetries) {
                        throw error;
                    }
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        };

        try {
            // Initialize EmailJS with proper configuration
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS library not found. Please ensure it is included.');
            }

            // Initialize EmailJS if not already initialized
            if (!emailjs._config || !emailjs._config.publicKey) {
                emailjs.init('0w-mDmXc8j3hyp1hw');
            }

            // Collect shared links
            const tradingJournalLink = formData.get('tradingJournalLink') || '';
            const tradeHistoryLink = formData.get('tradeHistoryLink') || '';
            const additionalResourcesLink = formData.get('additionalResourcesLink') || '';

            let linksList = '';
            if (tradingJournalLink || tradeHistoryLink || additionalResourcesLink) {
                linksList = '\n\nSHARED LINKS:\n';
                if (tradingJournalLink) {
                    linksList += `• Trading Journal/Plan: ${tradingJournalLink}\n`;
                }
                if (tradeHistoryLink) {
                    linksList += `• Trade History/Performance: ${tradeHistoryLink}\n`;
                }
                if (additionalResourcesLink) {
                    linksList += `• Additional Resources: ${additionalResourcesLink}\n`;
                }
            }

            // Prepare email data with size limits
            const description = formData.get('description') + linksList;
            const maxDescriptionLength = 2000; // Limit description to avoid size issues

            const templateParams = {
                from_email: this.currentUser?.email || localStorage.getItem('chilla_user_email'),
                to_email: 'creator@beaverlyai.com',
                user_name: this.currentUser?.full_name || 'User',
                strategy_name: formData.get('strategyName'),
                description: description.length > maxDescriptionLength ?
                    description.substring(0, maxDescriptionLength) + '...\n[TRUNCATED - Full details in follow-up]' :
                    description,
                team_note: formData.get('teamNote') || 'No additional notes',
                submission_date: new Date().toLocaleDateString(),
                trading_journal_link: tradingJournalLink,
                trade_history_link: tradeHistoryLink,
                additional_resources_link: additionalResourcesLink
            };

            // Send email notification with retry logic
            await sendWithRetry(templateParams);

            this.showStrategySuccess();

        } catch (error) {
            console.error('Error submitting strategy:', error);

            // Show specific error messages
            let errorMessage = 'Failed to submit strategy. ';
            if (error.message.includes('timeout') || error.message.includes('fetch')) {
                errorMessage += 'Network timeout - please check your connection and try again.';
            } else if (error.message.includes('EmailJS not loaded') || error.message.includes('EmailJS library not found')) {
                 errorMessage = 'EmailJS library not loaded. Please ensure it is included in your project.';
            } else {
                errorMessage += 'Please try again or contact support if the issue persists.';
            }

            this.showNotification(errorMessage, 'error');

            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    showStrategySuccess() {
        const dashboard = document.getElementById('dashboard');

        dashboard.innerHTML = `
            <div class="success-screen">
                <div class="success-content">
                    <div class="success-icon">✅</div>
                    <h2>Strategy Submitted Successfully!</h2>
                    <p class="success-message">
                        Congratulations! Your strategy has been submitted successfully.
                        If your logic is approved and deployed, we will contact you and unlock your store
                        to monetize it or use it for free on your Chilla Dashboard.
                        Due to surge in demand, deployment might take 4 weeks but rest assured that if you
                        pass our sandbox, you're on to something great. If you do not, we will educate you
                        on areas for improvements on your logic.
                    </p>
                    <button id="back-to-form-btn" class="primary-btn">Submit Another Strategy</button>
                </div>
            </div>
        `;

        document.getElementById('back-to-form-btn').addEventListener('click', () => {
            this.showPacaForm();
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
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

    setupPeriodicRefresh() {
        // Clear existing interval if any
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Only set up refresh for connected users
        if (this.isConnected) {
            this.refreshInterval = setInterval(() => {
                // Double-check connection status before making API calls
                if (this.isConnected) {
                    this.loadDashboardData();
                }
            }, 30000);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChillaDashboard();
});
