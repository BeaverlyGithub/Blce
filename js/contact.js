// Production-grade Contact Form Handler
// Secure, CSP-compliant, with proper error handling and validation

'use strict';

class ContactFormHandler {
    constructor() {
        this.API_ENDPOINT = (window.APP_CONFIG && typeof window.APP_CONFIG.apiUrl === 'function') ? window.APP_CONFIG.apiUrl('/api/contact') : 'https://cook.beaverlyai.com/api/contact';
        this.form = null;
        this.submitBtn = null;
        this.messageDiv = null;
        this.isSubmitting = false;

        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Initialize theme
        this.initializeTheme();

        // Get DOM elements
        this.form = document.getElementById('contact-form');
        this.submitBtn = document.getElementById('submit-btn');
        this.messageDiv = document.getElementById('form-message');

        if (!this.form) {
            console.error('Contact form not found');
            return;
        }

        // Bind event listeners
        this.bindEvents();
    }

    initializeTheme() {
        const theme = localStorage.getItem('chilla-theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }

    bindEvents() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = 'dashboard.html';
            });
        }

        // Real-time validation on blur
        const fields = this.form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            field.addEventListener('blur', () => this.validateField(field));
            field.addEventListener('input', () => this.clearFieldError(field));
        });
    }

    async handleSubmit(event) {
        event.preventDefault();

        if (this.isSubmitting) return;

        const formData = new FormData(this.form);
        const data = {
            name: this.sanitizeInput(formData.get('name')),
            email: this.sanitizeInput(formData.get('email')),
            subject: this.sanitizeInput(formData.get('subject')),
            message: this.sanitizeInput(formData.get('message'))
        };

        // Clear previous errors
        this.clearAllErrors();

        // Validate form
        const validationResult = this.validateFormData(data);
        if (!validationResult.isValid) {
            this.showValidationErrors(validationResult.errors);
            return;
        }

        await this.submitForm(data);
    }

    sanitizeInput(input) {
        if (!input) return '';

        // Basic XSS protection - more comprehensive
        let sanitized = input.toString().trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');

        // NoSQL injection protection - remove MongoDB operators
        const nosqlPatterns = ['$ne', '$gt', '$lt', '$gte', '$lte', '$in', '$nin', '$exists', '$or', '$and', '$nor', '$not', 'ObjectId', '$regex', '$where'];
        nosqlPatterns.forEach(pattern => {
            sanitized = sanitized.replace(new RegExp(pattern, 'gi'), '');
        });

        // SQL injection basic protection
        const sqlPatterns = ['union', 'select', 'insert', 'delete', 'update', 'drop', 'create', 'alter', 'exec', 'execute'];
        sqlPatterns.forEach(pattern => {
            const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
            sanitized = sanitized.replace(regex, '');
        });

        return sanitized;
    }

    validateFormData(data) {
        const errors = {};
        let isValid = true;

        // Name validation
        if (!data.name || data.name.length < 2) {
            errors.name = 'Name must be at least 2 characters long';
            isValid = false;
        } else if (data.name.length > 100) {
            errors.name = 'Name must be less than 100 characters';
            isValid = false;
        } else if (!/^[a-zA-Z\s'-]+$/.test(data.name)) {
            errors.name = 'Name contains invalid characters';
            isValid = false;
        }

        // Email validation
        if (!data.email) {
            errors.email = 'Email address is required';
            isValid = false;
        } else if (!this.isValidEmail(data.email)) {
            errors.email = 'Please enter a valid email address';
            isValid = false;
        } else if (data.email.length > 254) {
            errors.email = 'Email address is too long';
            isValid = false;
        }

        // Subject validation
        if (!data.subject) {
            errors.subject = 'Please select a subject';
            isValid = false;
        }

        // Message validation
        if (!data.message || data.message.length < 10) {
            errors.message = 'Message must be at least 10 characters long';
            isValid = false;
        } else if (data.message.length > 5000) {
            errors.message = 'Message is too long (max 5000 characters)';
            isValid = false;
        }

        return { isValid, errors };
    }

    isValidEmail(email) {
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(email);
    }

    validateField(field) {
        const value = this.sanitizeInput(field.value);
        const fieldName = field.name;

        this.clearFieldError(field);

        if (!value) return; // Don't validate empty fields on blur

        const data = { [fieldName]: value };
        const validation = this.validateFormData(data);

        if (validation.errors[fieldName]) {
            this.showFieldError(field, validation.errors[fieldName]);
        }
    }

    async submitForm(data) {
        this.setSubmitState(true);

        try {
            const response = await this.makeSecureRequest(data);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            this.showMessage(
                result.message || 'Your message has been sent successfully! We\'ll get back to you within 24 hours.',
                'success'
            );
            this.form.reset();
            this.clearAllErrors();

        } catch (error) {
            console.error('Form submission error:', error);

            let errorMessage = 'Failed to send message. Please try again or contact us directly at support@beaverlyai.com';

            if (error.message.includes('Network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out. Please try again.';
            }

            this.showMessage(errorMessage, 'error');
        } finally {
            this.setSubmitState(false);
        }
    }

    async makeSecureRequest(data) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(this.API_ENDPOINT, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    setSubmitState(isSubmitting) {
        this.isSubmitting = isSubmitting;
        if (this.submitBtn) {
            this.submitBtn.textContent = isSubmitting ? 'Sending...' : 'Send Message';
            this.submitBtn.disabled = isSubmitting;
            this.submitBtn.style.opacity = isSubmitting ? '0.7' : '1';
            this.submitBtn.style.cursor = isSubmitting ? 'not-allowed' : 'pointer';
        }
    }

    showValidationErrors(errors) {
        Object.entries(errors).forEach(([fieldName, message]) => {
            const field = document.getElementById(fieldName);
            if (field) {
                this.showFieldError(field, message);
            }
        });
    }

    showFieldError(field, message) {
        field.classList.add('form-error');

        // Remove existing error
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        // Add new error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.setAttribute('role', 'alert');
        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(field) {
        field.classList.remove('form-error');
        const error = field.parentNode.querySelector('.field-error');
        if (error) {
            error.remove();
        }
    }

    clearAllErrors() {
        document.querySelectorAll('.form-error').forEach(field => {
            field.classList.remove('form-error');
        });
        document.querySelectorAll('.field-error').forEach(error => {
            error.remove();
        });
        if (this.messageDiv) {
            this.messageDiv.style.display = 'none';
        }
    }

    showMessage(message, type) {
        if (!this.messageDiv) return;

        this.messageDiv.className = `form-message message-${type}`;
        this.messageDiv.textContent = message;
        this.messageDiv.style.display = 'block';
        this.messageDiv.setAttribute('role', type === 'error' ? 'alert' : 'status');

        // Smooth scroll to message
        this.messageDiv.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (this.messageDiv) {
                    this.messageDiv.style.display = 'none';
                }
            }, 10000);
        }
    }
}

// Google Analytics setup (if gtag exists)
if (typeof gtag !== 'undefined') {
    gtag('js', new Date());
    gtag('config', 'G-229WRH1KTN');
}

// Initialize contact form when script loads
new ContactFormHandler();