// Prefer APP_CONFIG helpers when available (apiUrl/wsUrl). Fallback to a reasonable default.
const API_BASE = (window.APP_CONFIG && typeof window.APP_CONFIG.apiUrl === 'function') ? window.APP_CONFIG.apiUrl('') : ((window.APP_CONFIG && window.APP_CONFIG.API_BASE) ? window.APP_CONFIG.API_BASE : 'https://cook.beaverlyai.com');

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
            this.showError('Could not send message — please check your connection and try again');
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
            await this.loadMandateStatus(); // NEW: Load mandate on init
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
        const state = urlParams.get('state');

        if (code && state) {
            // Send OAuth code to server immediately - never store locally
            this.processOAuthCallback(code, state);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    async processOAuthCallback(code, state) {
        try {
            const response = await fetch(`${API_BASE}/api/oauth_callback`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken || '',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ code, state })
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification('Successfully connected to broker!', 'success');
                this.updateConnectionStatus(true);
                await this.loadDashboardData();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Could not connect — please try again', 'error');
            }
        } catch (error) {
            console.error('OAuth callback processing error:', error);
            this.showNotification('Could not complete connection — please try again', 'error');
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
            console.error('Security verification unavailable:', error);
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
                this.checkConnectionStatus(),
                this.loadMandateStatus() // NEW: Include mandate status
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.loadFallbackData();
        }
    }

    // ==================== NEW: Mandate Management ====================
    
    async loadMandateStatus() {
        try {
            const mandate = await window.chillaAPI.getCurrentMandate();
            
            if (mandate && mandate.status === 'active') {
                this.displayActiveMandate(mandate);
            } else {
                this.displayUnauthorizedMandate();
            }
        } catch (error) {
            console.error('Failed to load mandate:', error);
            this.displayUnauthorizedMandate();
        }
    }

    displayActiveMandate(mandate) {
        // Update status badge
        const badge = document.getElementById('mandate-status-badge');
        if (badge) {
            badge.textContent = 'Active';
            badge.className = 'status-badge active';
        }

        // Show active view, hide unauthorized message
        const activeView = document.getElementById('mandate-active-view');
        const mandateDetails = document.getElementById('mandate-details');
        if (activeView) activeView.classList.remove('hidden');
        if (mandateDetails) mandateDetails.style.display = 'none';

        // Populate mandate details
        document.getElementById('mandate-strategy').textContent = 
            mandate.strategy_id || '—';
        
        const riskCap = mandate.omega_max_bps 
            ? `${(mandate.omega_max_bps / 100).toFixed(1)}% (${mandate.omega_max_bps} bps)` 
            : '—';
        document.getElementById('mandate-risk-cap').textContent = riskCap;

        // Update omega usage (will be updated via WebSocket)
        this.updateOmegaUsageDisplay(mandate.omega_cap_usage_percent || 0);

        // Setup mandate action buttons
        this.setupMandateActions(mandate.id || mandate.mandate_id);
    }

    displayUnauthorizedMandate() {
        const badge = document.getElementById('mandate-status-badge');
        if (badge) {
            badge.textContent = 'Unauthorized';
            badge.className = 'status-badge unauthorized';
        }

        const activeView = document.getElementById('mandate-active-view');
        const mandateDetails = document.getElementById('mandate-details');
        if (activeView) activeView.classList.add('hidden');
        if (mandateDetails) mandateDetails.style.display = 'block';
    }

    updateOmegaUsageDisplay(percent) {
        if (typeof percent !== 'number' || isNaN(percent)) percent = 0;
        const clamped = Math.max(0, Math.min(100, percent));

        // Update percentage text
        const percentEl = document.getElementById('omega-usage-percent');
        const centerPercentEl = document.getElementById('omega-percent-center');
        if (percentEl) percentEl.textContent = `${clamped.toFixed(1)}%`;
        if (centerPercentEl) centerPercentEl.textContent = `${clamped.toFixed(0)}%`;

        // Update circular progress ring
        const circle = document.getElementById('progress-ring-circle');
        if (circle) {
            const circumference = 2 * Math.PI * 54; // r=54
            const offset = circumference - (clamped / 100) * circumference;
            circle.style.strokeDashoffset = offset;
        }
    }

    setupMandateActions(mandateId) {
        const pauseBtn = document.getElementById('pause-mandate-btn');
        const revokeBtn = document.getElementById('revoke-mandate-btn');

        if (pauseBtn) {
            pauseBtn.onclick = () => this.handlePauseMandate(mandateId);
        }

        if (revokeBtn) {
            revokeBtn.onclick = () => this.handleRevokeMandate(mandateId);
        }
    }

    async handlePauseMandate(mandateId) {
        if (!confirm('Pause trading? Chilla will stop monitoring markets until you reactivate.')) {
            return;
        }

        try {
            // Backend requires: POST /api/mandates/{mandate_id}/update
            // Body: { mandate_id, changes: {...}, reason }
            await window.chillaAPI.updateMandate(mandateId, {
                mandate_id: mandateId,
                changes: {
                    status: 'paused'
                },
                reason: 'User requested pause'
            });

            this.showNotification('Mandate paused successfully', 'success');
            await this.loadMandateStatus();
        } catch (error) {
            console.error('Failed to pause mandate:', error);
            this.showNotification('Could not pause mandate. Please try again.', 'error');
        }
    }

    async handleRevokeMandate(mandateId) {
        if (!confirm('Revoke mandate? This will permanently stop all trading. You can create a new mandate later.')) {
            return;
        }

        try {
            // Backend requires: POST /api/mandates/{mandate_id}/revoke
            // Body: { mandate_id, reason }
            await window.chillaAPI.revokeMandate(mandateId, {
                mandate_id: mandateId,
                reason: 'User requested revocation'
            });

            this.showNotification('Mandate revoked successfully', 'success');
            await this.loadMandateStatus();
        } catch (error) {
            console.error('Failed to revoke mandate:', error);
            this.showNotification('Could not revoke mandate. Please try again.', 'error');
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

        // Connection status now determined by server-side verification only
        this.updateConnectionStatus(false);
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
                    this.connectSignalWebSocket(tokenData.ws_token); // NEW: Connect to signal WS
                }
            } else {
                console.error('Failed to get WebSocket token:', wsTokenResponse.status);
            }
        } catch (error) {
            console.error('WebSocket token error:', error);
        }
    }

    // ==================== NEW: Signal WebSocket for Decision Reports ====================
    
    connectSignalWebSocket(wsToken) {
        if (!wsToken) {
            console.error('No WebSocket token for signal connection');
            return;
        }

        try {
            this.signalWs = window.chillaAPI.connectSignalWS(wsToken);

            this.signalWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'decision_report' || data.report) {
                        this.handleDecisionReport(data.report || data);
                    }
                } catch (error) {
                    console.error('Error parsing signal message:', error);
                }
            };

            this.signalWs.onclose = (event) => {
                console.log('📡 Signal WebSocket disconnected', event.code);
                // Auto-reconnect logic
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 30000);
                    this.reconnectAttempts++;
                    setTimeout(() => this.initializeWebSocket(), delay);
                }
            };

        } catch (error) {
            console.error('Signal WebSocket connection error:', error);
        }
    }

    handleDecisionReport(report) {
        console.log('📋 Decision report received:', report);

        // Backend sends: { type: "decision_report", id, mandate_id, strategy_id, symbol, action, skip_reason?, reason, inputs, risk, exec?, outcome?, timestamp }
        this.addDecisionToFeed(report);

        // Show toast notification for important decisions
        const action = report.action; // enter_buy, enter_sell, skip_trade_signal, etc.
        
        if (action === 'skip_trade_signal') {
            const skipReason = report.skip_reason || 'unknown';
            this.showNotification(`Trade skipped: ${skipReason.replace(/_/g, ' ')}`, 'warning');
        } else if (action.startsWith('enter_')) {
            const direction = action === 'enter_buy' ? 'BUY' : 'SELL';
            this.showNotification(`${direction} executed on ${report.symbol}`, 'success');
        } else if (action.startsWith('exit_')) {
            this.showNotification(`Position closed on ${report.symbol}`, 'info');
        }

        // Omega usage comes from activity_ws, NOT decision reports
    }

    addDecisionToFeed(report) {
        const feed = document.getElementById('decision-feed');
        if (!feed) return;

        // Remove placeholder if present
        const placeholder = feed.querySelector('.decision-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        // Parse backend DecisionReport format
        const { 
            action,           // enter_buy, enter_sell, skip_trade_signal, exit_buy, etc.
            skip_reason,      // cap_exhausted, broker_minimum, out_of_mandate, etc.
            reason,           // Human-readable explanation
            symbol,
            strategy_id,
            mandate_id,
            inputs,           // inputs_summary (non-IP market data)
            risk,             // risk_allocation (risk_bps, lot_size, SL, TP)
            exec,             // exec_metadata (contract_id, broker response)
            outcome,          // outcome (P&L if closed)
            timestamp
        } = report;

        // Determine decision type class and display text
        let typeClass = '';
        let actionText = '';
        let statusText = '';

        if (action === 'skip_trade_signal') {
            typeClass = 'skip';
            actionText = 'Trade Skipped';
            statusText = skip_reason ? skip_reason.replace(/_/g, ' ').toUpperCase() : '';
        } else if (action === 'enter_buy') {
            typeClass = 'enter';
            actionText = 'ENTER BUY';
            statusText = symbol;
        } else if (action === 'enter_sell') {
            typeClass = 'enter';
            actionText = 'ENTER SELL';
            statusText = symbol;
        } else if (action === 'exit_buy' || action === 'exit_sell') {
            typeClass = 'exit';
            actionText = action === 'exit_buy' ? 'EXIT BUY' : 'EXIT SELL';
            statusText = symbol;
        } else if (action === 'modify_stop_loss') {
            typeClass = 'modify';
            actionText = 'SL Modified';
            statusText = symbol;
        } else {
            typeClass = 'other';
            actionText = action.replace(/_/g, ' ').toUpperCase();
            statusText = symbol;
        }

        // Build risk info string
        let riskInfo = '';
        if (risk) {
            if (risk.risk_bps) {
                riskInfo = `Risk: ${(risk.risk_bps / 100).toFixed(2)}%`;
            }
            if (risk.lot_size || risk.stake) {
                riskInfo += ` | Size: ${risk.lot_size || risk.stake}`;
            }
        }

        // Build outcome string (if closed)
        let outcomeStr = '';
        if (outcome && outcome.pnl) {
            const pnlClass = outcome.pnl >= 0 ? 'profit' : 'loss';
            outcomeStr = `<div class="decision-outcome ${pnlClass}">P&L: ${outcome.pnl >= 0 ? '+' : ''}${outcome.pnl.toFixed(2)}</div>`;
        }

        const item = document.createElement('div');
        item.className = `decision-item ${typeClass}`;
        item.innerHTML = `
            <div class="decision-header">
                <span class="decision-action">${actionText} ${statusText ? '— ' + statusText : ''}</span>
                <span class="decision-timestamp">${this.formatTimeAgo(timestamp)}</span>
            </div>
            ${reason ? `<div class="decision-reason">${reason}</div>` : ''}
            ${riskInfo ? `<div class="decision-risk">${riskInfo}</div>` : ''}
            ${outcomeStr}
            <div class="decision-metadata">
                <span class="decision-tag">${strategy_id}</span>
                ${mandate_id ? `<span class="decision-tag">v${report.mandate_version || 1}</span>` : ''}
            </div>
        `;

        // Insert at top with smooth animation
        if (feed.firstChild) {
            feed.insertBefore(item, feed.firstChild);
        } else {
            feed.appendChild(item);
        }

        // Trigger slide-in animation
        setTimeout(() => item.classList.add('slide-in'), 10);

        // Update decision count
        this.updateDecisionCount();

        // Keep feed manageable (max 50 items)
        while (feed.children.length > 50) {
            feed.removeChild(feed.lastChild);
        }
    }

    updateDecisionCount() {
        const feed = document.getElementById('decision-feed');
        const countEl = document.getElementById('decision-count');
        
        if (feed && countEl) {
            const count = feed.querySelectorAll('.decision-item').length;
            countEl.textContent = count;
        }
    }

    formatTimeAgo(timestamp) {
        const now = Date.now() / 1000;
        const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime() / 1000;
        const diff = now - ts;

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    connectWebSocket(wsToken) {
        if (!wsToken) {
            console.error('No WebSocket token provided');
            return;
        }

        let wsUrl;
        if (window.APP_CONFIG && typeof window.APP_CONFIG.wsUrl === 'function') {
            wsUrl = window.APP_CONFIG.wsUrl(`/ws?token=${wsToken}`);
        } else {
            const wsHost = API_BASE.replace('https://', '').replace('http://', '');
            wsUrl = `wss://${wsHost}/ws?token=${wsToken}`;
        }

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
        if (!wsToken) {
            console.error('Websocket temporarily unavailable');
            return;
        }

        try {
            // Use API client to connect with token (handles URL building)
            this.activityWs = window.chillaAPI.connectActivityWS(wsToken);

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
            case 'decision_report':
                // Human-friendly decision feed entry
                try {
                    this.displayDecisionReport(data.report || data);
                } catch (e) {
                    console.error('Error displaying decision report:', e);
                }
                break;
            case 'risk_budget_update':
                // Contains { omega_cap_usage_percent, mandate_id }
                try {
                    this.updateOmegaUsage(data);
                } catch (e) {
                    console.error('Error updating omega usage:', e);
                }
                break;
        }
    }

    handleActivityMessage(data) {
        if (data.type === 'activity_update') {
            console.log('Activity data received:', data.data);
            this.updateActivityStatus(data.data);
        } else if (data.type === 'risk_budget_update') {
            // Handle omega usage updates from activity WebSocket
            console.log('Omega usage update received:', data);
            if (data.omega_cap_usage_percent !== undefined) {
                this.updateOmegaUsageDisplay(data.omega_cap_usage_percent);
            }
        }
    }

    updateActivityStatus(activityData) {
        const activityElement = document.getElementById('chilla-activity-status');
        if (!activityElement) return;

        const { status, broker, account_id, watching_markets, last_activity, monitoring_active, has_mandate } = activityData;

        const displayAccountId = account_id || activityData.accountId || activityData.account ||
            (activityData.broker_data && activityData.broker_data.account_id);

        let statusHtml = '';
        let statusClass = '';

        // State 1: Actively monitoring (mandate exists + monitoring active)
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
                            Watching: ${watching_markets && watching_markets.length > 0 ? watching_markets.map(m => m.name).join(', ') : 'No markets'}
                        </div>
                    </div>
                </div>
            `;
        } 
        // State 2: Broker connected + mandate exists but not monitoring yet (warming up)
        else if ((status === 'connected' || status === 'idle') && has_mandate) {
            statusClass = 'status-warming';
            statusHtml = `
                <div class="activity-status ${statusClass}">
                    <div class="status-header">
                        <div class="status-title">Ready to Execute Instructions</div>
                        <div class="status-indicator"></div>
                    </div>
                    <div class="status-details">
                        ${displayAccountId ? `<div class="account-id-display">Account: <span class="account-id-value">${displayAccountId}</span></div>` : ''}
                        <div class="status-info">
                            <span>Broker: ${broker || 'Unknown'}</span>
                            <span>Status: Chilla will carry out your instructions shortly</span>
                        </div>
                        <div class="watching-markets">
                            ${watching_markets && watching_markets.length > 0 ? `Markets ready: ${watching_markets.map(m => m.name).join(', ')}` : 'Preparing markets...'}
                        </div>
                    </div>
                </div>
            `;
        }
        // State 3: Broker connected but NO mandate (needs user action)
        else if (status === 'connected' || status === 'idle') {
            statusClass = 'status-idle';
            statusHtml = `
                <div class="activity-status ${statusClass}">
                    <div class="status-header">
                        <div class="status-title">Connected - Waiting for Instructions</div>
                        <div class="status-indicator"></div>
                    </div>
                    <div class="status-details">
                        ${displayAccountId ? `<div class="account-id-display">Account: <span class="account-id-value">${displayAccountId}</span></div>` : ''}
                        <div class="status-info">
                            <span>Broker: ${broker || 'Unknown'}</span>
                            <span>Status: Chilla is waiting for your instructions</span>
                        </div>
                        <div class="watching-markets">
                            Create a mandate to get started
                        </div>
                    </div>
                </div>
            `;
        } 
        // State 4: Not connected at all
        else {
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
        // If activityData contains omega usage info, update mandate card
        if (activityData.omega_cap_usage_percent !== undefined) {
            this.updateOmegaUsageDisplay(activityData.omega_cap_usage_percent);
        }
    }

    // Adds a decision item to the decision feed UI
    displayDecisionReport(report) {
        // report expected to contain: id, strategy_id, action, status, reason, created_at, mandate_id, summary
        const feed = document.getElementById('decision-feed');
        if (!feed) return;

        const item = document.createElement('div');
        item.className = 'decision-item';
        const ts = report.created_at ? new Date(report.created_at * 1000) : new Date();
        const timeLabel = ts.toLocaleTimeString();

        // Keep message compact and non-technical for novice users
        const action = report.action || report.decision || 'decision';
        const status = report.status || report.outcome || report.result || '';
        const strategy = report.strategy_id ? `Strategy ${report.strategy_id}` : '';
        const reason = report.reason || report.entry_reason || report.note || '';
        const mandate = report.mandate_id ? `Mandate ${report.mandate_id}` : '';

        item.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
                <div style="flex:1;">
                    <div style="font-weight:600">${action} ${status ? '— '+status : ''} ${strategy ? '<span style="color:var(--muted); font-weight:400;">'+strategy+'</span>' : ''}</div>
                    <div style="font-size:0.9rem;color:var(--muted);margin-top:0.25rem;">${reason || '—'}</div>
                    <div style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem;">${mandate}</div>
                </div>
                <div style="flex-shrink:0;color:var(--muted);font-size:0.85rem">${timeLabel}</div>
            </div>
        `;

        // insert at top
        if (feed.firstChild) {
            feed.insertBefore(item, feed.firstChild);
        } else {
            feed.appendChild(item);
        }

        // keep feed reasonably sized
        while (feed.children.length > 25) {
            feed.removeChild(feed.lastChild);
        }

        // subtle notification for important events
        if (status && (status.toLowerCase() === 'skip' || status.toLowerCase() === 'deny' || status.toLowerCase() === 'blocked')) {
            this.showNotification(`${action} ${status} — ${reason || ''}`, 'warning');
        } else {
            this.showNotification(`${action} ${status}`, 'info');
        }
    }

    // Update omega progress bar and mandate display
    updateOmegaUsage(data) {
        const percent = (data.omega_cap_usage_percent !== undefined) ? Number(data.omega_cap_usage_percent) : (data.omega_usage_percent !== undefined ? Number(data.omega_usage_percent) : null);
        const mandateId = data.mandate_id || data.mandate || null;

        const panel = document.getElementById('omega-usage-panel');
        const bar = document.getElementById('omega-progress-bar');
        const pct = document.getElementById('omega-usage-percent');
        const mandateEl = document.getElementById('mandate-id-display');

        if (!panel || !bar || !pct || !mandateEl) return;

        if (mandateId) {
            mandateEl.textContent = mandateId;
            panel.style.display = 'block';
        }

        if (percent !== null && !isNaN(percent)) {
            const clamped = Math.max(0, Math.min(100, percent));
            bar.style.width = `${clamped}%`;
            pct.textContent = `${clamped}%`;
            panel.style.display = 'block';
        }
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

            // Generate secure state for broker connection
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

            // Default Deriv OAuth app id used historically in the app
            const DEFAULT_DERIV_APP_ID = '85950';
            // If the site is hosted at wofk.beaverlyai.com, use the special app id
            const appId = (window && window.location && window.location.hostname === 'wofk.beaverlyai.com')
                ? '111279'
                : DEFAULT_DERIV_APP_ID;

            const redirectUri = encodeURIComponent(`${API_BASE}/api/connect_oauth/callback`);
            const derivOAuthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&redirect_uri=${redirectUri}&state=${state_token}`;

            // OAuth state now managed server-side via state tokens
            window.location.href = derivOAuthUrl;
        } catch (error) {
            console.error("OAuth error:", error);
            this.showNotification('Could not start broker connection — please try again', 'error');
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
                // OAuth data now managed server-side only

                this.updateConnectionStatus(false);
                this.closeDisconnectModal();
                this.showNotification(`Successfully disconnected from ${result.broker || 'broker'}`, 'success');
                this.loadDashboardData();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Could not disconnect — please try again', 'error');
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
            // Fallback: clear connection status locally

            this.updateConnectionStatus(false);
            this.closeDisconnectModal();
            this.showNotification('Disconnected (network issue)', 'warning');
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