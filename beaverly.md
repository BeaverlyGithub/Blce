# beaverly.md

## Overview

This is a web-based dashboard application for **Chilla™**, an AI-powered trading automation platform developed by **Beaverly®**. The application provides user authentication, real-time dashboard monitoring, FAQ support, and contact functionality. It's built as a client-side application with external API integration for authentication and data services.

## System Architecture

### Frontend Architecture
- **Static HTML/CSS/JavaScript**: Pure client-side application using modern web standards
- **Styling Framework**: Tailwind CSS for responsive design and utility-first styling
- **Font**: Custom Outfit and Inter fonts for professional typography
- **Charts**: Chart.js for data visualization in the dashboard
- **Email Integration**: EmailJS for contact form submissions

### Backend Architecture
- **Authentication API**: External service hosted at `cook.beaverlyai.com`
- **Cookie-based Authentication**: Secure session management using HTTP cookies
- **RESTful API**: Standard REST endpoints for user verification and logout

### Key Pages Structure
- `index.html` - Login/Registration page with authentication and forgot password link
- `dashboard.html` - Main dashboard with real-time data monitoring and email management
- `faq.html` - Frequently asked questions page
- `contact.html` - Contact support form
- `renewal.html` - License renewal page
- `forgot-password.html` - Password reset request page
- `reset-password.html` - New password setting page
- `change-email.html` - Email address change page

## Key Components

### Authentication System
- **Problem**: Secure user access to trading dashboard
- **Solution**: Cookie-based authentication with external API validation
- **Features**: 
  - Automatic token verification on page load
  - Silent authentication checks
  - Secure logout functionality
  - Gmail OAuth integration

### Dashboard Interface
- **Problem**: Real-time monitoring of trading automation
- **Solution**: Dynamic dashboard with live data updates
- **Features**:
  - VPS connection status monitoring
  - Real-time data refresh every 30 seconds
  - Chart.js integration for data visualization
  - User profile management

### Contact System
- **Problem**: User support and communication
- **Solution**: EmailJS-powered contact forms
- **Features**:
  - Form validation
  - Environment variable configuration
  - Real-time form feedback

### Navigation
- **Problem**: Consistent navigation across pages
- **Solution**: Responsive navigation with mobile support
- **Features**:
  - Mobile-responsive design
  - Smooth scrolling
  - Active page highlighting

## Data Flow

1. **User Authentication**:
   - User submits credentials on login page
   - Credentials sent to `cook.beaverlyai.com/api/verify_token`
   - Server responds with authentication status
   - Cookie stored for session management

2. **Dashboard Loading**:
   - Page loads and verifies authentication
   - Dashboard data fetched from external APIs
   - Real-time updates via periodic polling
   - Charts and metrics updated dynamically

3. **Contact Form**:
   - User fills contact form
   - EmailJS processes and sends email
   - Confirmation feedback to user

## External Dependencies

### CDN Services
- **Tailwind CSS**: `https://cdn.tailwindcss.com`
- **Google Fonts**: Outfit and Inter font families
- **Chart.js**: `https://cdn.jsdelivr.net/npm/chart.js`
- **EmailJS**: `https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js`

### API Services
- **Authentication API**: `cook.beaverlyai.com`
- **EmailJS**: Email delivery service
- **Google Analytics**: `G-229WRH1KTN` tracking

### Node.js Dependencies
- **@sendgrid/mail**: Email service integration (though primarily using EmailJS for frontend)

## Deployment Strategy

### Static Site Hosting
- **Approach**: Client-side only application suitable for static hosting
- **Requirements**: Any web server capable of serving static files
- **Configuration**: No server-side processing required
- **Alternatives**: GitHub Pages, Netlify, Vercel, or traditional web hosting

### Environment Configuration
- EmailJS configuration through environment variables
- Google Analytics tracking ID embedded
- External API endpoints configured in JavaScript

### Security Considerations
- Cookie-based authentication for secure sessions
- HTTPS required for production deployment
- CORS configuration needed for API integration

## Recent Changes

- July 01, 2025: Migration from Replit Agent to Replit environment
  - Added authentication pages: forgot password, reset password, change email
  - Implemented real backend data integration for paid users
  - Added profit nudges that show actual profit changes (not random numbers)
  - Enhanced dashboard with email change functionality
  - Updated profile panel with change email button
  - Integrated real MT5 trading data from cook.beaverlyai.com backend
  - Added client/server security separation

## Changelog

Changelog:
- July 01, 2025. Initial setup and migration completed

## User Preferences

Preferred communication style: Simple, everyday language.
