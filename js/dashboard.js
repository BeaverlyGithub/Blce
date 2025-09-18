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

        try {
            const response = await fetch(`${this.API_BASE}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
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

// Secure Dashboard with Pure Server-Side Control
class ChillaDashboard {
    constructor() {
        this.currentUser = null;
        this.wsConnection = null;
        this.activityWs = null;
        this.csrfToken = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.activityWsReconnectAttempts = 0;
        this.currentTheme = 'light';
        this.isConnected = false;
        this.verificationPollingInterval = null;
        this.refreshInterval = null;
        this.authToken = null;
        this.init();
    }

    async init() {
        this.setupTheme();
        this.setupPageVisibilityHandler();
        this.handleDerivCallback();

        // Small delay to ensure DOM is ready
        setTimeout(async () => {
            await this.validateSession();
        }, 100);
    }

    setupTheme() {
        this.currentTheme = localStorage.getItem('chilla-theme') || 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }

    setupPageVisibilityHandler() {
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                await this.refreshUserData();
            }
        });
    }

    handleDerivCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const isPending = localStorage.getItem('deriv_oauth_pending') === 'true';

        if (code && isPending) {
            localStorage.setItem('deriv_connected', 'true');
            localStorage.setItem('deriv_auth_code', code);
            localStorage.removeItem('deriv_oauth_pending');
            window.history.replaceState({}, document.title, window.location.pathname);
            this.showNotification('Successfully connected to Deriv!', 'success');
            this.updateConnectionStatus(true);
        }
    }

    async validateSession() {
        const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
        if (justLoggedIn) {
            sessionStorage.removeItem('just_logged_in');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(`${API_BASE}/api/verify_token`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ token: null })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.status === 'valid') {
                        // Server provides all user data and security decisions
                        this.authToken = data.token || null;
                        this.currentUser = data.users || data.user;

                        if (this.currentUser?.email) {
                            localStorage.setItem('chilla_user_email', this.currentUser.email);
                        }

                        await this.loadCSRFToken();
                        this.showMainApp();

                        // Server decides if verification modal should be shown
                        if (data.show_verification_modal) {
                            this.showVerificationRequiredModal();
                            return;
                        }

                        this.setupEventListeners();
                        this.loadDashboardData();
                        this.setupPeriodicRefresh();
                        this.initializeWebSocket();
                        console.log('Dashboard loaded successfully');
                        return;
                    }
                }

                console.log(`Auth attempt ${attempt} failed. Status: ${response.status}`);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            } catch (error) {
                console.warn(`Auth check attempt ${attempt} failed:`, error.message || error);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) {
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(async () => {
                try {
                    const response = await fetch(`${API_BASE}/api/verify_token`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: JSON.stringify({ token: null })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.status === 'valid') {
                            window.location.reload();
                            return;
                        }
                    }
                } catch (err) {
                    console.warn('OAuth callback retry failed:', err.message);
                }
                this.redirectToLogin();
            }, 3000);
            return;
        }

        console.warn('All authentication attempts failed, redirecting to login');
        this.redirectToLogin();
    }

    async loadCSRFToken() {
        try {
            const response = await fetch(`${API_BASE}/api/csrf_token`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
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

    getSecureHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-CSRF-Token': this.csrfToken || ''
        };
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    getAuthToken() {
        // Try to get token from cookie first
        let token = this.getCookie('chilla_token');

        // If not in cookie, try localStorage as fallback
        if (!token) {
            token = localStorage.getItem('chilla_token');
        }

        return token;
    }

    async getValidAuthToken() {
        // Get a fresh token from the server since we can't access HTTP-only cookies directly
        try {
            const response = await fetch(`${API_BASE}/api/verify_token`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ token: null })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.status === 'valid' && data.token) {
                    return data.token;
                }
            }
        } catch (error) {
            console.error('Failed to get valid auth token:', error);
        }
        return null;
    }

    redirectToLogin() {
        window.location.href = 'index.html';
    }

    showMainApp() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');

        if (this.currentUser) {
            // Construct full name from server-provided data
            const fullName = [
                this.currentUser.first_name || '',
                this.currentUser.middle_name || '',
                this.currentUser.last_name || ''
            ].filter(name => name.trim()).join(' ') || 'User';

            document.getElementById('user-display-name').textContent = fullName;
            document.getElementById('user-display-email').textContent = this.currentUser.email;

            // Server provides verification status - no client-side logic
            const verificationStatus = document.getElementById('verification-status');
            if (this.currentUser.email_verified) {
                verificationStatus.innerHTML = '<span class="status-dot verified"></span><span>Verified</span>';
            } else {
                verificationStatus.innerHTML = '<span class="status-dot unverified"></span><span>Unverified</span>';
            }

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
        await this.checkConnectionStatus();

        if (!this.isConnected) {
            document.getElementById('account-balance').textContent = '$0.00';
            const totalEarnings = document.getElementById('total-earnings');
            if (totalEarnings) totalEarnings.textContent = '$0.00';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/account_data`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getSecureHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('account-balance').textContent = this.formatCurrency(data.balance || 0);
                const totalEarnings = document.getElementById('total-earnings');
                if (totalEarnings) totalEarnings.textContent = this.formatCurrency(data.equity || 0);
            } else if (response.status === 404) {
                document.getElementById('account-balance').textContent = '$0.00';
                const totalEarnings = document.getElementById('total-earnings');
                if (totalEarnings) totalEarnings.textContent = '$0.00';
                return;
            } else {
                throw new Error(`Failed to load balance: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            document.getElementById('account-balance').textContent = '$0.00';
            const totalEarnings = document.getElementById('total-earnings');
            if (totalEarnings) totalEarnings.textContent = '$0.00';
        }
    }

    async loadPositions() {
        await this.checkConnectionStatus();

        if (!this.isConnected) {
            this.displayPositions([]);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/account_data`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getSecureHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.displayPositions(data.positions || data.open_trades || []);
            } else if (response.status === 404) {
                this.displayPositions([]);
                return;
            } else {
                throw new Error(`Failed to load positions: ${response.status}`);
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
                headers: this.getSecureHeaders(),
                body: JSON.stringify({ token: null })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.status === 'valid' && data.users) {
                    // Server provides connection status - no client logic
                    const hasConnection = data.users.broker_connected || false;
                    this.updateConnectionStatus(hasConnection);
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking connection status:', error);
        }

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

            if (navConnectBtn) {
                navConnectBtn.classList.add('connected');
                navConnectBtn.classList.remove('disconnected');
            }

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

            if (navConnectBtn) {
                navConnectBtn.classList.add('disconnected');
                navConnectBtn.classList.remove('connected');
            }
        }
    }

    async initializeWebSocket() {
        if (!this.currentUser?.email) {
            console.log('WebSocket initialization skipped - no user email');
            return;
        }

        // Server decides if WebSocket should be initialized based on verification status
        try {
            const wsTokenResponse = await fetch(`${API_BASE}/api/ws_token`, {
                method: 'POST',
                credentials: 'include',
                headers: this.getSecureHeaders()
            });

            if (wsTokenResponse.ok) {
                const tokenData = await wsTokenResponse.json();
                if (tokenData.ws_token) {
                    this.connectWebSocket(tokenData.ws_token);
                    this.setupActivityWebSocket(tokenData.ws_token);
                }
            } else {
                console.error('Failed to get WebSocket token:', wsTokenResponse.status);
            }
        } catch (error) {
            console.error('WebSocket token error:', error);
        }
    }

    connectWebSocket(wsToken) {
        if (!wsToken) {
            console.error('No WebSocket token provided');
            return;
        }

        const wsHost = API_BASE.replace('https://', '').replace('http://', '');
        const wsUrl = `wss://${wsHost}/ws?token=${wsToken}`;

        try {
            this.wsConnection = new WebSocket(wsUrl);

            this.wsConnection.onopen = () => {
                console.log('📡 WebSocket connected');
                this.reconnectAttempts = 0;
            };

            this.wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            };

            this.wsConnection.onclose = (event) => {
                console.log('📡 WebSocket disconnected');
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(5000 * this.reconnectAttempts, 30000);
                    setTimeout(() => this.initializeWebSocket(), delay);
                }
            };

            this.wsConnection.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('WebSocket connection error:', error);
        }
    }

    setupActivityWebSocket(wsToken) {
        if (!this.currentUser?.email) {
            console.error('No user email available for Activity WebSocket');
            return;
        }

        const wsHost = API_BASE.replace('https://', '').replace('http://', '');
        const activityWsUrl = `wss://${wsHost}/activity-ws?email=${encodeURIComponent(this.currentUser.email)}`;

        try {
            this.activityWs = new WebSocket(activityWsUrl);

            this.activityWs.onopen = () => {
                console.log('📊 Activity WebSocket connected');
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
                console.log('📊 Activity WebSocket disconnected', event.code);

                if (event.code !== 1000 && this.activityWsReconnectAttempts < this.maxReconnectAttempts) {
                    const reconnectDelay = Math.min(5000 * Math.pow(2, this.activityWsReconnectAttempts), 30000);
                    this.activityWsReconnectAttempts++;

                    console.log(`📊 Will reconnect Activity WebSocket in ${reconnectDelay / 1000}s (attempt ${this.activityWsReconnectAttempts})`);
                    setTimeout(() => this.initializeWebSocket(), reconnectDelay);
                }
            };

            this.activityWs.onerror = (error) => {
                console.error('Activity WebSocket error:', error);
            };
        } catch (error) {
            console.error('Activity WebSocket connection error:', error);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'balance_update':
                document.getElementById('account-balance').textContent = this.formatCurrency(data.balance);
                break;
            case 'position_update':
                this.displayPositions(data.positions);
                break;
            case 'trade_signal':
                this.showNotification(`Trade Signal: ${data.action} ${data.symbol}`, 'info');
                break;
        }
    }

    handleActivityMessage(data) {
        if (data.type === 'activity_update') {
            console.log('Activity data received:', data.data);
            this.updateActivityStatus(data.data);
        }
    }

    updateActivityStatus(activityData) {
        const activityElement = document.getElementById('chilla-activity-status');
        if (!activityElement) return;

        const { status, broker, account_id, watching_markets, last_activity, monitoring_active } = activityData;

        const displayAccountId = account_id || activityData.accountId || activityData.account ||
            (activityData.broker_data && activityData.broker_data.account_id);

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
        } else if (status === 'connected' || status === 'idle') {
            statusClass = 'status-idle';
            statusHtml = `
                <div class="activity-status ${statusClass}">
                    <div class="status-header">
                        <div class="status-title">Connected - Waiting for Chilla</div>
                        <div class="status-indicator"></div>
                    </div>
                    <div class="status-details">
                        ${displayAccountId ? `<div class="account-id-display">Account: <span class="account-id-value">${displayAccountId}</span></div>` : ''}
                        <div class="status-info">
                            <span>Broker: ${broker || 'Unknown'}</span>
                            <span>Status: ${status === 'idle' ? 'Chilla will start monitoring shortly' : 'Waiting for monitoring to begin'}</span>
                        </div>
                        <div class="watching-markets">
                            ${watching_markets && watching_markets.length > 0 ? `Markets ready: ${watching_markets.map(m => m.name).join(', ')}` : 'No markets configured yet'}
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

    setupEventListeners() {
        // Attach logout button immediately since it's critical
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔓 Logout button clicked');
                this.handleLogout();
            });
            console.log('✅ Logout button listener attached immediately');
        } else {
            console.warn('⚠️ Logout button not found in DOM');
        }

        // Attach other listeners with delay
        setTimeout(() => {
            this.attachAllEventListeners();
        }, 100);
    }

    attachAllEventListeners() {
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.removeEventListener(event, handler);
                element.addEventListener(event, handler);
            }
        };

        const addListenerByQuery = (selector, event, handler) => {
            const element = document.querySelector(selector);
            if (element) {
                element.removeEventListener(event, handler);
                element.addEventListener(event, handler);
            }
        };

        const boundMethods = {
            toggleSidebar: this.toggleSidebar.bind(this),
            toggleTheme: this.toggleTheme.bind(this),
            handleConnectChilla: this.handleConnectChilla.bind(this),
            handleLogout: (e) => {
                e.preventDefault();
                console.log('🔓 Logout method called via boundMethods');
                this.handleLogout().catch(err => {
                    console.error('Logout error:', err);
                    // Force redirect even on error
                    window.location.href = 'index.html';
                });
            },
            changeEmail: this.changeEmail.bind(this),
            changePassword: this.changePassword.bind(this),

            showContact: this.showContact.bind(this),
            showFAQ: this.showFAQ.bind(this),
            showPrivacy: this.showPrivacy.bind(this),
            showTerms: this.showTerms.bind(this),
            handleBrokerSelection: this.handleBrokerSelection.bind(this),
            handleBrokerOAuth: this.handleBrokerOAuth.bind(this),
            closeBrokerModal: this.closeBrokerModal.bind(this),
            confirmDisconnect: this.confirmDisconnect.bind(this),
            closeDisconnectModal: this.closeDisconnectModal.bind(this),
            closeSidebar: this.closeSidebar.bind(this)
        };

        addListener('menu-btn', 'click', boundMethods.toggleSidebar);
        addListener('theme-toggle', 'click', boundMethods.toggleTheme);
        addListener('nav-connect-btn', 'click', boundMethods.handleConnectChilla);
        // Skip logout button since we attached it immediately in setupEventListeners
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            console.log('✅ Logout button found and already has listener');
        } else {
            console.warn('⚠️ Logout button not found during attachAllEventListeners');
        }

        addListener('connect-chilla-btn', 'click', boundMethods.handleConnectChilla);
        addListener('change-email-btn', 'click', boundMethods.changeEmail);
        addListener('change-password-btn', 'click', boundMethods.changePassword);

        addListener('contact-btn', 'click', boundMethods.showContact);
        addListener('faq-btn', 'click', boundMethods.showFAQ);
        addListener('privacy-btn', 'click', boundMethods.showPrivacy);
        addListener('terms-btn', 'click', boundMethods.showTerms);

        addListener('broker-dropdown', 'change', boundMethods.handleBrokerSelection);
        addListener('broker-oauth-btn', 'click', boundMethods.handleBrokerOAuth);
        addListener('modal-close-btn', 'click', boundMethods.closeBrokerModal);
        addListener('confirm-disconnect-btn', 'click', boundMethods.confirmDisconnect);
        addListener('cancel-disconnect-btn', 'click', boundMethods.closeDisconnectModal);

        addListenerByQuery('.sidebar-overlay', 'click', boundMethods.closeSidebar);

        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.addEventListener('click', (e) => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('active')) {
                    this.closeSidebar();
                }
            });
        }

        console.log('All event listeners attached');
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('active');
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('chilla-theme', this.currentTheme);
    }

    async handleLogout() {
        console.log('🔓 Logout initiated');

        // Clear all local data first
        localStorage.clear();
        sessionStorage.clear();

        // Clear intervals
        if (this.verificationPollingInterval) {
            clearInterval(this.verificationPollingInterval);
            this.verificationPollingInterval = null;
        }

        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        // Close WebSocket connections
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }

        if (this.activityWs) {
            this.activityWs.close();
            this.activityWs = null;
        }

        // Clear cookies manually as fallback
        document.cookie = 'chilla_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.beaverlyai.com; secure; samesite=none';
        document.cookie = 'chilla_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

        // Call logout API
        try {
            const response = await fetch(`${API_BASE}/api/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken || '',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                console.warn('Logout API call failed:', response.status);
            } else {
                console.log('✅ Logout API call successful');
            }
        } catch (error) {
            console.warn('Logout API error:', error);
        }

        // Force redirect regardless of API response
        console.log('🔄 Redirecting to login page');
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
        try {
            // Get selected broker from dropdown
            const dropdown = document.getElementById('broker-dropdown');
            if (!dropdown || !dropdown.value) {
                throw new Error('Please select a broker first.');
            }

            const broker = dropdown.value;
            console.log(`🔗 Starting ${broker} OAuth flow`);

            // Fetch OAuth configuration from server
            const configResponse = await fetch(`${API_BASE}/api/oauth_config`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            if (!configResponse.ok) {
                throw new Error('Failed to get OAuth configuration');
            }

            const config = await configResponse.json();

            // Generate state token with proper API endpoint
            const stateResponse = await fetch(`${API_BASE}/api/generate_oauth_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            if (!stateResponse.ok) {
                const errorText = await stateResponse.text();
                throw new Error(`Backend returned error: ${stateResponse.status} - ${errorText}`);
            }

            const { state_token } = await stateResponse.json();

            // Use server-provided Deriv app ID
            const appId = config.deriv.app_id;
            const redirectUri = encodeURIComponent(config.deriv.redirect_uri);
            const derivOAuthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&redirect_uri=${redirectUri}&state=${state_token}`;

            localStorage.setItem('deriv_oauth_pending', 'true');
            window.location.href = derivOAuthUrl;
        } catch (error) {
            console.error("OAuth error:", error);
            this.showNotification('Could not start Deriv connection. Please try again.', 'error');
        }

        this.closeBrokerModal();
    }

    async confirmDisconnect() {
        try {
            const response = await fetch(`${API_BASE}/api/disconnect_oauth`, {
                method: 'POST',
                credentials: 'include',
                headers: this.getSecureHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                localStorage.removeItem('deriv_connected');
                localStorage.removeItem('deriv_auth_code');
                localStorage.removeItem('deriv_oauth_pending');

                this.updateConnectionStatus(false);
                this.closeDisconnectModal();
                this.showNotification(`Successfully disconnected from ${result.broker || 'broker'}`, 'success');
                this.loadDashboardData();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Failed to disconnect from broker', 'error');
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
            localStorage.removeItem('deriv_connected');
            localStorage.removeItem('deriv_auth_code');
            localStorage.removeItem('deriv_oauth_pending');

            this.updateConnectionStatus(false);
            this.closeDisconnectModal();
            this.showNotification('Disconnected locally (network error)', 'warning');
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



    startVerificationPolling() {
        if (this.verificationPollingInterval) {
            clearInterval(this.verificationPollingInterval);
        }

        let attempts = 0;
        const maxAttempts = 60;

        this.verificationPollingInterval = setInterval(async () => {
            attempts++;

            if (attempts >= maxAttempts) {
                clearInterval(this.verificationPollingInterval);
                this.verificationPollingInterval = null;
                return;
            }

            if (this.currentUser?.email_verified) {
                clearInterval(this.verificationPollingInterval);
                this.verificationPollingInterval = null;
                return;
            }

            await this.refreshUserData();

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
                headers: this.getSecureHeaders(),
                body: JSON.stringify({ token: null })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.status === 'valid') {
                    this.currentUser = data.users || data.user;

                    const verificationStatus = document.getElementById('verification-status');

                    if (verificationStatus) {
                        // Server provides verification status - no client-side logic
                        if (this.currentUser?.email_verified) {
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
        modal.className = 'broker-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 2rem;';
        modal.innerHTML = `
            <div class="broker-modal-content">
                <h3>📧 Verify Your Email</h3>
                <p>Please verify your email address to continue using Chilla.</p>
                <p>A verification email has been sent to <strong>${this.currentUser.email}</strong>.</p>
                <p>If you haven't received it, please check your spam folder or click the button below to resend.</p>
                <button id="resend-verification-btn" class="broker-oauth-btn">Resend Verification Email</button>
                <button id="logout-from-verification-btn" class="modal-close-btn">Logout</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('resend-verification-btn')?.addEventListener('click', () => {
            this.verifyEmail();
        });

        document.getElementById('logout-from-verification-btn')?.addEventListener('click', () => {
            this.handleLogout();
        });
    }

    closeVerificationModal() {
        const modal = document.getElementById('verification-modal');
        if (modal) {
            modal.remove();
        }
    }

    setupPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        if (this.isConnected) {
            this.refreshInterval = setInterval(() => {
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