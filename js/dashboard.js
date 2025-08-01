const API_BASE = 'https://cook.beaverlyai.com';

class ChillaDashboard {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentTheme = 'light';
        this.isConnected = false;

        this.init();
    }

    async init() {
        this.setupTheme();
        this.setupEventListeners();
        
        // Small delay to ensure DOM is ready
        setTimeout(async () => {
            await this.checkAuthentication();
        }, 100);
    }

    async checkAuthentication() {
        // TEMPORARILY DISABLED AUTH CHECKS - Direct to dashboard
        console.log('Dashboard loading in test mode...');
        
        // Mock authentication success
        this.isAuthenticated = true;
        this.currentUser = {
            email: localStorage.getItem('chilla_user_email') || 'test@example.com',
            email_verified: false
        };
        
        // Show main app immediately
        this.showMainApp();
        this.loadDashboardData();
        
        // Set up periodic data refresh
        setInterval(() => this.loadDashboardData(), 30000);
    }

    setupEventListeners() {
        // Main app listeners
        document.getElementById('menu-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('nav-connect-btn').addEventListener('click', () => this.handleConnectChilla());
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Sidebar listeners
        document.getElementById('connect-chilla-btn').addEventListener('click', () => this.handleConnectChilla());
        document.getElementById('upgrade-btn').addEventListener('click', () => this.showUpgrade());
        document.getElementById('change-email-btn').addEventListener('click', () => this.changeEmail());
        document.getElementById('change-password-btn').addEventListener('click', () => this.changePassword());
        document.getElementById('verify-email-btn').addEventListener('click', () => this.verifyEmail());
        document.getElementById('contact-btn').addEventListener('click', () => this.showContact());
        document.getElementById('faq-btn').addEventListener('click', () => this.showFAQ());

        // Bottom nav listeners
        document.getElementById('home-nav').addEventListener('click', () => this.showHome());
        document.getElementById('menu-nav').addEventListener('click', () => this.showLose());

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
            if (this.currentUser.email_verified) {
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
        try {
            const response = await fetch(`${API_BASE}/api/customer_balance`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('account-balance').textContent = this.formatCurrency(data.balance || 0);
                document.getElementById('total-earnings').textContent = this.formatCurrency(data.earnings || 0);
            } else {
                throw new Error('Failed to load balance');
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            // Show fallback data
            document.getElementById('account-balance').textContent = '$0.00';
            document.getElementById('total-earnings').textContent = '$0.00';
        }
    }

    async loadPositions() {
        try {
            const response = await fetch(`${API_BASE}/api/active_positions`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.displayPositions(data.positions || []);
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
                <span class="position-symbol">${position.symbol}</span>
                <span class="connection-status ${position.connected ? 'connected' : 'disconnected'}"></span>
            </div>
        `).join('');
    }

    async checkConnectionStatus() {
        try {
            const response = await fetch(`${API_BASE}/api/connection_status`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.updateConnectionStatus(data.connected);
            } else {
                this.updateConnectionStatus(false);
            }
        } catch (error) {
            console.error('Error checking connection status:', error);
            this.updateConnectionStatus(false);
        }
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
            navConnectBtn.classList.remove('connected');
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

        try {
            const response = await fetch(`${API_BASE}/api/connect_oauth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ broker: selectedBroker })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.oauth_url) {
                    window.open(data.oauth_url, '_blank');
                    this.closeBrokerModal();
                    this.showNotification('OAuth window opened. Complete the process to connect.', 'success');
                }
            } else {
                const errorData = await response.json();
                this.showNotification(errorData.error || 'Failed to connect to broker', 'error');
            }
        } catch (error) {
            console.error('Connection error:', error);
            this.showNotification('Connection error', 'error');
        }
    }

    async confirmDisconnect() {
        try {
            const response = await fetch(`${API_BASE}/api/disconnect_oauth`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                this.updateConnectionStatus(false);
                this.closeDisconnectModal();
                this.showNotification('Chilla disconnected successfully', 'success');
            } else {
                const errorData = await response.json();
                this.showNotification(errorData.error || 'Failed to disconnect', 'error');
            }
        } catch (error) {
            console.error('Disconnection error:', error);
            this.showNotification('Disconnection error', 'error');
        }
    }

    showUpgrade() {
        window.location.href = 'upgrade.html';
        this.closeSidebar();
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
                this.showNotification('Verification email sent! Check your inbox.', 'success');
            } else {
                this.showNotification(result.error || 'Failed to send verification email', 'error');
            }
        } catch (error) {
            console.error('Verification error:', error);
            this.showNotification('Network error', 'error');
        }
        this.closeSidebar();
    }

    showContact() {
        window.location.href = 'contact.html';
        this.closeSidebar();
    }

    showFAQ() {
        window.location.href = 'faq.html';
        this.closeSidebar();
    }

    showHome() {
        // Switch to home tab
        document.getElementById('home-nav').classList.add('active');
        document.getElementById('menu-nav').classList.remove('active');
    }

    showLose() {
        // Switch to lose tab (future feature)
        document.getElementById('home-nav').classList.remove('active');
        document.getElementById('menu-nav').classList.add('active');
        this.showNotification('Lose tab coming soon!', 'info');
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
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChillaDashboard();
});

