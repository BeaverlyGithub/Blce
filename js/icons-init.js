// Initialize Lucide icons once DOM is ready
// Safe no-op if library fails to load
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch(e){ console.warn('Lucide init failed', e); }
    }
  });
})();