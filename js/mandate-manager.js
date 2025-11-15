/**
 * Mandate Management Dashboard Component
 * 
 * Features:
 * - View active mandate details
 * - Modify mandate (creates new version)
 * - Revoke mandate (stops immediately)
 * - Risk usage tracking
 * - Multi-account assignment
 */

class MandateManager {
    constructor(containerId = 'mandate-manager') {
        this.container = document.getElementById(containerId);
        this.activeMandate = null;
        this.riskUsage = null;
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadActiveMandate();
            await this.loadRiskUsage();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to initialize mandate manager:', error);
            this.showError('Could not load your instructions. Please try again later.');
        }
    }
    
    async loadActiveMandate() {
        try {
            this.activeMandate = await window.chillaAPI.getCurrentMandate();
        } catch (error) {
            console.error('No active mandate:', error);
            this.activeMandate = null;
        }
    }
    
    async loadRiskUsage() {
        if (!this.activeMandate) return;
        
        try {
            this.riskUsage = await window.chillaAPI.getRiskUsage();
        } catch (error) {
            console.warn('Could not load risk usage:', error);
            this.riskUsage = null;
        }
    }
    
    render() {
        if (!this.container) return;
        
        if (!this.activeMandate) {
            this.renderNoMandate();
            return;
        }
        
        this.container.innerHTML = `
            <div class="mandate-dashboard">
                <!-- Header -->
                <div class="dashboard-header">
                    <div class="header-content">
                        <h1>Your Active Instructions</h1>
                        <p>Version ${this.activeMandate.version} • Activated ${this.formatDate(this.activeMandate.issued_at)}</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn-secondary" data-action="modify">
                            <i data-lucide="edit-3"></i>
                            Modify
                        </button>
                        <button class="btn-danger" data-action="revoke">
                            <i data-lucide="x-circle"></i>
                            Cancel
                        </button>
                    </div>
                </div>
                
                <!-- Risk Usage Card -->
                ${this.renderRiskUsage()}
                
                <!-- Mandate Details Grid -->
                <div class="mandate-grid">
                    ${this.renderStrategiesCard()}
                    ${this.renderMarketsCard()}
                    ${this.renderRiskSettingsCard()}
                    ${this.renderAccountsCard()}
                </div>
                
                <!-- Activity Timeline -->
                ${this.renderActivityTimeline()}
            </div>
        `;
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    renderNoMandate() {
        this.container.innerHTML = `
            <div class="no-mandate">
                <i data-lucide="alert-circle"></i>
                <h2>No Active Instructions</h2>
                <p>You don't have an active instruction.</p>
                <button class="btn-primary" data-action="create">
                    Create
                </button>
            </div>
        `;
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    renderRiskUsage() {
        if (!this.riskUsage) {
            return `
                <div class="risk-usage-card loading">
                    <div class="loading-spinner"></div>
                    <p>Loading risk usage...</p>
                </div>
            `;
        }
        
        const usedPercent = this.riskUsage.used_percent || 0;
        const remaining = this.riskUsage.remaining_bps || 0;
        const cap = this.riskUsage.cap_bps || 500;
        
        const statusClass = usedPercent >= 90 ? 'critical' : 
                           usedPercent >= 70 ? 'warning' : 'healthy';
        
        return `
            <div class="risk-usage-card ${statusClass}">
                <div class="usage-header">
                    <h3>
                        <i data-lucide="activity"></i>
                        Monthly Risk Budget
                    </h3>
                    <span class="usage-badge">${this.getRiskStatusLabel(usedPercent)}</span>
                </div>
                
                <div class="usage-chart">
                    <div class="progress-ring">
                        <svg width="120" height="120">
                            <circle 
                                cx="60" 
                                cy="60" 
                                r="54" 
                                fill="none" 
                                stroke="rgba(0,0,0,0.1)" 
                                stroke-width="8"
                            />
                            <circle 
                                cx="60" 
                                cy="60" 
                                r="54" 
                                fill="none" 
                                stroke="currentColor" 
                                stroke-width="8"
                                stroke-dasharray="${(usedPercent / 100) * 339.292} 339.292"
                                stroke-linecap="round"
                                transform="rotate(-90 60 60)"
                                class="progress-circle"
                            />
                        </svg>
                        <div class="progress-label">
                            <span class="progress-percent">${usedPercent.toFixed(1)}%</span>
                            <span class="progress-text">Used</span>
                        </div>
                    </div>
                    
                    <div class="usage-details">
                        <div class="usage-stat">
                            <span class="stat-label">Remaining Budget</span>
                            <span class="stat-value">${(remaining / 100).toFixed(2)}%</span>
                        </div>
                        <div class="usage-stat">
                            <span class="stat-label">Monthly Cap</span>
                            <span class="stat-value">${(cap / 100).toFixed(1)}%</span>
                        </div>
                        <div class="usage-stat">
                            <span class="stat-label">Signals This Month</span>
                            <span class="stat-value">${this.riskUsage.trade_count || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getRiskStatusLabel(percent) {
        if (percent >= 90) return 'Critical';
        if (percent >= 70) return 'High Usage';
        if (percent >= 40) return 'Moderate';
        return 'Healthy';
    }
    
    renderStrategiesCard() {
        const portfolio = this.activeMandate.portfolio || [];
        
        return `
            <div class="mandate-card">
                <div class="card-header">
                    <h3><i data-lucide="zap"></i> Active Strategies</h3>
                    <span class="card-badge">${portfolio.length}</span>
                </div>
                <div class="card-content">
                    ${portfolio.map(item => `
                        <div class="strategy-item">
                            <div class="strategy-info">
                                <span class="strategy-name">${this.getStrategyName(item.strategy_id)}</span>
                                <span class="strategy-markets">${item.symbols.length} markets</span>
                            </div>
                            ${item.adaptive_risk ? '<span class="badge adaptive">Adaptive Risk</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderMarketsCard() {
        const allMarkets = [];
        (this.activeMandate.portfolio || []).forEach(item => {
            allMarkets.push(...item.symbols);
        });
        const uniqueMarkets = [...new Set(allMarkets)];
        
        return `
            <div class="mandate-card">
                <div class="card-header">
                    <h3><i data-lucide="globe"></i> Markets</h3>
                    <span class="card-badge">${uniqueMarkets.length}</span>
                </div>
                <div class="card-content">
                    <div class="markets-list">
                        ${uniqueMarkets.map(symbol => `
                            <span class="market-chip">${symbol}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderRiskSettingsCard() {
        const risk = this.activeMandate.risk || {};
        const omegaCap = risk.omega_risk_cap_bps || 500;
        
        return `
            <div class="mandate-card">
                <div class="card-header">
                    <h3><i data-lucide="shield"></i> Risk Settings</h3>
                </div>
                <div class="card-content">
                    <div class="risk-settings-list">
                        ${Object.entries(risk.per_strategy || {}).map(([strategyId, settings]) => `
                            <div class="risk-setting-item">
                                <span class="setting-label">${this.getStrategyName(strategyId)}</span>
                                <span class="setting-value">${(settings.risk_per_trade_bps / 100).toFixed(2)}% per signal</span>
                            </div>
                        `).join('')}
                        
                        <div class="risk-setting-item omega">
                            <span class="setting-label">
                                <i data-lucide="target"></i>
                                Omega Risk Cap
                            </span>
                            <span class="setting-value">${(omegaCap / 100).toFixed(1)}% monthly</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderAccountsCard() {
        const accounts = [];
        (this.activeMandate.portfolio || []).forEach(item => {
            if (item.broker_account_ref) {
                accounts.push(item.broker_account_ref);
            }
        });
        
        return `
            <div class="mandate-card">
                <div class="card-header">
                    <h3><i data-lucide="credit-card"></i> Broker Accounts</h3>
                    <span class="card-badge">${accounts.length}</span>
                </div>
                <div class="card-content">
                    ${accounts.length > 0 ? accounts.map(account => `
                        <div class="account-item">
                            <div class="account-icon">${this.getBrokerIcon(account.broker)}</div>
                            <div class="account-info">
                                <span class="account-broker">${this.formatBrokerName(account.broker)}</span>
                                <span class="account-id">${account.account_id}</span>
                            </div>
                        </div>
                    `).join('') : '<p class="empty-state">No accounts assigned</p>'}
                </div>
            </div>
        `;
    }
    
    renderActivityTimeline() {
        return `
            <div class="activity-timeline">
                <h3><i data-lucide="clock"></i> Recent Activity</h3>
                <div class="timeline-list">
                    <div class="timeline-item">
                        <div class="timeline-icon issued">
                            <i data-lucide="check-circle"></i>
                        </div>
                        <div class="timeline-content">
                            <span class="timeline-action">Mandate Issued</span>
                            <span class="timeline-date">${this.formatDate(this.activeMandate.issued_at)}</span>
                        </div>
                    </div>
                    
                    ${this.activeMandate.modified_at ? `
                        <div class="timeline-item">
                            <div class="timeline-icon modified">
                                <i data-lucide="edit-3"></i>
                            </div>
                            <div class="timeline-content">
                                <span class="timeline-action">Last Modified</span>
                                <span class="timeline-date">${this.formatDate(this.activeMandate.modified_at)}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        this.container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            
            if (action === 'modify') {
                this.handleModify();
            } else if (action === 'create') {
                // Navigate to the wizard to create a new mandate
                window.location.href = 'mandate-wizard.html';
            } else if (action === 'reload') {
                window.location.reload();
            } else if (action === 'revoke') {
                this.handleRevoke();
            }
        });
    }
    
    async handleModify() {
        const confirmed = confirm(
            'Modifying your instructions will create a new version. ' +
            'Current settings will be pre-filled so you can make changes. Continue?'
        );
        
        if (!confirmed) return;
        
        // Redirect to wizard with pre-filled data
        sessionStorage.setItem('mandate_modify', JSON.stringify(this.activeMandate));
        window.location.href = 'mandate-wizard.html?modify=true';
    }
    
    async handleRevoke() {
        const confirmed = confirm(
            '⚠️ WARNING: Canceling your instructions will IMMEDIATELY stop all automated instructions. ' +
            'This action cannot be undone. Are you sure?'
        );
        
        if (!confirmed) return;
        
        const doubleConfirm = prompt(
            'Type "CANCEL" in all caps to confirm:'
        );
        
        if (doubleConfirm !== 'CANCEL') {
            alert('Cancelled.');
            return;
        }
        
        try {
            await window.chillaAPI.revokeMandate(this.activeMandate.mandate_id);
            alert('Instructions cancelled successfully. Automated instructions have stopped.');
            window.location.reload();
        } catch (error) {
            console.error('Failed to revoke mandate:', error);
            alert('Failed to cancel instructions. Please try again or contact support.');
        }
    }
    
    // Helper methods
    getStrategyName(strategyId) {
        // TODO: Fetch from strategies catalog
        return strategyId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    
    formatBrokerName(broker) {
        const names = {
            'deriv': 'Deriv',
            'ib': 'Interactive Brokers',
            'alpaca': 'Alpaca'
        };
        return names[broker] || broker;
    }
    
    getBrokerIcon(broker) {
        return '<i data-lucide="building-2"></i>';
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }
    
    showError(message) {
        this.container.innerHTML = `
            <div class="error-state">
                <i data-lucide="alert-triangle"></i>
                <h2>Error</h2>
                <p>${message}</p>
                <button class="btn-primary" data-action="reload">
                    Retry
                </button>
            </div>
        `;
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MandateManager;
}
