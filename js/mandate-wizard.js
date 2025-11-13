// Mandate Wizard - Netflix-style onboarding for novices
// Dead-simple UX with smooth transitions and dopamine hooks

class MandateWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 5; // Updated: Added market selection step
        this.selectedStrategy = null;
        this.selectedMarkets = []; // New: User-selected markets
        this.omegaBps = 500; // Default: 5%
        this.perStrategyRiskPercent = 1.00; // Default 1.00% per trade (user-facing)
        this.maxPositions = 3;
        this.adaptiveRisk = false;
        this.consentAccepted = false;
        this.strategies = [];
        this.consentText = '';
        this.consentVersion = null; // Backend requires this
        this.consentHash = null; // Backend requires this
        this.jurisdiction = 'US'; // Default jurisdiction
        this.riskImplications = null; // Risk calculator result

        this.init();
    }

    async init() {
        // Show loading screen initially
        const loading = document.getElementById('loading-screen');
        const wizard = document.getElementById('wizard-container');

        try {
            console.log('🚀 Starting wizard initialization...');
            
            // Load security verification
            console.log('🔐 checking security status');
            await window.chillaAPI.loadCSRFToken();
            console.log('✅ security check complete');

            // Check if user already has active mandate
            console.log('📋 Checking existing instruction...');
            const currentMandate = await this.checkExistingMandate();
            if (currentMandate) {
                console.log('📋 Active instruction found, redirecting to dashboard');
                // Redirect to dashboard if already activated
                window.location.href = 'dashboard.html';
                return;
            }
            console.log('✅ No active instruction found, proceeding with wizard');

            // Load initial data
            console.log('📊 Loading strategies...');
            await this.loadStrategies();
            console.log('✅ Strategies loaded:', this.strategies.length, 'strategies');

            console.log('📜 Loading consent...');
            await this.loadConsent();
            console.log('✅ Consent loaded');

            // Setup event listeners
            this.setupEventListeners();

            // Initialize new risk input bindings
            this.bindRiskInputs();

            // Show wizard
            console.log('🎉 Showing wizard');
            loading.classList.add('hidden');
            wizard.classList.remove('hidden');

            console.log('✅ Mandate wizard initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize wizard:', error);
            this.showError('Could not load wizard — please refresh and try again');
        }
    }

    bindRiskInputs() {
        const riskInput = document.getElementById('risk-per-trade');
        const maxPos = document.getElementById('max-positions');
        const adaptive = document.getElementById('adaptive-risk-toggle');
        const slider = document.getElementById('omega-slider');

        if (riskInput) {
            riskInput.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                // Clamp between 0.01% and 5.00%
                const clamped = Math.min(Math.max(isNaN(v) ? 1.0 : v, 0.01), 5.0);
                this.perStrategyRiskPercent = Math.round(clamped * 100) / 100;
                // Keep the field consistent (format to 2 decimals)
                e.target.value = this.perStrategyRiskPercent.toFixed(2);
            });
        }
        if (maxPos) {
            maxPos.addEventListener('input', (e) => {
                const v = parseInt(e.target.value, 10) || 3;
                this.maxPositions = Math.min(Math.max(v, 1), 10);
            });
        }
        if (adaptive) {
            adaptive.addEventListener('change', (e) => {
                this.adaptiveRisk = !!e.target.checked;
            });
        }
        if (slider) {
            slider.addEventListener('input', (e) => this.updateRiskDisplay(e.target.value));
        }
    }

    async checkExistingMandate() {
        try {
            const mandate = await window.chillaAPI.getCurrentMandate();
            // Only redirect if there's an active mandate
            return mandate && mandate.status === 'active' ? mandate : null;
            // Only redirect if there's an active mandate
            return mandate && mandate.status === 'active' ? mandate : null;
        } catch (error) {
            // No mandate exists - proceed with wizard
            return null;
        }
    }

    async loadStrategies() {
        try {
            console.log('📊 Calling getStrategies API...');
            const data = await window.chillaAPI.getStrategies();
            console.log('📊 API response:', data);
            
            this.strategies = data.strategies || data;

            // Fallback: If no strategies, use hardcoded defaults
            if (!this.strategies || !Array.isArray(this.strategies) || this.strategies.length === 0) {
                this.strategies = [
                    {
                        strategy_id: 'Sharp_maneuvers',
                        name: 'Quick Moves',
                        description: 'High-frequency pattern recognition for volatile indices',
                        category: 'most_popular'
                    }
                ];
            }

            this.renderStrategies();
            console.log('✅ Strategies rendered');
        } catch (error) {
            console.error('Failed to load strategies:', error);
            
            // Fallback: Use hardcoded strategies
            this.strategies = [
                {
                    strategy_id: 'Sharp_maneuvers',
                    name: 'Quick Moves',
                    description: 'High-frequency pattern recognition for volatile indices',
                    category: 'most_popular'
                }
            ];
            this.renderStrategies();
        }
    }

    renderStrategies() {
        console.log('🎨 Rendering strategies...');
        const grid = document.getElementById('strategy-grid');
        console.log('🎨 Strategy grid element:', grid);
        
        if (!grid || !this.strategies.length) {
            console.log('🎨 No grid or no strategies, returning early');
            console.log('🎨 Grid exists:', !!grid);
            console.log('🎨 Strategies length:', this.strategies.length);
            return;
        }

        console.log('🎨 Generating HTML for', this.strategies.length, 'strategies');
        grid.innerHTML = this.strategies.map(strategy => `
            <div class="strategy-card" data-strategy-id="${strategy.id || strategy.strategy_id}">
                <div class="strategy-icon">${this.getStrategyIcon(strategy.id || strategy.strategy_id)}</div>
                <div class="strategy-name">${strategy.name || strategy.display_name || strategy.id}</div>
                <div class="strategy-description">${strategy.description || 'A reliable trading approach'}</div>
                <div class="strategy-badge">${strategy.category || 'Strategy'}</div>
            </div>
        `).join('');

        console.log('🎨 HTML set, adding click handlers');
        // Add click handlers
        grid.querySelectorAll('.strategy-card').forEach(card => {
            card.addEventListener('click', () => this.selectStrategy(card));
        });
        
        console.log('✅ Strategies rendered successfully');
    }

    getStrategyIcon(strategyId) {
        const icons = {
            on_tick_classic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>`,
            momentum: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20m0-20L5 9m7-7l7 7"/>
            </svg>`,
            mean_reversion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12h18M3 12l4-4m-4 4l4 4m14-4l-4-4m4 4l-4 4"/>
            </svg>`,
            trend_following: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12l-4-4v3H3v2h15v3l4-4z"/>
            </svg>`,
            default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
            </svg>`
        };
        return icons[strategyId] || icons.default;
    }

    selectStrategy(card) {
        // Deselect all
        document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('selected'));

        // Select clicked
        card.classList.add('selected');
        this.selectedStrategy = card.dataset.strategyId;

        // Enable next button
        document.getElementById('step-1-next').disabled = false;

        // Add satisfying click animation
        card.style.transform = 'scale(0.98)';
        setTimeout(() => {
            card.style.transform = '';
        }, 150);
    }

    renderMarkets() {
        // If a strategy is selected and provides compatible_symbols, use those.
        // Otherwise fall back to the default full market list.
        const container = document.getElementById('markets-container');
        if (!container) return;

        // Helper to classify a symbol into a category for display
        const classify = (sym) => {
            if (!sym) return 'other';
            const s = sym.toUpperCase();
            if (s.startsWith('1HZ') || s.includes('VOL') || s.includes('VOLAT')) return 'volatility';
            if (s.startsWith('OTC') || s.startsWith('OTC_')) return 'otc';
            // crude forex detection (common 6-letter pairs)
            if (/^[A-Z]{6}$/.test(s)) return 'forex';
            return 'other';
        };

        // Build a markets object from either the selected strategy or defaults
        let markets = {
            volatility: { name: '⚡ Volatility Indices', symbols: [] },
            forex: { name: '💱 Forex Pairs', symbols: [] },
            otc: { name: '📊 OTC Indices', symbols: [] },
            other: { name: 'Other', symbols: [] }
        };

        // If a strategy is selected, prefer its compatible_symbols
        let symbolsToShow = null;
        if (this.selectedStrategy && Array.isArray(this.strategies) && this.strategies.length) {
            const strat = this.strategies.find(s => (s.strategy_id || s.id) === this.selectedStrategy);
            if (strat && Array.isArray(strat.compatible_symbols) && strat.compatible_symbols.length) {
                symbolsToShow = strat.compatible_symbols.slice();
            }
        }

        // Default fallback list when no strategy-specific symbols available
        if (!symbolsToShow) {
            symbolsToShow = [
                '1HZ100V','1HZ200V','1HZ300V',
                'EURUSD','GBPUSD','USDJPY',
                'OTC_DJI','OTC_AUS200'
            ];
        }

        // Convert to display entries
        symbolsToShow.forEach(sym => {
            const category = classify(sym);
            const name = (category === 'forex' && sym.length === 6)
                ? `${sym.slice(0,3)}/${sym.slice(3)}`
                : sym.replace('_', ' ');

            markets[category] = markets[category] || { name: category, symbols: [] };
            markets[category].symbols.push({ id: sym, name: name });
        });

        // Render HTML
        container.innerHTML = Object.entries(markets).map(([category, data]) => `
            <div class="market-category">
                <h3 class="market-category-title">${data.name}</h3>
                <div class="market-grid">
                    ${data.symbols.map(symbol => `
                        <label class="market-checkbox">
                            <input type="checkbox" value="${symbol.id}" data-category="${category}">
                            <span class="market-name">${symbol.name}</span>
                            <span class="market-id">${symbol.id}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Add event listeners for checkboxes (no inline handlers)
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleMarket(e.target.value, e.target.checked);
            });
        });

        // Pre-select first symbol if none selected yet
        if (!this.selectedMarkets || this.selectedMarkets.length === 0) {
            const defaultMarket = container.querySelector('input[value="1HZ100V"]') || container.querySelector('input[type="checkbox"]');
            if (defaultMarket) {
                defaultMarket.checked = true;
                this.selectedMarkets = [defaultMarket.value];
                const nextBtn = document.getElementById('step-2-next');
                if (nextBtn) nextBtn.disabled = false;
            }
        } else {
            // Restore checked state from this.selectedMarkets
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (this.selectedMarkets.includes(cb.value)) cb.checked = true;
            });
        }
    }

    toggleMarket(symbolId, selected) {
        if (selected) {
            if (!this.selectedMarkets.includes(symbolId)) {
                this.selectedMarkets.push(symbolId);
            }
        } else {
            this.selectedMarkets = this.selectedMarkets.filter(s => s !== symbolId);
        }

        // Update button state
        const nextBtn = document.getElementById('step-2-next');
        if (nextBtn) {
            nextBtn.disabled = this.selectedMarkets.length === 0;
        }

        // Update counter
        const counter = document.getElementById('selected-markets-count');
        if (counter) {
            counter.textContent = `${this.selectedMarkets.length} selected`;
        }
    }

    async calculateRiskImplications() {
        try {
            // Show loading state
            const riskIndicator = document.getElementById('risk-indicator');
            if (riskIndicator) {
                riskIndicator.innerHTML = '<div class="loading-spinner">Calculating...</div>';
            }

            // Build config matching backend format
            const config = {
                portfolio: [{
                    strategy_id: this.selectedStrategy,
                    symbols: this.selectedMarkets,
                    adaptive_risk: !!this.adaptiveRisk
                }],
                risk: {
                    per_strategy: {
                        [this.selectedStrategy]: {
                            // Backend expects bps (basis points). Convert from percent.
                            risk_per_trade_bps: Math.round((parseFloat(this.perStrategyRiskPercent) || 1.0) * 100),
                            max_positions: parseInt(this.maxPositions, 10) || 3
                        }
                    },
                    omega_risk_cap_bps: Math.min(parseInt(this.omegaBps, 10) || 500, 1000)
                },
                omega_enabled: (parseInt(this.omegaBps, 10) || 0) > 0
            };

            const result = await window.chillaAPI.calculateRiskImplications(config);
            this.riskImplications = result;

            // Show simple traffic light indicator
            this.displayRiskIndicator(result);

        } catch (error) {
            console.error('Risk calculation failed:', error);
            // Continue anyway - don't block user
        }
    }

    displayRiskIndicator(result) {
        const indicator = document.getElementById('risk-indicator');
        if (!indicator) return;

        const level = result.risk_level || 'moderate';
        const worstCase = result.summary?.worst_case_risk_percent || 0;
        const totalPositions = result.summary?.total_expected_positions || 0;

        const colors = {
            low: { bg: '#d4edda', text: '#155724', icon: '✅', label: 'Looking Good!' },
            moderate: { bg: '#fff3cd', text: '#856404', icon: '⚡', label: 'Balanced Risk' },
            high: { bg: '#f8d7da', text: '#721c24', icon: '⚠️', label: 'High Exposure' },
            extreme: { bg: '#f5c6cb', text: '#491217', icon: '🚨', label: 'Very High Risk!' }
        };

        const style = colors[level] || colors.moderate;

        indicator.innerHTML = `
            <div class="risk-card" style="background: ${style.bg}; color: ${style.text};">
                <div class="risk-icon">${style.icon}</div>
                <div class="risk-label">${style.label}</div>
                <div class="risk-summary">
                    Expect ~${totalPositions} positions/month. 
                    Worst-case: ${worstCase.toFixed(1)}% if all trades fail.
                </div>
                ${result.warnings && result.warnings.length > 0 ? `
                    <div class="risk-warning">${result.warnings[0]}</div>
                ` : ''}
            </div>
        `;
    }

    async loadConsent() {
        try {
            const data = await window.chillaAPI.getConsent(this.jurisdiction);
            this.consentText = data.consent_text || data.text || 'Trading consent document.';
            this.consentVersion = data.version || data.document_version || 'v1';
            this.consentHash = data.content_hash || data.hash || '';

            // Render consent in step 4 (moved from step 3)
            const consentEl = document.getElementById('consent-text');
            if (consentEl) {
                consentEl.innerHTML = `<p>${this.consentText}</p>`;
            }
        } catch (error) {
            console.error('Failed to load consent:', error);
            this.consentText = 'Unable to load consent document. Please try again.';
            this.consentVersion = 'v1';
            this.consentHash = '';
            
            // Fallback: Show default consent text
            const consentEl = document.getElementById('consent-text');
            if (consentEl) {
                consentEl.innerHTML = `<p>By proceeding, you authorize Chilla to execute your instructions according to your selected strategy and risk parameters. You can edit or cancel these instructions at any time.</p>`;
            }
        }
    }

    setupEventListeners() {
        // Step 1: Strategy
        document.getElementById('step-1-next')?.addEventListener('click', () => this.goToStep(2));

        // Step 2: Markets (NEW)
        document.getElementById('step-2-back')?.addEventListener('click', () => this.goToStep(1));
        document.getElementById('step-2-next')?.addEventListener('click', () => {
            if (this.selectedMarkets.length === 0) {
                this.showError('Please select at least one market to trade.');
                return;
            }
            this.goToStep(3);
        });

        // Step 3: Risk
        document.getElementById('step-3-back')?.addEventListener('click', () => this.goToStep(2));
        document.getElementById('step-3-next')?.addEventListener('click', async () => {
            // Validate per-strategy risk before calculating implications
            const valid = this.validateRiskInputs();
            if (!valid.ok) {
                this.showError(valid.message);
                return;
            }

            // Calculate risk implications before moving to consent
            await this.calculateRiskImplications();
            this.goToStep(4);
        });

        // Omega slider
        const slider = document.getElementById('omega-slider');
        if (slider) {
            slider.addEventListener('input', (e) => this.updateRiskDisplay(e.target.value));
        }

        // Step 4: Consent (moved from step 3)
        document.getElementById('step-4-back')?.addEventListener('click', () => this.goToStep(3));
        document.getElementById('step-4-next')?.addEventListener('click', () => this.goToStep(5));

        // Consent checkbox
        document.getElementById('consent-accept')?.addEventListener('change', (e) => {
            this.consentAccepted = e.target.checked;
            document.getElementById('step-4-next').disabled = !this.consentAccepted;
        });

        // Step 5: Activation (moved from step 4)
        document.getElementById('step-5-back')?.addEventListener('click', () => this.goToStep(4));
        document.getElementById('step-5-activate')?.addEventListener('click', () => this.activateMandate());

        // Success screen
        document.getElementById('go-to-dashboard')?.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });

        // Error modal
        document.getElementById('error-close')?.addEventListener('click', () => this.hideError());
    }

    validateRiskInputs() {
        // Ensure a strategy is selected
        if (!this.selectedStrategy) {
            return { ok: false, message: 'Please select a strategy before setting risk.' };
        }

        // Read the input directly to ensure HTML validity

        const riskEl = document.getElementById('risk-per-trade');
        if (!riskEl) return { ok: false, message: 'Risk input not found' };

        const value = parseFloat(riskEl.value);
        if (isNaN(value) || value < 0.01 || value > 5.0) {
            return { ok: false, message: 'Please enter a per-trade risk between 0.01% and 5.00%.' };
        }

        // Update internal state from validated input
        this.perStrategyRiskPercent = Math.round(value * 100) / 100;

        return { ok: true };
    }

    goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > this.totalSteps + 1) return;

        // Update step data before transition
        if (stepNumber === 2) {
            this.renderMarkets(); // NEW: Render market selection
        } else if (stepNumber === 3) {
            this.updateRiskPreview();
        } else if (stepNumber === 5) {
            this.updateActivationSummary();
        }

        // Smooth transition
        const currentStepEl = document.querySelector('.wizard-step.active');
        const nextStepEl = document.getElementById(`step-${stepNumber}`);

        if (!currentStepEl || !nextStepEl) return;

        // Fade out current
        currentStepEl.style.opacity = '0';
        currentStepEl.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            currentStepEl.classList.remove('active');
            nextStepEl.classList.add('active');

            // Fade in next
            nextStepEl.style.opacity = '0';
            nextStepEl.style.transform = 'translateX(20px)';

            setTimeout(() => {
                nextStepEl.style.opacity = '1';
                nextStepEl.style.transform = 'translateX(0)';
            }, 50);
        }, 200);

        // Update progress
        this.currentStep = stepNumber;
        this.updateProgress();
    }

    updateProgress() {
        // Progress bar fill
        const progress = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;

        // Progress step indicators
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            if (index + 1 < this.currentStep) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (index + 1 === this.currentStep) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
    }

    updateRiskDisplay(bps) {
        this.omegaBps = parseInt(bps);

        // Update circular progress
        const percent = (this.omegaBps / 1000) * 100;
        const fill = document.getElementById('risk-circle-fill');
        if (fill) {
            fill.style.background = `conic-gradient(
                var(--primary-color) ${percent}%, 
                var(--muted-bg) ${percent}%
            )`;
        }

        // Update display value (monthly cap)
        const displayValue = (this.omegaBps / 100).toFixed(1) + '%';
        const displayEl = document.getElementById('risk-display-value');
        if (displayEl) displayEl.textContent = displayValue;

        // Update preview (show percent only, not bps)
        const previewBps = document.getElementById('preview-bps');
        if (previewBps) previewBps.textContent = displayValue;
    }

    updateRiskPreview() {
        const strategyName = this.getStrategyName(this.selectedStrategy);
        const previewStrategy = document.getElementById('preview-strategy');
        if (previewStrategy) previewStrategy.textContent = strategyName;
        // Show per-trade risk percent in preview (no bps shown to users)
        const previewBps = document.getElementById('preview-bps');
        if (previewBps) {
            const percent = (parseFloat(this.perStrategyRiskPercent) || 1.0).toFixed(2) + '%';
            previewBps.textContent = `${percent}`;
        }
    }

    updateActivationSummary() {
        const strategyName = this.getStrategyName(this.selectedStrategy);
        const riskDisplay = (this.omegaBps / 100).toFixed(1) + '%';
        const marketsDisplay = this.selectedMarkets.length > 3 
            ? `${this.selectedMarkets.slice(0, 3).join(', ')} +${this.selectedMarkets.length - 3} more`
            : this.selectedMarkets.join(', ');

        document.getElementById('final-strategy').textContent = strategyName;
        document.getElementById('final-markets').textContent = marketsDisplay;
        // Show both monthly cap and per-trade baseline (percent only)
        const perTrade = (parseFloat(this.perStrategyRiskPercent) || 1.0).toFixed(2) + '%';
        document.getElementById('final-risk').textContent = `${riskDisplay} monthly cap • Per-trade: ${perTrade}`;
    }

    getStrategyName(strategyId) {
        const strategy = this.strategies.find(s => 
            (s.id || s.strategy_id) === strategyId
        );
        return strategy?.name || strategy?.display_name || strategyId;
    }

    async activateMandate() {
        const activateBtn = document.getElementById('step-5-activate');
        if (!activateBtn) return;

        // Disable button to prevent double-clicks
        activateBtn.disabled = true;
        activateBtn.textContent = 'Activating...';

        try {
            // Build draft matching backend MandateDraft model
            // Clamp omega to backend limits before sending
            const clampedOmega = Math.min(Math.max(parseInt(this.omegaBps, 10) || 500, 1), 1000);

            const draft = {
                portfolio: [{
                    strategy_id: this.selectedStrategy,
                    symbols: this.selectedMarkets,
                    broker_account_ref: {
                        broker: 'deriv', // TODO: Get from user's OAuth
                        account_id: 'default' // TODO: Get from user metadata
                    },
                    adaptive_risk: !!this.adaptiveRisk
                }],
                risk: {
                    per_strategy: {
                        [this.selectedStrategy]: {
                            // Convert the user-facing percent into backend bps for the draft
                            risk_per_trade_bps: Math.round((parseFloat(this.perStrategyRiskPercent) || 1.0) * 100),
                            max_positions: parseInt(this.maxPositions, 10) || 3
                        }
                    },
                    omega_risk_cap_bps: clampedOmega
                }
            };

            // First validate the mandate draft
            const validation = await window.chillaAPI.validateMandate(draft);
            
            if (!validation.valid) {
                // Show validation errors (backend returns warnings/errors array)
                const errors = validation.errors || validation.warnings || [];
                const errorMsg = Array.isArray(errors) ? errors.join(', ') : (errors || 'Validation failed');
                throw new Error(errorMsg || 'Please review the warnings and try again');
            }

            // If validation passes, issue the mandate
            // Backend requires: { draft, consent_version, consent_hash, jurisdiction }
            const issuePayload = {
                draft: draft,
                consent_version: this.consentVersion,
                consent_hash: this.consentHash,
                jurisdiction: this.jurisdiction
            };

            await window.chillaAPI.issueMandate(issuePayload);

            // Show success screen
            this.showSuccess();
        } catch (error) {
            console.error('Activation failed:', error);
            this.showError(error.message || 'Could not activate Chilla — please try again');

            // Re-enable button
            activateBtn.disabled = false;
            activateBtn.textContent = 'Activate Chilla';
        }
    }

    showSuccess() {
        const step4 = document.getElementById('step-4');
        const successScreen = document.getElementById('success-screen');

        if (!step4 || !successScreen) return;

        // Smooth transition to success
        step4.style.opacity = '0';
        setTimeout(() => {
            step4.classList.remove('active');
            successScreen.classList.add('active');
            successScreen.style.opacity = '1';

            // Confetti effect (simple version)
            this.celebrateSuccess();
        }, 300);
    }

    celebrateSuccess() {
        // Simple celebration animation
        const successIcon = document.querySelector('.success-icon');
        if (!successIcon) return;

        successIcon.style.transform = 'scale(0)';
        setTimeout(() => {
            successIcon.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            successIcon.style.transform = 'scale(1)';
        }, 100);
    }

    showError(message) {
        const modal = document.getElementById('error-modal');
        const messageEl = document.getElementById('error-message');

        if (modal && messageEl) {
            messageEl.textContent = message;
            modal.classList.remove('hidden');
        }
    }

    hideError() {
        const modal = document.getElementById('error-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

// Initialize wizard when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new MandateWizard();
});
