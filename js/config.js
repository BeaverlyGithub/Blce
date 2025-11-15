// Centralized, environment-aware API configuration for static site
// Safe: no secrets here. Controls only which host the frontend talks to.
(function(){
    function normalizeBase(s) {
        if (!s) return s;
        try {
            // allow passing raw hostnames like "localhost:8080" or full urls
            if (!/^[a-zA-Z]+:\/\//.test(s)) s = (s.indexOf(':')===-1? 'https://' + s : (s.startsWith('localhost')? 'http://' + s : 'https://' + s));
            const u = new URL(s);
            return u.protocol + '//' + u.host; // remove trailing path
        } catch (e) {
            return s.replace(/\/$/, '');
        }
    }

    function detectApiBase() {
        const hostname = window.location.hostname || '';
        const qs = new URLSearchParams(window.location.search);
        const override = qs.get('api') || localStorage.getItem('APP_API_BASE');
        if (override) return normalizeBase(override);

        

        // GitHub Pages or production domains -> use production API
        if (hostname.endsWith('wofk.beaverlyai.com') || hostname.endsWith('work.beaverlyai.com')) {
            // Default production API host (CNAME points to cook.beaverlyai.com)
            return normalizeBase('https://coox.beaverlyai.com');
        }

        // Fallback
        return normalizeBase('https://cook.beaverlyai.com');
    }

    const API_BASE = detectApiBase();

    function apiUrl(path) {
        if (!path) return API_BASE;
        const p = path.startsWith('/') ? path : '/' + path;
        return API_BASE.replace(/\/$/, '') + p;
    }

    function wsUrl(path) {
        // path should start with '/'
        const proto = API_BASE.startsWith('https://') ? 'wss://' : 'ws://';
        const host = API_BASE.replace(/^https?:\/\//, '');
        return proto + host + (path.startsWith('/') ? path : '/' + path);
    }

    // Expose a safe global config object
    window.APP_CONFIG = window.APP_CONFIG || {};
    window.APP_CONFIG.API_BASE = API_BASE;
    window.APP_CONFIG.apiUrl = apiUrl;
    window.APP_CONFIG.wsUrl = wsUrl;
    
    // Attach global navigation handlers to avoid inline onclick -> CSP safe
    document.addEventListener('DOMContentLoaded', () => {
        // Back to dashboard actions
        document.querySelectorAll('[data-action="back-to-dashboard"]').forEach(btn => {
            btn.addEventListener('click', () => window.location.href = 'dashboard.html');
        });

        // Support links
        document.querySelectorAll('[data-action="go-to-contact"]').forEach(btn => {
            btn.addEventListener('click', () => window.location.href = 'contact.html');
        });

        // Generic reload (used by many components)
        document.querySelectorAll('[data-action="reload"]').forEach(btn => {
            btn.addEventListener('click', () => window.location.reload());
        });
    });
    // helper for manual overrides during development: localStorage.setItem('APP_API_BASE','http://localhost:8080')
})();
