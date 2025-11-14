/**
 * Multi-Account Broker Management
 * 
 * Features:
 * - View all connected broker accounts
 * - Add new broker connections (OAuth)
 * - Assign strategies to specific accounts
 * - Remove/disconnect accounts
 * - Real-time connection status
 */

class BrokerAccountManager {
    constructor(containerId = 'broker-manager') {
        this.container = document.getElementById(containerId);
        this.accounts = [];
        this.strategies = [];
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadAccounts();
            await this.loadStrategies();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to initialize broker manager:', error);
            this.showError('Could not load broker accounts');
        }
    }
    
    async loadAccounts() {
        try {
            const data = await window.chillaAPI.getBrokerAccounts();
            this.accounts = data.accounts || [];
        } catch (error) {
            console.warn('No broker accounts found:', error);
            this.accounts = [];
        }
    }
    
    async loadStrategies() {
        try {
            const data = await window.chillaAPI.getStrategies();
            this.strategies = data.strategies || data;
        } catch (error) {
            console.warn('Could not load strategies:', error);
            this.strategies = [];
        }
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="broker-manager">
                <!-- Header -->
                <div class="manager-header">
                    <div class="header-content">
                        <h1>Broker Accounts</h1>
                        <p>Manage your connected accounts and strategy assignments</p>
                    </div>
                    <button class="btn-primary" data-action="add-broker">
                        <i data-lucide="plus-circle"></i>
                        Connect New Broker
                    </button>
                </div>
                
                <!-- Accounts Grid -->
                <div class="accounts-grid">
                    ${this.renderAccounts()}
                </div>
                
                ${this.accounts.length === 0 ? this.renderEmptyState() : ''}
            </div>
        `;
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    renderAccounts() {
        if (this.accounts.length === 0) return '';
        
        return this.accounts.map(account => this.renderAccountCard(account)).join('');
    }
    
    renderAccountCard(account) {
        const isConnected = account.status === 'connected';
        const assignedStrategies = this.getAssignedStrategies(account);
        
        return `
            <div class="account-card ${isConnected ? 'connected' : 'disconnected'}" data-account-id="${account.id}">
                <div class="account-header">
                    <div class="account-main-info">
                        <div class="broker-logo">
                            ${this.getBrokerLogo(account.broker)}
                        </div>
                        <div class="account-details">
                            <h3 class="account-name">${this.formatBrokerName(account.broker)}</h3>
                            <span class="account-id">${account.account_id}</span>
                        </div>
                    </div>
                    <div class="account-status">
                        <span class="status-badge ${isConnected ? 'connected' : 'disconnected'}">
                            <i data-lucide="${isConnected ? 'check-circle' : 'x-circle'}"></i>
                            ${isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>
                
                <div class="account-stats">
                    <div class="stat">
                        <span class="stat-label">Balance</span>
                        <span class="stat-value">${this.formatCurrency(account.balance || 0)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Active Strategies</span>
                        <span class="stat-value">${assignedStrategies.length}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Markets</span>
                        <span class="stat-value">${account.symbols?.length || 0}</span>
                    </div>
                </div>
                
                <div class="account-strategies">
                    <h4>Assigned Strategies</h4>
                    ${assignedStrategies.length > 0 ? `
                        <div class="strategy-chips">
                            ${assignedStrategies.map(s => `
                                <span class="strategy-chip">${s.name}</span>
                            `).join('')}
                        </div>
                    ` : `
                        <p class="empty-strategies">No strategies assigned</p>
                    `}
                </div>
                
                <div class="account-actions">
                    <button class="btn-secondary" data-action="manage-strategies" data-account-id="${account.id}">
                        <i data-lucide="settings"></i>
                        Manage Strategies
                    </button>
                    <button class="btn-text" data-action="disconnect" data-account-id="${account.id}">
                        <i data-lucide="unlink"></i>
                        Disconnect
                    </button>
                </div>
            </div>
        `;
    }
    
    renderEmptyState() {
        return `
            <div class="empty-accounts">
                <i data-lucide="wallet"></i>
                <h2>No Broker Accounts Connected</h2>
                <p>Connect your first broker account to execute your instructions with Chilla.</p>
                <button class="btn-primary" data-action="add-broker">
                    <i data-lucide="plus-circle"></i>
                    Connect Broker Account
                </button>
            </div>
        `;
    }
    
    getBrokerLogo(broker) {
        const logos = {
            'deriv': '<i data-lucide="trending-up"></i>',
            'ib': '<i data-lucide="bar-chart-2"></i>',
            'alpaca': '<i data-lucide="mountain"></i>'
        };
        return logos[broker] || '<i data-lucide="building-2"></i>';
    }
    
    formatBrokerName(broker) {
        const names = {
            'deriv': 'Deriv',
            'ib': 'Interactive Brokers',
            'alpaca': 'Alpaca'
        };
        return names[broker] || broker.charAt(0).toUpperCase() + broker.slice(1);
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    }
    
    getAssignedStrategies(account) {
        // Get strategies assigned to this account from active mandate
        // This would come from the mandate portfolio mapping
        return account.assigned_strategies || [];
    }
    
    setupEventListeners() {
        this.container.addEventListener('click', async (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const accountId = e.target.closest('[data-account-id]')?.dataset.accountId;
            
            if (action === 'add-broker') {
                this.handleAddBroker();
            } else if (action === 'manage-strategies' && accountId) {
                this.handleManageStrategies(accountId);
            } else if (action === 'disconnect' && accountId) {
                await this.handleDisconnect(accountId);
            }
        });
    }
    
    handleAddBroker() {
        // Show broker selection modal
        this.showBrokerSelectionModal();
    }
    
    showBrokerSelectionModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay" data-action="close-modal"></div>
            <div class="modal-content broker-selection-modal">
                <div class="modal-header">
                    <h2>Connect a Broker</h2>
                    <button class="modal-close" data-action="close-modal">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Select a broker to connect your account:</p>
                    <div class="broker-options">
                        ${this.renderBrokerOptions()}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        // Add event listeners
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="close-modal"]')) {
                modal.remove();
            }
            
            const brokerBtn = e.target.closest('[data-broker]');
            if (brokerBtn) {
                const broker = brokerBtn.dataset.broker;
                this.initiateOAuth(broker);
                modal.remove();
            }
        });
    }
    
    renderBrokerOptions() {
        const brokers = [
            { id: 'deriv', name: 'Deriv'},
            { id: 'ib', name: 'Interactive Brokers'},
            { id: 'alpaca', name: 'Alpaca'}
        ];
        
        return brokers.map(broker => `
            <button class="broker-option" data-broker="${broker.id}">
                <div class="broker-icon">${this.getBrokerLogo(broker.id)}</div>
                <div class="broker-info">
                    <h3>${broker.name}</h3>
                </div>
                <i data-lucide="chevron-right"></i>
            </button>
        `).join('');
    }
    
    async initiateOAuth(broker) {
        try {
            // Get OAuth URL from backend
            const data = await window.chillaAPI.initiateOAuth(broker);
            
            if (data.authorization_url) {
                // Redirect to broker OAuth page
                window.location.href = data.authorization_url;
            } else {
                throw new Error('No authorization URL received');
            }
        } catch (error) {
            console.error('Failed to initiate connection:', error);
            alert('Failed to connect to broker. Please try again.');
        }
    }
    
    handleManageStrategies(accountId) {
        // Show strategy assignment modal
        this.showStrategyAssignmentModal(accountId);
    }
    
    showStrategyAssignmentModal(accountId) {
        const account = this.accounts.find(a => a.id === accountId);
        if (!account) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay" data-action="close-modal"></div>
            <div class="modal-content strategy-assignment-modal">
                <div class="modal-header">
                    <h2>Manage Strategies</h2>
                    <p>${this.formatBrokerName(account.broker)} • ${account.account_id}</p>
                    <button class="modal-close" data-action="close-modal">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p>This will modify your active instructions. Select strategies to run on this account:</p>
                    <div class="strategy-selection-list">
                        ${this.renderStrategySelection(account)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" data-action="close-modal">Cancel</button>
                    <button class="btn-primary" data-action="save-assignments" data-account-id="${accountId}">
                        Save Changes
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        // Add event listeners
        modal.addEventListener('click', async (e) => {
            if (e.target.closest('[data-action="close-modal"]')) {
                modal.remove();
            }
            
            if (e.target.closest('[data-action="save-assignments"]')) {
                await this.saveStrategyAssignments(accountId, modal);
            }
        });
    }
    
    renderStrategySelection(account) {
        const assignedIds = (account.assigned_strategies || []).map(s => s.id);
        
        return this.strategies.map(strategy => `
            <label class="strategy-selection-item">
                <input 
                    type="checkbox" 
                    value="${strategy.id || strategy.strategy_id}"
                    ${assignedIds.includes(strategy.id || strategy.strategy_id) ? 'checked' : ''}
                />
                <div class="strategy-item-info">
                    <span class="strategy-name">${strategy.name || strategy.display_name}</span>
                    <span class="strategy-description">${strategy.description || ''}</span>
                </div>
            </label>
        `).join('');
    }
    
    async saveStrategyAssignments(accountId, modal) {
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
        const selectedStrategyIds = Array.from(checkboxes).map(cb => cb.value);
        
        const account = this.accounts.find(a => a.id === accountId);
        if (!account) {
            alert('Account not found.');
            return;
        }
        
        try {
            // Format as "broker:account_id" for multi-broker support
            const formattedAccountId = `${account.broker}:${account.account_id}`;
            
            // This triggers a mandate modification (new version created)
            await window.chillaAPI.updateAccountStrategies(formattedAccountId, selectedStrategyIds);
            
            alert('✓ Strategy assignments updated successfully.\n\nYour instructions have been modified.');
            modal.remove();
            await this.loadAccounts();
            this.render();
        } catch (error) {
            console.error('Failed to update assignments:', error);
            alert('Failed to update strategy assignments. Please try again.');
        }
    }
    
    async handleDisconnect(accountId) {
        const account = this.accounts.find(a => a.id === accountId);
        if (!account) return;
        
        const confirmed = confirm(
            `⚠️ Disconnect ${this.formatBrokerName(account.broker)} account ${account.account_id}?\n\n` +
            'This will stop all Chilla activities on this account immediately.\n\n' +
            'If this is your only account, your active instructions will be canceled.\n\n' +
            'You can reconnect anytime.'
        );
        
        if (!confirmed) return;
        
        try {
            // Format as "broker:account_id" for multi-broker support
            const formattedAccountId = `${account.broker}:${account.account_id}`;
            
            const response = await window.chillaAPI.disconnectBrokerAccount(formattedAccountId);
            
            if (response.remaining_accounts === 0) {
                alert('✓ Account disconnected.\n\nThis was your last account, so your instructions have been canceled.');
            } else {
                alert('✓ Account disconnected successfully.');
            }
            
            await this.loadAccounts();
            this.render();
        } catch (error) {
            console.error('Failed to disconnect account:', error);
            alert('Failed to disconnect account. Please try again or contact support.');
        }
    }
    
    showError(message) {
        this.container.innerHTML = `
            <div class="error-state">
                <i data-lucide="alert-triangle"></i>
                <h2>Error</h2>
                <p>${message}</p>
                <button class="btn-primary" onclick="window.location.reload()">
                    Retry
                </button>
            </div>
        `;
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrokerAccountManager;
}
