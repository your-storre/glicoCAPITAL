// session-manager.js - FIXED VERSION
console.log('Session manager loading...');

// Configuration
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const MAX_SESSION_TIME = 30 * 60 * 1000;   // 30 minutes total session
let inactivityTimer;
let sessionStartTime;
let userLoggedIn = false;

// Wait for Firebase to be ready
function initSessionManager() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase not loaded yet');
        // Try again in 1 second
        setTimeout(initSessionManager, 1000);
        return;
    }
    
    console.log('Firebase loaded, initializing session manager...');
    
    const auth = firebase.auth();
    
    // Reset inactivity timer on user activity
    function resetInactivityTimer() {
        if (!userLoggedIn) return;
        
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT);
        console.log('Inactivity timer reset');
    }

    // Logout due to inactivity
    function logoutDueToInactivity() {
        console.log('Logging out due to inactivity (10 minutes)');
        if (auth.currentUser) {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            }).catch(error => {
                console.error('Logout error:', error);
                window.location.href = 'index.html';
            });
        }
    }

    // Check total session time
    function checkSessionTime() {
        if (!userLoggedIn || !sessionStartTime) return;
        
        const currentTime = Date.now();
        const sessionDuration = currentTime - sessionStartTime;
        
        console.log('Session duration:', Math.floor(sessionDuration / 1000), 'seconds');
        
        if (sessionDuration >= MAX_SESSION_TIME) {
            console.log('Session expired after 30 minutes');
            if (auth.currentUser) {
                auth.signOut().then(() => {
                    window.location.href = 'index.html';
                });
            }
        }
    }

    // Start session tracking
    function startSessionTracking() {
        userLoggedIn = true;
        sessionStartTime = Date.now();
        
        console.log('Session tracking started');
        
        // Check session time every minute
        setInterval(checkSessionTime, 60000);
        
        // Reset inactivity timer
        resetInactivityTimer();
        
        // Setup activity listeners
        setupActivityListeners();
    }

    // Setup activity listeners
    function setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, resetInactivityTimer);
        });
        
        window.addEventListener('focus', resetInactivityTimer);
        console.log('Activity listeners setup');
    }

    // Monitor authentication state
    auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        
        if (user) {
            // User is signed in - START SESSION TRACKING
            if (!userLoggedIn) {
                startSessionTracking();
            }
        } else {
            // User is signed out - STOP SESSION TRACKING
            userLoggedIn = false;
            clearTimeout(inactivityTimer);
            
            // Check if we're on a protected page
            const currentPage = window.location.pathname;
            const protectedPages = ['dashboard', 'payouts', 'partners', 'settings', 'support'];
            const isProtectedPage = protectedPages.some(page => currentPage.includes(page));
            
            // Don't redirect from login/index pages
            const isAuthPage = currentPage.includes('index.html') || 
                              currentPage.includes('login.html') || 
                              currentPage === '/' || 
                              currentPage.endsWith('/');
            
            if (isProtectedPage && !isAuthPage) {
                console.log('Redirecting unauthorized user to index.html');
                window.location.href = 'index.html';
            }
        }
    });

    console.log('Session manager initialized successfully');
}

// Start the session manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSessionManager);
} else {
    initSessionManager();
}
