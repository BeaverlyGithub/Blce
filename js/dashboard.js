// Secure Dashboard with Server-Side Validation
class ChillaDashboard {
    constructor() {
        this.currentUser = null;
        this.wsConnection = null;
        this.csrfToken = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.init();
    }

    async init() {
        await this.validateSession();
        await this.loadCSRFToken();
        this.setupEventListeners();
        this.initializeWebSocket();
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

            if (!response.ok) {
                this.redirectToLogin();
                return;
            }

            const data = await response.json();

            if (data.status !== 'valid') {
                this.redirectToLogin();
                return;
            }

            this.currentUser = data.users;
            this.updateUserInterface();

        } catch (error) {
            console.error('Session validation failed:', error);
            this.redirectToLogin();
        }
    }

    async loadCSRFToken() {
        try {
            const response = await fetch('https://cook.beaverlyai.com/api/csrf_token', {
                method: 'GET',
                credentials: 'include',
                headers: {
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

    redirectToLogin() {
        window.location.href = 'index.html';
    }

    updateUserInterface() {
        this.updateUserInfo();
        this.updateVerificationStatus();
        this.updateBrokerConnection();
        this.updatePlanStatus();
    }

    updateUserInfo() {
        const userEmailElement = document.querySelector('.user-email');
        const userNameElement = document.querySelector('.user-name');

        if (userEmailElement) userEmailElement.textContent = this.currentUser.email || 'N/A';
        if (userNameElement) userNameElement.textContent = this.currentUser.full_name || 'User';
    }

    updateVerificationStatus() {
        const verificationStatus = document.querySelector('.verification-status');
        if (!verificationStatus) return;

        // Server-controlled verification status - no client manipulation possible
        if (this.currentUser.email_verified) {
            verificationStatus.innerHTML = '<span class="status-dot verified"></span><span>Verified</span>';
            verificationStatus.className = 'verification-status verified';
        } else {
            verificationStatus.innerHTML = '<span class="status-dot unverified"></span><span>Unverified</span>';
            verificationStatus.className = 'verification-status unverified';
            this.showVerificationPrompt();
        }
    }

    updateBrokerConnection() {
        const connectionStatus = document.querySelector('.connection-status');
        if (!connectionStatus) return;

        // Server-controlled broker connection status
        if (this.currentUser.broker_connected) {
            connectionStatus.innerHTML = `<span class="status-dot connected"></span><span>Connected to ${this.currentUser.broker || 'Broker'}</span>`;
            connectionStatus.className = 'connection-status connected';
            this.showTradingInterface();
        } else {
            connectionStatus.innerHTML = '<span class="status-dot disconnected"></span><span>Not Connected</span>';
            connectionStatus.className = 'connection-status disconnected';
            this.showBrokerConnectionOptions();
        }
    }

    updatePlanStatus() {
        const planElement = document.querySelector('.plan-status');
        if (planElement) {
            planElement.textContent = this.currentUser.plan || "chilla's gift";
            planElement.className = `plan-status ${this.currentUser.plan?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'gift'}`;
        }
    }

    showVerificationPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'verification-prompt';
        prompt.innerHTML = `
            <div class="prompt-content">
                <p>Please verify your email address to access all features.</p>
                <button id="resend-verification" class="btn-primary">Resend Verification Email</button>
            </div>
        `;

        const existingPrompt = document.querySelector('.verification-prompt');
        if (existingPrompt) existingPrompt.remove();

        document.querySelector('.dashboard-content')?.prepend(prompt);

        document.getElementById('resend-verification')?.addEventListener('click', () => {
            this.resendVerificationEmail();
        });
    }

    async resendVerificationEmail() {
        try {
            const response = await fetch('https://cook.beaverlyai.com/api/send_verification_email', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': this.csrfToken || ''
                },
                body: JSON.stringify({ email: this.currentUser.email })
            });

            if (response.ok) {
                this.showNotification('Verification email sent!', 'success');
            } else {
                const data = await response.json();
                this.showNotification(data.detail || 'Failed to send email', 'error');
            }
        } catch (error) {
            console.error('Resend verification error:', error);
            this.showNotification('Network error', 'error');
        }
    }

    showBrokerConnectionOptions() {
        const connectSection = document.querySelector('.broker-connect');
        if (!connectSection) return;

        connectSection.innerHTML = `
            <h3>Connect Your Broker</h3>
            <p>Connect your trading account to start using Chilla's AI trading features.</p>
            <button id="connect-deriv" class="btn-primary">Connect Deriv Account</button>
        `;

        document.getElementById('connect-deriv')?.addEventListener('click', () => {
            this.initiateOAuthConnection('deriv');
        });
    }

    async initiateOAuthConnection(broker) {
        try {
            const response = await fetch('https://cook.beaverlyai.com/api/generate_oauth_state', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': this.csrfToken || ''
                }
            });

            if (response.ok) {
                const data = await response.json();
                const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?` +
                    `app_id=${process.env.DERIV_APP_ID}&` +
                    `l=EN&` +
                    `brand=deriv&` +
                    `state=${data.state_token}`;

                window.location.href = oauthUrl;
            } else {
                this.showNotification('Failed to initiate connection', 'error');
            }
        } catch (error) {
            console.error('OAuth initiation error:', error);
            this.showNotification('Connection error', 'error');
        }
    }

    showTradingInterface() {
        const tradingSection = document.querySelector('.trading-interface');
        if (!tradingSection) return;

        tradingSection.innerHTML = `
            <h3>Trading Dashboard</h3>
            <div class="account-info">
                <p>Account: ${this.currentUser.account_id || 'N/A'}</p>
                <p>Broker: ${this.currentUser.broker || 'N/A'}</p>
            </div>
            <div class="trading-controls">
                <button id="start-trading" class="btn-success">Start AI Trading</button>
                <button id="stop-trading" class="btn-danger">Stop Trading</button>
                <button id="disconnect-broker" class="btn-secondary">Disconnect Broker</button>
            </div>
            <div class="trading-status">
                <p>Trading Status: <span id="trading-status">Stopped</span></p>
            </div>
        `;

        this.setupTradingControls();
    }

    setupTradingControls() {
        document.getElementById('disconnect-broker')?.addEventListener('click', () => {
            this.disconnectBroker();
        });

        document.getElementById('start-trading')?.addEventListener('click', () => {
            this.startTrading();
        });

        document.getElementById('stop-trading')?.addEventListener('click', () => {
            this.stopTrading();
        });
    }

    async disconnectBroker() {
        try {
            const response = await fetch('https://cook.beaverlyai.com/api/disconnect_oauth', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': this.csrfToken || ''
                }
            });

            if (response.ok) {
                this.showNotification('Broker disconnected successfully', 'success');
                // Refresh user data
                await this.validateSession();
            } else {
                const data = await response.json();
                this.showNotification(data.detail || 'Failed to disconnect', 'error');
            }
        } catch (error) {
            console.error('Disconnect error:', error);
            this.showNotification('Network error', 'error');
        }
    }

    async startTrading() {
        // Trading controls would be implemented with proper server validation
        this.showNotification('Trading functionality requires server implementation', 'info');
    }

    async stopTrading() {
        // Trading controls would be implemented with proper server validation
        this.showNotification('Trading functionality requires server implementation', 'info');
    }

    async initializeWebSocket() {
        if (!this.currentUser?.email_verified) {
            return; // No WebSocket for unverified users
        }

        try {
            const wsTokenResponse = await fetch('https://cook.beaverlyai.com/api/ws_token', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': this.csrfToken || ''
                }
            });

            if (wsTokenResponse.ok) {
                const tokenData = await wsTokenResponse.json();
                this.connectWebSocket(tokenData.ws_token);
            }
        } catch (error) {
            console.error('WebSocket token error:', error);
        }
    }

    connectWebSocket(wsToken) {
        const wsUrl = `wss://cook.beaverlyai.com/ws?token=${wsToken}`;

        this.wsConnection = new WebSocket(wsUrl);

        this.wsConnection.onopen = () => {
            console.log('WebSocket connected securely');
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

        this.wsConnection.onclose = () => {
            console.log('WebSocket disconnected');
            this.attemptReconnect();
        };

        this.wsConnection.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleWebSocketMessage(data) {
        // Handle real-time updates from server
        switch (data.type) {
            case 'trading_status':
                this.updateTradingStatus(data.status);
                break;
            case 'balance_update':
                this.updateBalance(data.balance);
                break;
            case 'notification':
                this.showNotification(data.message, data.level);
                break;
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                this.initializeWebSocket();
            }, Math.pow(2, this.reconnectAttempts) * 1000);
        }
    }

    setupEventListeners() {
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });

        // Settings navigation
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            window.location.href = 'settings.html';
        });
    }

    async logout() {
        try {
            await fetch('https://cook.beaverlyai.com/api/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': this.csrfToken || ''
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            window.location.href = 'index.html';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize dashboard when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new ChillaDashboard();
});