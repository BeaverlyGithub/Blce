
// Google Analytics setup
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-229WRH1KTN');

// Setup theme from localStorage
const theme = localStorage.getItem('chilla-theme') || 'light';
document.documentElement.setAttribute('data-theme', theme);

// Secure API configuration - no exposed keys
const SECURE_API = {
    contactEndpoint: 'https://cook.beaverlyai.com/api/contact'
};

// Utility functions
function validateForm(data) {
    clearErrors();
    let isValid = true;

    if (!data.name || data.name.trim().length < 2) {
        showFieldError('name', 'Name must be at least 2 characters long');
        isValid = false;
    }

    if (!data.email || !isValidEmail(data.email)) {
        showFieldError('email', 'Please enter a valid email address');
        isValid = false;
    }

    if (!data.subject) {
        showFieldError('subject', 'Please select a subject');
        isValid = false;
    }

    if (!data.message || data.message.trim().length < 10) {
        showFieldError('message', 'Message must be at least 10 characters long');
        isValid = false;
    }

    return isValid;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(fieldName, message) {
    const field = document.getElementById(fieldName);
    field.classList.add('form-error');

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function clearErrors() {
    document.querySelectorAll('.form-error').forEach(field => {
        field.classList.remove('form-error');
    });
    document.querySelectorAll('.field-error').forEach(error => {
        error.remove();
    });
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('form-message');
    messageDiv.className = `form-message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';

    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (type === 'success') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 10000);
    }
}

// Real-time validation
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('blur', function() {
            clearErrors();
            if (this.value.trim()) {
                const data = {};
                data[this.name] = this.value;
                validateForm(data);
            }
        });
    });
});
