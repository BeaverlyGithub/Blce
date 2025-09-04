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
        
        // Ensure dashboard is fully functional
        this.initializeDashboardFeatures();
    }

    initializeDashboardFeatures() {
        // Update activity status
        this.updateActivityStatus();
        
        // Load account data if connected
        if (this.currentUser?.broker_connected) {
            this.loadAccountData();
        }
    }

    updateActivityStatus() {
        const activityStatus = document.querySelector('.activity-status');
        const statusTitle = document.querySelector('.status-title');
        const statusInfo = document.querySelector('.status-info span');
        
        if (this.currentUser?.broker_connected) {
            if (activityStatus) {
                activityStatus.className = 'activity-status status-connected';
            }
            if (statusTitle) {
                statusTitle.textContent = 'Connected';
            }
            if (statusInfo) {
                statusInfo.textContent = 'Chilla is monitoring your account';
            }
        } else {
            if (activityStatus) {
                activityStatus.className = 'activity-status status-disconnected';
            }
            if (statusTitle) {
                statusTitle.textContent = 'Not Connected';
            }
            if (statusInfo) {
                statusInfo.textContent = 'Connect a broker to start monitoring';
            }
        }
    }

    async loadAccountData() {
        try {
            const response = await fetch('https://cook.beaverlyai.com/api/account_data', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateAccountBalance(data.balance || 0);
                this.updatePositions(data.positions || []);
            }
        } catch (error) {
            console.error('Failed to load account data:', error);
            // Show demo data for offline mode
            this.updateAccountBalance(0);
            this.updatePositions([]);
        }
    }

    updateAccountBalance(balance) {
        const balanceElement = document.getElementById('account-balance');
        if (balanceElement) {
            balanceElement.textContent = `$${balance.toFixed(2)}`;
        }
    }

    updatePositions(positions) {
        const positionsList = document.getElementById('positions-list');
        if (!positionsList) return;

        if (positions.length === 0) {
            positionsList.innerHTML = '<div class="position-item"><span>No open positions</span></div>';
        } else {
            positionsList.innerHTML = positions.map(position => `
                <div class="position-item">
                    <span class="position-symbol">${position.symbol}</span>
                    <span class="position-pnl ${position.pnl >= 0 ? 'profit' : 'loss'}">
                        ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}
                    </span>
                </div>
            `).join('');
        }
    }

    async validateSession() {
        try {
            // Hide loading screen and show main app immediately
            const loadingScreen = document.getElementById('loading-screen');
            const mainApp = document.getElementById('main-app');
            
            if (loadingScreen) loadingScreen.classList.add('hidden');
            if (mainApp) {
                mainApp.style.display = 'block';
                mainApp.classList.add('show');
            }

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
            console.log('Dashboard loaded successfully');

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
        this.showDashboardContent();
    }

    

    showDashboardContent() {
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            dashboard.style.display = 'block';
            dashboard.style.opacity = '1';
        }
        
        // Ensure main content is visible
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
    }

    updateUserInfo() {
        const userEmailElement = document.querySelector('.user-email');
        const userNameElement = document.querySelector('.user-name');
        const userDisplayEmail = document.getElementById('user-display-email');
        const userDisplayName = document.getElementById('user-display-name');

        if (userEmailElement) userEmailElement.textContent = this.currentUser?.email || 'N/A';
        if (userNameElement) userNameElement.textContent = this.currentUser?.full_name || 'User';
        if (userDisplayEmail) userDisplayEmail.textContent = this.currentUser?.email || 'N/A';
        if (userDisplayName) userDisplayName.textContent = this.currentUser?.full_name || 'User';
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
        // Wait for DOM to be fully ready
        setTimeout(() => {
            this.attachAllEventListeners();
        }, 100);
    }

    attachAllEventListeners() {
        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Menu toggle
        const menuBtn = document.getElementById('menu-btn');
        const sidebar = document.getElementById('sidebar');
        if (menuBtn && sidebar) {
            menuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
        }

        // Sidebar overlay close
        const sidebarOverlay = document.querySelector('.sidebar-overlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }

        // Connect Chilla button
        const connectBtn = document.getElementById('connect-chilla-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                this.showBrokerModal();
            });
        }

        // Nav connect button
        const navConnectBtn = document.getElementById('nav-connect-btn');
        if (navConnectBtn) {
            navConnectBtn.addEventListener('click', () => {
                this.showBrokerModal();
            });
        }

        // Broker modal controls
        this.setupBrokerModal();

        // Other menu items
        this.setupMenuItems();

        // Theme toggle
        this.setupThemeToggle();

        console.log('All event listeners attached');
    }

    setupBrokerModal() {
        const brokerModal = document.getElementById('broker-modal');
        const brokerDropdown = document.getElementById('broker-dropdown');
        const brokerOAuthBtn = document.getElementById('broker-oauth-btn');
        const modalCloseBtn = document.getElementById('modal-close-btn');

        if (brokerDropdown) {
            brokerDropdown.addEventListener('change', (e) => {
                if (brokerOAuthBtn) {
                    brokerOAuthBtn.disabled = !e.target.value;
                }
            });
        }

        if (brokerOAuthBtn) {
            brokerOAuthBtn.addEventListener('click', () => {
                const selectedBroker = brokerDropdown?.value;
                if (selectedBroker === 'deriv') {
                    this.initiateOAuthConnection('deriv');
                }
            });
        }

        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => {
                this.hideBrokerModal();
            });
        }
    }

    setupMenuItems() {
        // Change email
        const changeEmailBtn = document.getElementById('change-email-btn');
        if (changeEmailBtn) {
            changeEmailBtn.addEventListener('click', () => {
                window.location.href = 'change-email.html';
            });
        }

        // Change password
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                window.location.href = 'change-password.html';
            });
        }

        // Verify email
        const verifyEmailBtn = document.getElementById('verify-email-btn');
        if (verifyEmailBtn) {
            verifyEmailBtn.addEventListener('click', () => {
                this.resendVerificationEmail();
            });
        }

        // Contact
        const contactBtn = document.getElementById('contact-btn');
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                window.location.href = 'contact.html';
            });
        }

        // FAQ
        const faqBtn = document.getElementById('faq-btn');
        if (faqBtn) {
            faqBtn.addEventListener('click', () => {
                window.location.href = 'faq.html';
            });
        }

        // Privacy
        const privacyBtn = document.getElementById('privacy-btn');
        if (privacyBtn) {
            privacyBtn.addEventListener('click', () => {
                window.location.href = 'privacy.html';
            });
        }

        // Terms
        const termsBtn = document.getElementById('terms-btn');
        if (termsBtn) {
            termsBtn.addEventListener('click', () => {
                window.location.href = 'terms.html';
            });
        }
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
                localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
            });
        }

        // Load saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
    }

    showBrokerModal() {
        const brokerModal = document.getElementById('broker-modal');
        if (brokerModal) {
            brokerModal.classList.remove('hidden');
        }
    }

    hideBrokerModal() {
        const brokerModal = document.getElementById('broker-modal');
        if (brokerModal) {
            brokerModal.classList.add('hidden');
        }
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