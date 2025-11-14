// Mandate Settings Page
class MandateSettings {
    constructor() {
        this.currentMandate = null;
        this.init();
    }

    async init() {
        await window.chillaAPI.loadCSRFToken();
        await this.loadMandate();
    }

    async loadMandate() {
        try {
            const mandate = await window.chillaAPI.getCurrentMandate();
            
            if (mandate && mandate.status === 'active') {
                this.currentMandate = mandate;
                this.displayMandate(mandate);
            } else {
                this.showNoMandate();
            }
        } catch (error) {
            console.error('Failed to load instructions:', error);
            this.showNoMandate();
        }
    }

    displayMandate(mandate) {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('mandate-content').style.display = 'block';

        document.getElementById('detail-mandate-id').textContent = 
            mandate.id || mandate.mandate_id || '—';
        
        document.getElementById('detail-strategy').textContent = 
            mandate.strategy_id || '—';
        
        const riskCap = mandate.omega_max_bps 
            ? `${(mandate.omega_max_bps / 100).toFixed(1)}% (${mandate.omega_max_bps} bps)` 
            : '—';
        document.getElementById('detail-risk-cap').textContent = riskCap;

        document.getElementById('detail-status').textContent = 
            mandate.status || '—';

        const issued = mandate.issued_at || mandate.created_at;
        document.getElementById('detail-issued').textContent = issued 
            ? new Date(issued * 1000).toLocaleDateString()
            : '—';

        this.setupActionButtons(mandate.id || mandate.mandate_id);
        
        // Show per-trade risk if available
        try {
            const per = (mandate.risk && mandate.risk.per_strategy) ? (Object.values(mandate.risk.per_strategy)[0] || {}) : {};
            const per_bps = per.risk_per_trade_bps || per.risk_per_trade || null;
            document.getElementById('detail-per-trade').textContent = per_bps ? `${per_bps} bps` : '—';
        } catch (e) {
            document.getElementById('detail-per-trade').textContent = '—';
        }
    }

    showNoMandate() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('no-mandate-state').style.display = 'block';
    }

    setupActionButtons(mandateId) {
        document.getElementById('edit-mandate-btn').onclick = () => this.handleEdit(mandateId);
        document.getElementById('pause-mandate-btn').onclick = () => this.handlePause(mandateId);
        document.getElementById('revoke-mandate-btn').onclick = () => this.handleRevoke(mandateId);
    }

    handleEdit(mandateId) {
        window.location.href = 'mandate-wizard.html';
    }

    async handlePause(mandateId) {
        if (!confirm('Pause execution? Chilla will stop monitoring markets until you reactivate.')) {
            return;
        }

        try {
            await window.chillaAPI.updateMandate({
                mandate_id: mandateId,
                status: 'paused'
            });

            alert('Instructions paused — you can reactivate them anytime.');
            window.location.reload();
        } catch (error) {
            console.error('Failed to pause:', error);
            alert('Could not pause your instructions. Please try again.');
        }
    }

    async handleRevoke(mandateId) {
        if (!confirm('Revoke instructions? This will stop execution under these instructions. You can create new instructions later.')) {
            return;
        }

        try {
            await window.chillaAPI.revokeMandate({ mandate_id: mandateId });

            alert('Instructions revoked — you can create new instructions anytime.');
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error('Failed to revoke:', error);
            alert('Could not revoke your instructions. Please try again.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MandateSettings();
    
    // Initialize Broker Account Manager
    if (typeof BrokerAccountManager !== 'undefined') {
        const brokerManager = new BrokerAccountManager('broker-manager');
        console.log('✅ Broker Account Manager initialized');
    }
});
