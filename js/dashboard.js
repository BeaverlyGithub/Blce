
const API_BASE = 'https://cook.beaverlyai.com';

// Secure contact form handler
class ContactFormHandler {
    constructor() {
        this.API_BASE = API_BASE;
        this.initializeContactForm();
    }

    initializeContactForm() {
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', this.handleContactSubmit.bind(this));
        }
    }

    async handleContactSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const contactData = {
            name: this.sanitizeInput(formData.get('name')),
            email: this.sanitizeInput(formData.get('email')),
            subject: this.sanitizeInput(formData.get('subject')),
            message: this.sanitizeInput(formData.get('message'))
        };

        // Validate inputs
        if (!this.validateContactData(contactData)) {
            this.showError('Please fill in all required fields with valid data.');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(contactData)
            });

            if (response.ok) {
                this.showSuccess('Thank you for your message. We will get back to you soon!');
                event.target.reset();
            } else {
                const error = await response.json();
                this.showError(error.message || 'Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Contact form error:', error);
            this.showError('Network error. Please check your connection and try again.');
        }
    }

    sanitizeInput(input) {
        if (!input) return '';
        return input.toString().trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    validateContactData(data) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return data.name && data.email && emailRegex.test(data.email) && data.subject && data.message;
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type) {
        const existingMessage = document.querySelector('.form-message');
        if (existingMessage) existingMessage.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 4px;
            text-align: center;
            ${type === 'error' ? 
                'background: #fee; color: #c33; border: 1px solid #fcc;' : 
                'background: #efe; color: #363; border: 1px solid #cfc;'
            }
        `;

        const form = document.getElementById('contact-form');
        if (form) {
            form.insertBefore(messageDiv, form.firstChild);
            setTimeout(() => messageDiv.remove(), 5000);
        }
    }
}

// Initialize secure contact form handler
document.addEventListener('DOMContentLoaded', () => {
    new ContactFormHandler();
});

class ChillaDashboard {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentTheme = 'light';
        this.isConnected = false;
        this.verificationPollingInterval = null;
        this.activityWsReconnectAttempts = 0;

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

    async setupWebSocket() {
        if (!this.currentUser?.email) return;

        try {
            // Get secure WebSocket token from backend
            const response = await fetch(`${API_BASE}/api/ws_token`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) return;

            const { ws_token } = await response.json();
            const wsHost = API_BASE.replace('https://', '').replace('http://', '');

            // Use token-based authentication instead of email parameter
            const wsUrl = `wss://${wsHost}/ws?token=${ws_token}`;
            this.ws = new WebSocket(wsUrl);
        } catch (error) {
            console.error('WebSocket setup failed:', error);
            return;
        }

        this.ws.onopen = () => {
            console.log('📡 WebSocket connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('📡 WebSocket disconnected');
            // Reconnect after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        // Activity WebSocket for status updates
        this.setupActivityWebSocket();
    }

    async setupActivityWebSocket() {
        if (!this.currentUser?.email) return;

        try {
            // Reuse the same secure token mechanism
            const response = await fetch(`${API_BASE}/api/ws_token`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) return;

            const { ws_token } = await response.json();
            const wsHost = API_BASE.replace('https://', '').replace('http://', '');
            const activityWsUrl = `wss://${wsHost}/activity-ws?token=${ws_token}`;
            this.activityWs = new WebSocket(activityWsUrl);
        } catch (error) {
            console.error('Activity WebSocket setup failed:', error);
            return;
        }

        this.activityWs.onopen = () => {
            console.log('📊 Activity WebSocket connected');
            // Reset reconnection counter on successful connection
            this.activityWsReconnectAttempts = 0;
        };

        this.activityWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleActivityMessage(data);
            } catch (error) {
                console.error('Error parsing activity message:', error);
            }
        };

        this.activityWs.onclose = (event) => {
            console.log('📊 Activity WebSocket disconnected', event.code, event.reason);

            // Only reconnect if it's not a deliberate close
            if (event.code !== 1000 && this.currentUser?.email) {
                // Exponential backoff: start with 5s, max 30s
                const reconnectDelay = Math.min(5000 * Math.pow(2, (this.activityWsReconnectAttempts || 0)), 30000);
                this.activityWsReconnectAttempts = (this.activityWsReconnectAttempts || 0) + 1;

                console.log(`📊 Will reconnect Activity WebSocket in ${reconnectDelay/1000}s (attempt ${this.activityWsReconnectAttempts})`);
                setTimeout(() => this.setupActivityWebSocket(), reconnectDelay);
            }
        };

        this.activityWs.onerror = (error) => {
            console.error('Activity WebSocket error:', error);
        };
    }

    handleWebSocketMessage(data) {
        if (data.type === 'balance_update') {
            document.getElementById('account-balance').textContent = this.formatCurrency(data.balance);
        } else if (data.type === 'position_update') {
            this.displayPositions(data.positions);
        } else if (data.type === 'trade_signal') {
            this.showNotification(`Trade Signal: ${data.action} ${data.symbol}`, 'info');
        }
    }

    handleActivityMessage(data) {
        if (data.type === 'activity_update') {
            console.log('Activity data received:', data.data);
            console.log('Account ID in data:', data.data?.account_id);
            this.updateActivityStatus(data.data);
        }
    }

    updateActivityStatus(activityData) {
        // Update activity status display
        const activityElement = document.getElementById('chilla-activity-status');
        if (!activityElement) return;

        const { status, broker, account_id, watching_markets, last_activity, monitoring_active } = activityData;

        // Try to get account ID from multiple possible locations
        const displayAccountId = account_id || activityData.accountId || activityData.account ||
                                (activityData.broker_data && activityData.broker_data.account_id);

        console.log('Updating activity status - Account ID:', displayAccountId, 'Status:', status, 'Full data:', activityData);

        let statusHtml = '';
        let statusClass = '';

        if (status === 'connected' && monitoring_active) {
            statusClass = 'status-active';
            const timeAgo = last_activity ? this.formatTimeAgo(last_activity) : 'just now';
            statusHtml = `
                <div class="activity-status ${statusClass}">
                    <div class="status-header">
                        <div class="status-title">Chilla is Active</div>
                        <div class="status-indicator"></div>
                    </div>
                    <div class="status-details">
                        ${displayAccountId ? `<div class="account-id-display">Account: <span class="account-id-value">${displayAccountId}</span></div>` : ''}
                        <div class="status-info">
                            <span>Broker: ${broker || 'Unknown'}</span>
                            <span>Last active: ${timeAgo}</span>
                        </div>
                        <div class="watching-markets">
                            Watching: ${watching_markets.map(m => m.name).join(', ') || 'No markets'}
                        </div>
                    </div>
                </div>
            `;
        } else if (status === 'connected') {
            statusClass = 'status-idle';
            statusHtml = `
                <div class="activity-status ${statusClass}">
                    <div class="status-header">
                        <div class="status-title">Connected - Idle</div>
                        <div class="status-indicator"></div>
                    </div>
                    <div class="status-details">
                        ${displayAccountId ? `<div class="account-id-display">Account: <span class="account-id-value">${displayAccountId}</span></div>` : ''}
                        <div class="status-info">
                            <span>Broker: ${broker || 'Unknown'}</span>
                            <span>Status: Idle</span>
                        </div>
                        <div class="watching-markets">
                            Configured: ${watching_markets.map(m => m.name).join(', ') || 'No markets'}
                        </div>
                    </div>
                </div>
            `;
        } else {
            statusClass = 'status-disconnected';
            statusHtml = `
                <div class="activity-status ${statusClass}">
                    <div class="status-header">
                        <div class="status-title">Not Connected</div>
                        <div class="status-indicator"></div>
                    </div>
                    <div class="status-details">
                        <div class="status-info">
                            <span>Connect a broker to start monitoring</span>
                        </div>
                    </div>
                </div>
            `;
        }

        activityElement.innerHTML = statusHtml;
    }

    formatTimeAgo(timestamp) {
        const now = Date.now() / 1000;
        const diff = now - timestamp;

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
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
        // First check if we just came from a successful login
        const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
        if (justLoggedIn) {
            sessionStorage.removeItem('just_logged_in');
            // Add a small delay to ensure cookies are set
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Try authentication check with retries
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(`${API_BASE}/api/verify_token`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: null })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.status === 'valid') {
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

                        // --- Email Verification Check ---
                        const isGmailUser = this.currentUser.auth_provider === 'gmail';
                        if (!this.currentUser.email_verified && !isGmailUser) {
                            // If email is not verified and it's not a gmail user, show verification modal
                            this.showVerificationRequiredModal();
                            return; // Prevent further loading until verified
                        }
                        // --- End Email Verification Check ---

                        this.showMainApp();
                        this.loadDashboardData();
                        this.setupPeriodicRefresh();
                        this.setupWebSocket();
                        return;
                    }
                }

                // Log the response for debugging
                console.log(`Auth attempt ${attempt} failed. Status: ${response.status}`);

                // If this isn't the last attempt, wait before retrying
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            } catch (error) {
                console.warn(`Auth check attempt ${attempt} failed:`, error.message || error);

                // If this isn't the last attempt, wait before retrying
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        // Check if we're coming from OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) {
            // Clean URL and wait for cookies to be set by backend
            window.history.replaceState({}, document.title, window.location.pathname);

            // Wait 3 seconds for backend to set cookies, then retry once
            setTimeout(async () => {
                try {
                    const response = await fetch(`${API_BASE}/api/verify_token`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: null })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.status === 'valid') {
                            // Force page reload to restart with clean state
                            window.location.reload();
                            return;
                        }
                    }
                } catch (err) {
                    console.warn('OAuth callback retry failed:', err.message);
                }

                // If still not authenticated, redirect to login
                window.location.href = 'index.html';
            }, 3000);
            return;
        }

        // Final fallback - redirect to login
        console.warn('All authentication attempts failed, redirecting to login');
        window.location.href = 'index.html';
    }

    setupEventListeners() {
        // Helper function to safely add event listeners
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        };

        const addListenerByQuery = (selector, event, handler) => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener(event, handler);
            }
        };

        // Main app listeners
        addListener('menu-btn', 'click', () => this.toggleSidebar());
        addListener('theme-toggle', 'click', () => this.toggleTheme());
        addListener('nav-connect-btn', 'click', () => this.handleConnectChilla());
        addListener('logout-btn', 'click', () => this.handleLogout());

        // Sidebar listeners
        addListener('connect-chilla-btn', 'click', () => this.handleConnectChilla());
        addListener('change-email-btn', 'click', () => this.changeEmail());
        addListener('change-password-btn', 'click', () => this.changePassword());
        addListener('verify-email-btn', 'click', () => this.verifyEmail());
        addListener('contact-btn', 'click', () => this.showContact());
        addListener('faq-btn', 'click', () => this.showFAQ());
        addListener('privacy-btn', 'click', () => this.showPrivacy());
        addListener('terms-btn', 'click', () => this.showTerms());

        // Bottom nav listeners (optional elements)
        addListener('home-nav', 'click', () => this.showHome());
        addListener('menu-nav', 'click', () => this.openIPPartners());

        // Modal listeners
        addListener('broker-dropdown', 'change', () => this.handleBrokerSelection());
        addListener('broker-oauth-btn', 'click', () => this.handleBrokerOAuth());
        addListener('modal-close-btn', 'click', () => this.closeBrokerModal());
        addListener('confirm-disconnect-btn', 'click', () => this.confirmDisconnect());
        addListener('cancel-disconnect-btn', 'click', () => this.closeDisconnectModal());

        // Sidebar overlay listener
        addListenerByQuery('.sidebar-overlay', 'click', () => this.closeSidebar());

        console.log('All event listeners attached');
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
            const totalEarnings = document.getElementById('total-earnings');
            if (totalEarnings) totalEarnings.textContent = '$0.00';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/stats`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('account-balance').textContent = this.formatCurrency(data.balance || 0);
                const totalEarnings = document.getElementById('total-earnings');
                if (totalEarnings) totalEarnings.textContent = this.formatCurrency(data.equity || 0);
            } else if (response.status === 404) {
                // Fallback for 404 - don't retry
                document.getElementById('account-balance').textContent = '$0.00';
                const totalEarnings = document.getElementById('total-earnings');
                if (totalEarnings) totalEarnings.textContent = '$0.00';
                return;
            } else {
                throw new Error('Failed to load balance');
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            // Show fallback data and don't retry
            document.getElementById('account-balance').textContent = '$0.00';
            const totalEarnings = document.getElementById('total-earnings');
            if (totalEarnings) totalEarnings.textContent = '$0.00';
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
            const response = await fetch(`${API_BASE}/stats`, {
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
        const totalEarnings = document.getElementById('total-earnings');
        if (totalEarnings) totalEarnings.textContent = '$0.00';
        this.displayPositions([]);
    }

    displayPositions(positions) {
        const positionsList = document.getElementById('positions-list');
        if (!positionsList) return;

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
        try {
            const response = await fetch(`${API_BASE}/api/verify_token`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: null })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.status === 'valid' && data.users) {
                    // Check if user has broker connection in backend
                    const hasConnection = data.users.broker_connected || false;
                    this.updateConnectionStatus(hasConnection);
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking connection status:', error);
        }

        // Fallback to localStorage for backwards compatibility
        const derivConnected = localStorage.getItem('deriv_connected') === 'true';
        this.updateConnectionStatus(derivConnected);
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        const connectBtn = document.getElementById('connect-chilla-btn');
        const navConnectBtn = document.getElementById('nav-connect-btn');

        if (connected) {
            if (connectBtn) {
                connectBtn.innerHTML = `
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
                    </svg>
                    <span class="status-dot connected"></span>
                    Disconnect Chilla
                `;
                connectBtn.classList.add('disconnect-unique');
                connectBtn.classList.remove('connect-unique');
            }

            // Update nav button
            if (navConnectBtn) {
                navConnectBtn.classList.add('connected');
                navConnectBtn.classList.remove('disconnected');
            }

            // Start periodic refresh when connected
            this.setupPeriodicRefresh();
        } else {
            if (connectBtn) {
                connectBtn.innerHTML = `
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
                    </svg>
                    <span class="status-dot disconnected"></span>
                    Connect Chilla
                `;
                connectBtn.classList.add('connect-unique');
                connectBtn.classList.remove('disconnect-unique');
            }

            // Update nav button
            if (navConnectBtn) {
                navConnectBtn.classList.add('disconnected');
                navConnectBtn.classList.remove('connected');
            }
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('open');
        }
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

        // Close WebSocket connections
        if (this.ws) {
            this.ws.close();
        }

        if (this.activityWs) {
            this.activityWs.close();
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
        const modal = document.getElementById('broker-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    closeBrokerModal() {
        const modal = document.getElementById('broker-modal');
        if (modal) {
            modal.classList.add('hidden');
            const dropdown = document.getElementById('broker-dropdown');
            const btn = document.getElementById('broker-oauth-btn');
            if (dropdown) dropdown.value = '';
            if (btn) btn.disabled = true;
        }
    }

    showDisconnectModal() {
        const modal = document.getElementById('disconnect-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    closeDisconnectModal() {
        const modal = document.getElementById('disconnect-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    handleBrokerSelection() {
        const dropdown = document.getElementById('broker-dropdown');
        const oauthBtn = document.getElementById('broker-oauth-btn');

        if (dropdown && oauthBtn) {
            if (dropdown.value) {
                oauthBtn.disabled = false;
            } else {
                oauthBtn.disabled = true;
            }
        }
    }

    async handleBrokerOAuth() {
        const selectedBroker = document.getElementById('broker-dropdown')?.value;

        if (!selectedBroker) {
            this.showNotification('Please select a broker', 'error');
            return;
        }

        if (selectedBroker === 'deriv') {
            try {
                // Step 1: Fetch state token from backend
                const res = await fetch("https://cook.beaverlyai.com/api/generate_oauth_state", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include"
                });

                // Step 2: Check if response is OK
                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`Backend returned error: ${res.status} - ${errorText}`);
                }

                // Step 3: Extract JSON safely
                const { state_token } = await res.json();

                // Step 4: Construct Deriv OAuth URL
                const appId = '85950';
                const redirectUri = encodeURIComponent('https://cook.beaverlyai.com/api/connect_oauth/callback');
                const derivOAuthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&redirect_uri=${redirectUri}&state=${state_token}`;

                // Step 5: Mark state in localStorage
                localStorage.setItem('deriv_oauth_pending', 'true');

                // Step 6: Redirect to Deriv
                window.location.href = derivOAuthUrl;
            } catch (error) {
                console.error("OAuth error:", error);
                this.showNotification('Could not start Deriv connection. Please try again.', 'error');
            }
        } else {
            this.showNotification('Other brokers coming soon!', 'info');
        }

        this.closeBrokerModal();
    }

    async confirmDisconnect() {
        try {
            // Call backend API to properly disconnect OAuth
            const response = await fetch(`${API_BASE}/api/disconnect_oauth`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();

                // Clear local storage
                localStorage.removeItem('deriv_connected');
                localStorage.removeItem('deriv_auth_code');
                localStorage.removeItem('deriv_oauth_pending');

                // Update UI
                this.updateConnectionStatus(false);
                this.closeDisconnectModal();
                this.showNotification(`Successfully disconnected from ${result.broker || 'broker'}`, 'success');

                // Refresh dashboard data to show empty state
                this.loadDashboardData();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Failed to disconnect from broker', 'error');
            }
        } catch (error) {
            console.error('Error disconnecting:', error);

            // Fallback: clear local storage anyway
            localStorage.removeItem('deriv_connected');
            localStorage.removeItem('deriv_auth_code');
            localStorage.removeItem('deriv_oauth_pending');

            this.updateConnectionStatus(false);
            this.closeDisconnectModal();
            this.showNotification('Disconnected locally (network error)', 'warning');

            // Refresh dashboard data
            this.loadDashboardData();
        }
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
                if (data && data.status === 'valid') {
                    this.currentUser = data.users || data.user || {
                        email: data.email,
                        email_verified: data.email_verified,
                        full_name: data.full_name,
                        auth_provider: data.auth_provider
                    };

                    // Update verification status display
                    const verificationStatus = document.getElementById('verification-status');
                    const isGmailUser = this.currentUser.auth_provider === 'gmail';

                    if (verificationStatus) {
                        if (this.currentUser.email_verified || isGmailUser) {
                            verificationStatus.innerHTML = '<span class="status-dot verified"></span><span>Verified</span>';
                        } else {
                            verificationStatus.innerHTML = '<span class="status-dot unverified"></span><span>Unverified</span>';
                        }
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
        const homeNav = document.getElementById('home-nav');
        const menuNav = document.getElementById('menu-nav');
        if (homeNav) homeNav.classList.add('active');
        if (menuNav) menuNav.classList.remove('active');

        // Show the main app bar
        const appBar = document.querySelector('.app-bar');
        if (appBar) appBar.style.display = 'flex';

        // Reset app title and dashboard
        const appTitle = document.querySelector('.app-title');
        if (appTitle) appTitle.textContent = 'Chilla';

        // Restore original sidebar content
        this.restoreOriginalSidebar();

        this.loadDashboardData();
        this.showMainDashboard();
    }

    showMainDashboard() {
        const dashboard = document.getElementById('dashboard');
        if (!dashboard) return;

        dashboard.innerHTML = `
            <div id="chilla-activity-status" class="activity-card">
                <div class="activity-status status-disconnected">
                    <div class="status-header">
                        <div class="status-title">Not Connected</div>
                        <div class="status-indicator"></div>
                    </div>
                    <div class="status-details">
                        <div class="status-info">
                            <span>Connect a broker to start monitoring</span>
                        </div>
                    </div>
                </div>
            </div>

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

    openIPPartners() {
        // Placeholder for IP Partners functionality
        console.log('IP Partners functionality to be implemented');
    }

    restoreOriginalSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarContent = sidebar?.querySelector('.sidebar-content');
        if (!sidebarContent) return;

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
        const addListener = (id, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            }
        };

        addListener('connect-chilla-btn', () => this.handleConnectChilla());
        addListener('change-email-btn', () => this.changeEmail());
        addListener('change-password-btn', () => this.changePassword());
        addListener('verify-email-btn', () => this.verifyEmail());
        addListener('contact-btn', () => this.showContact());
        addListener('faq-btn', () => this.showFAQ());
        addListener('privacy-btn', () => this.showPrivacy());
        addListener('terms-btn', () => this.showTerms());
        addListener('logout-btn', () => this.handleLogout());
        addListener('theme-toggle', () => this.toggleTheme());
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

        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                notification.remove();
            });
        }

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showVerificationRequiredModal() {
        const modal = document.createElement('div');
        modal.id = 'verification-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Verify Your Email</h2>
                <p>Please verify your email address to continue.</p>
                <p>A verification email has been sent to ${this.currentUser.email}.</p>
                <p>If you haven't received it, please check your spam folder or click the button below to resend.</p>
                <button id="resend-verification-btn">Resend Email</button>
                <button id="close-verification-modal-btn">Close</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('resend-verification-btn')?.addEventListener('click', () => {
            this.verifyEmail();
        });

        document.getElementById('close-verification-modal-btn')?.addEventListener('click', () => {
            this.closeVerificationModal();
        });
    }

    closeVerificationModal() {
        const modal = document.getElementById('verification-modal');
        if (modal) {
            modal.remove();
        }
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
