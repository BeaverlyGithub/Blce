/**
 * Netflix-Style Strategy Catalog
 * 
 * Features:
 * - Category-based horizontal scrolling
 * - Expandable cards with backtest data
 * - Search functionality
 * - Real-time user counts
 * - Visual sparklines for performance
 */

class StrategyCatalog {
    constructor(containerId = 'strategy-catalog') {
        this.container = document.getElementById(containerId);
        this.strategies = [];
        this.categories = [];
        this.selectedStrategy = null;
        this.searchQuery = '';
        this.expandedCard = null;
        
        this.init();
    }
    
    async init() {
        await this.loadStrategies();
        this.renderCatalog();
        this.setupEventListeners();
    }
    
    async loadStrategies() {
        try {
            const data = await window.chillaAPI.getStrategies();
            this.strategies = data.strategies || data;
            
            // Group by category
            this.categories = this.groupByCategory(this.strategies);
            
            // Load user counts (real-time)
            await this.loadUserCounts();
        } catch (error) {
            console.error('Failed to load strategies:', error);
            this.strategies = this.getFallbackStrategies();
            this.categories = this.groupByCategory(this.strategies);
        }
    }
    
    groupByCategory(strategies) {
        const categoryMap = new Map();
        
        strategies.forEach(strategy => {
            const category = strategy.category || 'Other';
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category).push(strategy);
        });
        
        // Convert to array and sort by priority
        const categories = Array.from(categoryMap.entries()).map(([name, items]) => ({
            name: this.formatCategoryName(name),
            slug: name,
            strategies: items
        }));
        
        // Sort: Most Popular first, then alphabetically
        return categories.sort((a, b) => {
            if (a.slug === 'most_popular') return -1;
            if (b.slug === 'most_popular') return 1;
            return a.name.localeCompare(b.name);
        });
    }
    
    formatCategoryName(slug) {
        const names = {
            'most_popular': 'Most Popular',
            'momentum': 'Momentum',
            'mean_reversion': 'Mean Reversion',
            'scalping': 'Scalping',
            'trend_following': 'Trend Following',
            'breakout': 'Breakout',
            'swing': 'Swing Trading'
        };
        return names[slug] || slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    
    async loadUserCounts() {
        try {
            const counts = await window.chillaAPI.getStrategyUserCounts();
            
            this.strategies = this.strategies.map(s => ({
                ...s,
                user_count: counts[s.id || s.strategy_id] || 0
            }));
        } catch (error) {
            // Silently handle - user counts are optional enhancement
            // Default to 0 counts if endpoint not available yet
            this.strategies = this.strategies.map(s => ({
                ...s,
                user_count: 0
            }));
        }
    }
    
    renderCatalog() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="catalog-header">
                <h1>Choose your strategy</h1>
            </div>
            
            <div class="catalog-categories">
                ${this.renderCategories()}
            </div>
        `;
    }
    
    renderCategories() {
        const filtered = this.searchQuery 
            ? this.filterStrategies(this.searchQuery)
            : this.categories;
        
        if (filtered.length === 0) {
            return `
                <div class="no-results">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <p>No strategies match "${this.searchQuery}"</p>
                </div>
            `;
        }
        
        return filtered.map(category => `
            <div class="category-section" data-category="${category.slug}">
                <div class="category-header">
                    <h2 class="category-title">${category.name}</h2>
                    <button 
                        class="category-view-all" 
                        data-category="${category.slug}"
                        aria-label="View all ${category.name} strategies"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </button>
                </div>
                
                <div class="category-scroll">
                    <div class="strategy-row">
                        ${category.strategies.map(s => this.renderStrategyCard(s)).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    renderStrategyCard(strategy) {
        const strategyId = strategy.id || strategy.strategy_id;
        const selectedId = this.selectedStrategy?.id || this.selectedStrategy?.strategy_id;
        const isSelected = selectedId === strategyId;
        const isExpanded = this.expandedCard === strategyId;
        
        return `
            <div 
                class="strategy-card-netflix ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}" 
                data-strategy-id="${strategy.id || strategy.strategy_id}"
            >
                <div class="card-thumbnail">
                    ${this.getStrategyIcon(strategy.id || strategy.strategy_id)}
                    ${isSelected ? '<div class="selected-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>' : ''}
                </div>
                
                <div class="card-content">
                    <h3 class="card-title">${strategy.name || strategy.display_name}</h3>
                    <p class="card-description">${strategy.description || 'A reliable trading approach'}</p>
                    
                    <div class="card-meta">
                        <span class="user-count">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            ${this.formatUserCount(strategy.user_count || 0)}
                        </span>
                        <button class="card-info-btn" data-action="expand">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        </button>
                    </div>
                </div>
                
                ${isExpanded ? this.renderExpandedContent(strategy) : ''}
            </div>
        `;
    }
    
    renderExpandedContent(strategy) {
        return `
            <div class="card-expanded">
                <div class="expanded-section">
                    <h4>Full Description</h4>
                    <p>${strategy.full_description || strategy.description || 'Detailed information coming soon.'}</p>
                </div>
                
                <div class="expanded-section">
                    <h4>Historical Metrics (Educational Only)</h4>
                    <div class="compliance-notice">
                        <small>Past performance does not indicate future results. These are educational statistics only.</small>
                    </div>
                    <div class="performance-stats">
                        <div class="stat">
                            <span class="stat-label">Win Rate</span>
                            <span class="stat-value">${strategy.recent_win_rate_pct ? strategy.recent_win_rate_pct.toFixed(1) + '%' : 'N/A'}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Sharpe Ratio</span>
                            <span class="stat-value">${strategy.recent_sharpe_ratio ? strategy.recent_sharpe_ratio.toFixed(2) : 'N/A'}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Avg Drawdown</span>
                            <span class="stat-value">${strategy.avg_drawdown_pct ? strategy.avg_drawdown_pct.toFixed(2) + '%' : 'N/A'}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Recovery Factor</span>
                            <span class="stat-value">${strategy.recovery_factor ? strategy.recovery_factor.toFixed(2) : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="expanded-section">
                    <h4>Drawdown Pattern (Backtest)</h4>
                    <canvas id="backtest-chart-${strategy.strategy_id}" class="backtest-chart"></canvas>
                    <div id="backtest-loading-${strategy.strategy_id}" class="backtest-loading">Loading backtest data...</div>
                    <p class="chart-disclaimer"><small>Historical data for educational purposes. Not a recommendation or guarantee of future performance.</small></p>
                </div>
                
                <div class="expanded-actions">
                    <button class="btn-secondary" data-action="collapse">
                        Close Details
                    </button>
                    <button class="btn-primary" data-action="select">
                        Select Strategy
                    </button>
                </div>
            </div>
        `;
    }
    
    renderSparkline(strategy) {
        // Simple visual trend indicator (replace with actual chart library if needed)
        const trend = strategy.trend || 'up'; // 'up', 'down', 'sideways'
        const icons = {
            up: '<svg class="trend-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
            down: '<svg class="trend-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>',
            sideways: '<svg class="trend-sideways" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><line x1="5" y1="12" x2="19" y2="12"/></svg>'
        };
        return icons[trend] || icons.up;
    }
    
    formatUserCount(count) {
        if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
        return count.toString();
    }
    
    getStrategyIcon(strategyId) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
    }
    
    filterStrategies(query) {
        const lowerQuery = query.toLowerCase();
        return this.categories
            .map(cat => ({
                ...cat,
                strategies: cat.strategies.filter(s => 
                    (s.name || '').toLowerCase().includes(lowerQuery) ||
                    (s.description || '').toLowerCase().includes(lowerQuery)
                )
            }))
            .filter(cat => cat.strategies.length > 0);
    }
    
    setupEventListeners() {
        
        // Strategy card clicks
        this.container.addEventListener('click', (e) => {
            const card = e.target.closest('.strategy-card-netflix');
            const actionBtn = e.target.closest('[data-action]');
            const action = actionBtn?.dataset.action;
            
            if (card && !action) {
                this.selectStrategy(card.dataset.strategyId);
            }
            
            if (action === 'expand') {
                e.stopPropagation();
                const expandCard = actionBtn.closest('.strategy-card-netflix');
                if (expandCard) {
                    this.toggleExpand(expandCard.dataset.strategyId);
                }
            }
            
            if (action === 'collapse') {
                this.toggleExpand(null);
            }
            
            if (action === 'select') {
                this.selectStrategy(card.dataset.strategyId);
            }
        });
        
        // View all category
        this.container.addEventListener('click', (e) => {
            const viewAllBtn = e.target.closest('.category-view-all');
            if (viewAllBtn) {
                this.showCategoryPage(viewAllBtn.dataset.category);
            }
        });
        
        // Continue button
        const continueBtn = document.getElementById('continue-with-selection');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.onContinue();
            });
        }
    }
    
    selectStrategy(strategyId) {
        const strategy = this.strategies.find(s => 
            (s.id || s.strategy_id) === strategyId
        );
        
        if (!strategy) return;
        
        this.selectedStrategy = strategy;
        this.renderCatalog();
        
        // Enable continue button
        const continueBtn = document.getElementById('continue-with-selection');
        if (continueBtn) continueBtn.disabled = false;
        
        // Emit event for parent component
        this.container.dispatchEvent(new CustomEvent('strategy-selected', {
            detail: { strategy }
        }));
    }
    
    async toggleExpand(strategyId) {
        this.expandedCard = this.expandedCard === strategyId ? null : strategyId;
        this.renderCatalog();
        
        // Load backtest data if expanding
        if (this.expandedCard) {
            await this.loadBacktestChart(strategyId);
        }
    }
    
    async loadBacktestChart(strategyId) {
        try {
            const loading = document.getElementById(`backtest-loading-${strategyId}`);
            const canvas = document.getElementById(`backtest-chart-${strategyId}`);
            
            if (!canvas) return;
            
            // Show loading
            if (loading) loading.style.display = 'block';
            if (canvas) canvas.style.display = 'none';
            
            // Fetch backtest data
            const data = await window.chillaAPI.getStrategyBacktests(strategyId);
            
            if (!data || !data.backtest || !data.backtest.monthly_returns) {
                if (loading) loading.textContent = 'No backtest data available';
                return;
            }
            
            // Hide loading, show chart
            if (loading) loading.style.display = 'none';
            if (canvas) canvas.style.display = 'block';
            
            // Render chart using Chart.js
            this.renderBacktestChart(canvas, data.backtest);
            
        } catch (error) {
            console.error('Failed to load backtest data:', error);
            const loading = document.getElementById(`backtest-loading-${strategyId}`);
            if (loading) loading.textContent = 'Failed to load backtest data';
        }
    }
    
    renderBacktestChart(canvas, backtest) {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded, skipping chart render');
            return;
        }
        
        // Use compliant metrics: drawdown over time (non-advisory)
        const monthlyData = backtest.monthly_returns || [];
        const labels = monthlyData.map(r => r.month || '');
        const drawdowns = monthlyData.map(r => Math.abs(r.drawdown_pct || 0));
        
        // Drawdown chart (always negative/zero values shown as positive bars)
        new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Drawdown (%)',
                    data: drawdowns,
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Drawdown: ${context.parsed.y.toFixed(2)}%`
                        }
                    },
                    title: {
                        display: true,
                        text: 'Historical Drawdown Pattern (Educational Only)',
                        font: {
                            size: 12,
                            weight: 'normal'
                        },
                        color: 'rgba(0, 0, 0, 0.6)'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => value + '%'
                        },
                        title: {
                            display: true,
                            text: 'Drawdown from Peak (%)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    showCategoryPage(categorySlug) {
        // Navigate to full category page (implement as needed)
        console.log('Show all strategies in category:', categorySlug);
        // Could be a modal, new page, or expanded view
    }
    
    onContinue() {
        if (!this.selectedStrategy) return;
        
        this.container.dispatchEvent(new CustomEvent('catalog-continue', {
            detail: { strategy: this.selectedStrategy }
        }));
    }
    
    getFallbackStrategies() {
        return [
            {
                id: 'Sharp_maneuvers',
                name: 'Quick Moves',
                description: 'High-frequency pattern recognition for volatile indices',
                category: 'most_popular',
                user_count: 1250,
                win_rate: '68%',
                trade_frequency: '~15/month',
                trend: 'up'
            },
            {
                id: 'momentum_surge',
                name: 'Momentum Surge',
                description: 'Ride strong market trends with momentum indicators',
                category: 'momentum',
                user_count: 890,
                win_rate: '72%',
                trade_frequency: '~8/month',
                trend: 'up'
            },
            {
                id: 'mean_bounce',
                name: 'Mean Bounce',
                description: 'Capitalize on price reversals to the mean',
                category: 'mean_reversion',
                user_count: 650,
                win_rate: '65%',
                trade_frequency: '~12/month',
                trend: 'sideways'
            }
        ];
    }
}

// Export for use in mandate wizard
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StrategyCatalog;
}
