// Backend API Client for Mandate System
// Provides clean wrapper for all backend endpoints with authentication handling

(function() {
    // Use APP_CONFIG for environment-aware API base URL
    const getApiBase = () => {
        if (window.APP_CONFIG && typeof window.APP_CONFIG.apiUrl === 'function') {
            return window.APP_CONFIG.apiUrl('');
        }
        return window.APP_CONFIG?.API_BASE || 'https://cook.beaverlyai.com';
    };

    const getWsUrl = (path) => {
        if (window.APP_CONFIG && typeof window.APP_CONFIG.wsUrl === 'function') {
            return window.APP_CONFIG.wsUrl(path);
        }
        const base = getApiBase();
        const proto = base.startsWith('https://') ? 'wss://' : 'ws://';
        const host = base.replace(/^https?:\/\//, '');
        return proto + host + (path.startsWith('/') ? path : '/' + path);
    };

    class BackendAPI {
        constructor() {
            this.csrfToken = null;
        }

        /**
         * Load security verification from backend
         */
        async loadCSRFToken() {
            try {
                const response = await fetch(`${getApiBase()}/api/csrf_token`, {
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
                    return this.csrfToken;
                }
            } catch (error) {
                console.error('Security verification unavailable:', error);
            }
            return null;
        }

        /**
         * Ensure security verification is loaded before making authenticated requests
         */
        async ensureCSRF() {
            if (!this.csrfToken) {
                await this.loadCSRFToken();
            }
            return this.csrfToken;
        }

        /**
         * Build secure headers for authenticated requests
         */
        getHeaders(includeContentType = true) {
            const headers = {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-Token': this.csrfToken || ''
            };
            
            // Only include Content-Type for requests with body (POST, PUT, PATCH)
            if (includeContentType) {
                headers['Content-Type'] = 'application/json';
            }
            
            return headers;
        }

        /**
         * Generic fetch wrapper with error handling
         */
        async request(endpoint, options = {}) {
            await this.ensureCSRF();

            // Determine if this request should have Content-Type header
            const method = (options.method || 'GET').toUpperCase();
            const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';

            const response = await fetch(`${getApiBase()}${endpoint}`, {
                ...options,
                credentials: 'include',
                headers: this.getHeaders(hasBody)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Request failed' }));
                throw new Error(error.detail || error.message || 'Something went wrong — please try again');
            }

            return response.json();
        }

        // ==================== Mandate Management ====================

        /**
         * Validate mandate draft before issuance
         * POST /api/mandates/draft
         * Backend validates broker minimums and risk settings
         * 
         * @param {object} draft - MandateDraft object with:
         *   - portfolio: Array of { strategy_id, symbols, broker_account_ref, adaptive_risk }
         *   - risk: { per_strategy: {...}, omega_risk_cap_bps: number }
         * @returns {object} { valid: bool, errors: [], warnings: [], draft: {...} }
         */
        async validateMandate(draft) {
            return this.request('/api/mandates/draft', {
                method: 'POST',
                body: JSON.stringify(draft)
            });
        }

        /**
         * Issue (activate) a new mandate
         * POST /api/mandates (NOT /api/mandates/issue!)
         * Creates new mandate and starts trading
         * 
         * @param {object} payload - {
         *   draft: MandateDraft,
         *   consent_version: string,
         *   consent_hash: string,
         *   jurisdiction: string
         * }
         * @returns {object} { status: "issued", mandate_id, version, trading_status }
         */
        async issueMandate(payload) {
            return this.request('/api/mandates', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        /**
         * Update existing mandate (creates new version)
         * POST /api/mandates/{mandate_id}/update
         * 
         * @param {string} mandateId - Mandate ID to update
         * @param {object} updateRequest - MandateUpdateRequest with:
         *   - mandate_id: string
         *   - changes: { portfolio?, risk? }
         *   - reason: string (why updating)
         * @returns {object} { status: "updated", old_version, new_version }
         */
        async updateMandate(mandateId, updateRequest) {
            return this.request(`/api/mandates/${mandateId}/update`, {
                method: 'POST',
                body: JSON.stringify(updateRequest)
            });
        }

        /**
         * Revoke (deactivate) mandate - STOPS ALL TRADING
         * POST /api/mandates/{mandate_id}/revoke
         * 
         * @param {string} mandateId - Mandate ID to revoke
         * @param {object} revokeRequest - { mandate_id, reason }
         * @returns {object} { status: "revoked", message }
         */
        async revokeMandate(mandateId, revokeRequest) {
            return this.request(`/api/mandates/${mandateId}/revoke`, {
                method: 'POST',
                body: JSON.stringify(revokeRequest)
            });
        }

        /**
         * Get current ACTIVE mandate for logged-in user
         * GET /api/mandates/active (NOT /api/mandates/current!)
         * 
         * @returns {object} { status: "active", mandate: {...} } or { status: "no_mandate" }
         */
        async getCurrentMandate() {
            return this.request('/api/mandates/active', {
                method: 'GET'
            });
        }

        /**
         * Get all mandate versions for user (history)
         * GET /api/mandates/history?limit=50
         * 
         * @param {number} limit - Max number of versions to return
         * @returns {object} { status: "success", count, history: [...] }
         */
        async getMandateHistory(limit = 50) {
            return this.request(`/api/mandates/history?limit=${limit}`, {
                method: 'GET'
            });
        }

        /**
         * Calculate risk implications BEFORE creating mandate
         * POST /api/mandates/calculate-risk-implications
         * Shows expected positions, worst-case risk, warnings
         * 
         * @param {object} config - {
         *   portfolio: Array,
         *   risk: object,
         *   omega_enabled: bool
         * }
         * @returns {object} { summary, per_strategy, warnings, recommendations, risk_level }
         */
        async calculateRiskImplications(config) {
            return this.request('/api/mandates/calculate-risk-implications', {
                method: 'POST',
                body: JSON.stringify(config)
            });
        }

        // ==================== Strategy Catalog ====================

        /**
         * Get available trading strategies
         * GET /api/strategies
         * @returns {array} List of strategies with descriptions
         */
        async getStrategies() {
            return this.request('/api/strategies', {
                method: 'GET'
            });
        }

        // ==================== Consent Management ====================

        /**
         * Get consent document for jurisdiction
         * GET /api/consent/documents?jurisdiction=US
         * @param {string} jurisdiction - Jurisdiction code (default: US)
         * @returns {object} Consent document with text
         */
        async getConsent(jurisdiction = 'US') {
            return this.request(`/api/consent/documents?jurisdiction=${jurisdiction}`, {
                method: 'GET'
            });
        }

        // ==================== Decision Reports ====================

        /**
         * Query decision history
         * GET /api/decisions/query?email=user@example.com&limit=50
         * @param {object} params - { email?, mandate_id?, limit?, offset? }
         * @returns {array} List of decision reports
         */
        async queryDecisions(params = {}) {
            const query = new URLSearchParams();
            if (params.email) query.append('email', params.email);
            if (params.mandate_id) query.append('mandate_id', params.mandate_id);
            if (params.limit) query.append('limit', params.limit);
            if (params.offset) query.append('offset', params.offset);

            return this.request(`/api/decisions/query?${query.toString()}`, {
                method: 'GET'
            });
        }

        // ==================== WebSocket Connections ====================

        /**
         * Get WebSocket token for authenticated connections
         * POST /api/ws_token
         * @returns {object} { ws_token }
         */
        async getWsToken() {
            return this.request('/api/ws_token', {
                method: 'POST'
            });
        }

        /**
         * Connect to signal WebSocket for decision reports
         * @param {string} wsToken - WebSocket authentication token
         * @returns {WebSocket} Connected WebSocket instance
         */
        connectSignalWS(wsToken) {
            const url = getWsUrl(`/ws/signal?token=${wsToken}`);
            const ws = new WebSocket(url);

            ws.onopen = () => console.log('📡 Signal WebSocket connected');
            ws.onerror = (error) => console.error('Signal WebSocket error:', error);
            ws.onclose = (event) => console.log('📡 Signal WebSocket closed:', event.code);

            return ws;
        }

        /**
         * Connect to activity WebSocket for mandate status updates
         * @param {string} wsToken - WebSocket security
         * @returns {WebSocket} Connected WebSocket instance
         */
        connectActivityWS(wsToken) {
            const url = getWsUrl(`/activity-ws?token=${wsToken}`);
            const ws = new WebSocket(url);

            ws.onopen = () => console.log('📊 Activity WebSocket connected');
            ws.onerror = (error) => console.error('Activity WebSocket error:', error);
            ws.onclose = (event) => console.log('📊 Activity WebSocket closed:', event.code);

            return ws;
        }

        // ==================== Utility Methods ====================

        /**
         * Format currency for display
         * @param {number} amount - Dollar amount
         * @returns {string} Formatted currency string
         */
        formatCurrency(amount) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(amount || 0);
        }

        /**
         * Format date/time for display
         * @param {number|string} timestamp - Unix timestamp or ISO string
         * @returns {string} Formatted date string
         */
        formatDateTime(timestamp) {
            const date = typeof timestamp === 'number' 
                ? new Date(timestamp * 1000) 
                : new Date(timestamp);
            
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        /**
         * Format relative time (e.g., "2 hours ago")
         * @param {number|string} timestamp - Unix timestamp or ISO string
         * @returns {string} Relative time string
         */
        formatTimeAgo(timestamp) {
            const now = Date.now() / 1000;
            const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime() / 1000;
            const diff = now - ts;

            if (diff < 60) return 'just now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            return `${Math.floor(diff / 86400)}d ago`;
        }
    }

    // Expose global API client
    window.BackendAPI = BackendAPI;

    // Create default instance for convenience
    window.chillaAPI = new BackendAPI();

    console.log('✅ Backend API client loaded');
})();
