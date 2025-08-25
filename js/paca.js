const API_BASE = 'https://cook.beaverlyai.com';

class PacaDashboard {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentTheme = 'light';

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

    setupTheme() {
        this.currentTheme = localStorage.getItem('chilla-theme') || 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }

    async checkAuthentication() {
        try {
            const response = await fetch(`${API_BASE}/api/verify_token`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: null })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'valid') {
                    this.isAuthenticated = true;
                    this.currentUser = data.users || data.user || {
                        email: data.email || localStorage.getItem('chilla_user_email') || 'user@example.com',
                        email_verified: data.email_verified || false,
                        full_name: data.full_name || 'User',
                        plan: data.plan || "Chilla's Gift",
                        auth_provider: data.auth_provider || null
                    };

                    if (this.currentUser.email) {
                        localStorage.setItem('chilla_user_email', this.currentUser.email);
                    }

                    this.showMainApp();
                    this.displayPacaDashboard();
                    return;
                }
            }
        } catch (error) {
            console.warn('Auth check failed:', error);
        }

        // Redirect to login if not authenticated
        window.location.href = 'index.html';
    }

    setupEventListeners() {
        document.getElementById('paca-back-btn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });

        document.getElementById('paca-menu-btn').addEventListener('click', () => this.toggleSidebar());

        // Sidebar overlay listener
        document.querySelector('.sidebar-overlay').addEventListener('click', () => this.closeSidebar());
    }

    showMainApp() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');

        if (this.currentUser) {
            document.getElementById('user-display-name').textContent = this.currentUser.full_name || 'User';
            document.getElementById('user-display-email').textContent = this.currentUser.email;
        }
    }

    displayPacaDashboard() {
        const dashboard = document.getElementById('paca-dashboard');

        dashboard.innerHTML = `
            <div class="paca-consent-screen">
                <div class="paca-header">
                    <div class="paca-logo"></div>
                    <h1 class="paca-title">Paca</h1>
                    <p class="paca-tagline">by beaverly</p>
                    <p class="paca-description">
                        Paca carefully integrates your strategy into Beaverly's autonomous execution layer; free, reliable, and scalable.
                    </p>
                </div>

                <div class="consent-section">
                    <div class="consent-container">
                        <div class="consent-checkbox">
                            <input type="checkbox" id="consent-checkbox">
                            <label for="consent-checkbox">
                                I consent to the <a href="#" id="terms-link">Terms & IP Agreement</a>
                            </label>
                        </div>
                        <button id="start-automating-btn" class="primary-btn" disabled>Get Automated</button>
                    </div>
                </div>
            </div>
        `;

        this.setupPacaEventListeners();
    }

    setupPacaEventListeners() {
        const consentCheckbox = document.getElementById('consent-checkbox');
        const startBtn = document.getElementById('start-automating-btn');
        const termsLink = document.getElementById('terms-link');

        // Sidebar listeners
        document.getElementById('paca-terms-btn').addEventListener('click', () => {
            window.location.href = 'paca-terms.html';
        });

        document.getElementById('paca-privacy-btn').addEventListener('click', () => {
            window.location.href = 'paca-privacy.html';
        });

        document.getElementById('automate-strategy-btn').addEventListener('click', () => {
            this.showPacaForm();
            this.closeSidebar();
        });

        // Consent screen listeners
        consentCheckbox.addEventListener('change', () => {
            startBtn.disabled = !consentCheckbox.checked;
        });

        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'paca-terms.html';
        });

        startBtn.addEventListener('click', () => {
            if (consentCheckbox.checked) {
                this.showPacaForm();
            }
        });
    }

    showPacaForm() {
        const dashboard = document.getElementById('paca-dashboard');

        dashboard.innerHTML = `
            <div class="paca-form-screen">
                <div class="paca-header">
                    <h2>Integrate your strategy</h2>
                    <p>Upload detailed logic to make integration easier. All markets are accepted.</p>
                </div>

                <form id="strategy-form" class="strategy-form">
                    <div class="form-group">
                        <label for="strategy-name">Strategy Name</label>
                        <input type="text" id="strategy-name" name="strategyName" required placeholder="Enter your strategy name">
                    </div>

                    <div class="form-group">
                        <label for="strategy-description">Detailed Description</label>
                        <textarea id="strategy-description" name="description" rows="5" required placeholder="Provide detailed logic to make integration easier..."></textarea>
                    </div>

                    <div class="form-group">
                        <label for="trading-journal-link">Trading Journal/Plan Link (Google Drive, Dropbox, etc.)</label>
                        <input type="url" id="trading-journal-link" name="tradingJournalLink" placeholder="https://drive.google.com/file/d/... or https://dropbox.com/...">
                        <div class="link-hint">Share a link to your trading journal or strategy plan</div>
                    </div>

                    <div class="form-group">
                        <label for="trade-history-link">Trade History/Performance Link</label>
                        <input type="url" id="trade-history-link" name="tradeHistoryLink" placeholder="https://drive.google.com/file/d/... or https://dropbox.com/...">
                        <div class="link-hint">Share a link to your real-world performance data</div>
                    </div>

                    <div class="form-group">
                        <label for="additional-resources-link">Additional Resources Link (Optional)</label>
                        <input type="url" id="additional-resources-link" name="additionalResourcesLink" placeholder="https://drive.google.com/file/d/... or https://dropbox.com/...">
                        <div class="link-hint">Any additional strategy files or documentation</div>
                    </div>

                    <div class="form-group">
                        <label for="team-note">Any additional info to improve your AI development</label>
                        <textarea id="team-note" name="teamNote" rows="3" placeholder="Optional: Any additional information to enhance your integration..."></textarea>
                    </div>

                    <button type="submit" class="primary-btn">Get Integrated</button>
                </form>
            </div>
        `;

        // Add event listeners
        document.getElementById('strategy-form').addEventListener('submit', (e) => {
            this.handleStrategySubmission(e);
        });
    }

    async handleStrategySubmission(e) {
        e.preventDefault();

        const formData = new FormData(e.target);

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        // Retry function with timeout
        const sendWithRetry = async (params, maxRetries = 3) => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Request timeout')), 15000);
                    });

                    if (typeof emailjs === 'undefined') {
                        throw new Error('EmailJS not loaded');
                    }
                    const emailPromise = emailjs.send('service_y3t9c3s', 'template_hjzyaiq', params);

                    await Promise.race([emailPromise, timeoutPromise]);
                    return;
                } catch (error) {
                    console.warn(`Attempt ${attempt} failed:`, error);
                    if (attempt === maxRetries) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        };

        try {
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS library not found. Please ensure it is included.');
            }

            if (!emailjs._config || !emailjs._config.publicKey) {
                emailjs.init('0w-mDmXc8j3hyp1hw');
            }

            // Collect shared links
            const tradingJournalLink = formData.get('tradingJournalLink') || '';
            const tradeHistoryLink = formData.get('tradeHistoryLink') || '';
            const additionalResourcesLink = formData.get('additionalResourcesLink') || '';

            let linksList = '';
            if (tradingJournalLink || tradeHistoryLink || additionalResourcesLink) {
                linksList = '\n\nSHARED LINKS:\n';
                if (tradingJournalLink) {
                    linksList += `• Trading Journal/Plan: ${tradingJournalLink}\n`;
                }
                if (tradeHistoryLink) {
                    linksList += `• Trade History/Performance: ${tradeHistoryLink}\n`;
                }
                if (additionalResourcesLink) {
                    linksList += `• Additional Resources: ${additionalResourcesLink}\n`;
                }
            }

            const description = formData.get('description') + linksList;
            const maxDescriptionLength = 2000;

            const templateParams = {
                from_email: this.currentUser?.email || localStorage.getItem('chilla_user_email'),
                to_email: 'creator@beaverlyai.com',
                user_name: this.currentUser?.full_name || 'User',
                strategy_name: formData.get('strategyName'),
                description: description.length > maxDescriptionLength ?
                    description.substring(0, maxDescriptionLength) + '...\n[TRUNCATED - Full details in follow-up]' :
                    description,
                team_note: formData.get('teamNote') || 'No additional notes',
                submission_date: new Date().toLocaleDateString(),
                trading_journal_link: tradingJournalLink,
                trade_history_link: tradeHistoryLink,
                additional_resources_link: additionalResourcesLink
            };

            await sendWithRetry(templateParams);
            this.showStrategySuccess();

        } catch (error) {
            console.error('Error submitting strategy:', error);

            let errorMessage = 'Failed to submit strategy. ';
            if (error.message.includes('timeout') || error.message.includes('fetch')) {
                errorMessage += 'Network timeout - please check your connection and try again.';
            } else if (error.message.includes('EmailJS not loaded') || error.message.includes('EmailJS library not found')) {
                 errorMessage = 'EmailJS library not loaded. Please ensure it is included in your project.';
            } else {
                errorMessage += 'Please try again or contact support if the issue persists.';
            }

            this.showNotification(errorMessage, 'error');

            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    showStrategySuccess() {
        const dashboard = document.getElementById('paca-dashboard');

        dashboard.innerHTML = `
            <div class="success-screen">
                <div class="success-content">
                    <div class="success-icon">✅</div>
                    <h2>Strategy Submitted Successfully!</h2>
                    <p class="success-message">
                        Congratulations! Your request has been submitted successfully.
                        If you
                        pass our sandbox, you're on to something great. If you do not, we will educate you
                        on areas for improvements on your logic.
                    </p>
                    <button id="back-to-form-btn" class="primary-btn">Submit Another Strategy</button>
                </div>
            </div>
        `;

        document.getElementById('back-to-form-btn').addEventListener('click', () => {
            this.showPacaForm();
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
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

// Initialize Paca dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PacaDashboard();
});