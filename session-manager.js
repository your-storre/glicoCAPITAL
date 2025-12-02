// session-manager.js
// Session Management for GlicoCapital
// Auto-logout after 30 minutes total session or 10 minutes inactivity

// Configuration
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const MAX_SESSION_TIME = 30 * 60 * 1000;   // 30 minutes total session
let inactivityTimer;
let sessionStartTime;
let userLoggedIn = false;

// Initialize Firebase (same as your main pages)
if (!firebase.apps.length) {
    const firebaseConfig = {
        apiKey: "AIzaSyDQDX4eyp7fbmHqbyjytWZEv-jK7XxynqA",
        authDomain: "ggic-investment.firebaseapp.com",
        databaseURL: "https://ggic-investment-default-rtdb.firebaseio.com",
        projectId: "ggic-investment",
        storageBucket: "ggic-investment.firebasestorage.app",
        messagingSenderId: "805530882494",
        appId: "1:805530882494:web:574b965b3ed0402b0f69ef",
        measurementId: "G-NR5R3EJM93"
    };
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

// Reset inactivity timer on user activity
function resetInactivityTimer() {
    if (!userLoggedIn) return;
    
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT);
}

// Logout due to inactivity
function logoutDueToInactivity() {
    console.log('Logging out due to inactivity');
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch(error => {
        console.error('Logout error:', error);
        window.location.href = 'index.html';
    });
}

// Check total session time
function checkSessionTime() {
    if (!userLoggedIn || !sessionStartTime) return;
    
    const currentTime = Date.now();
    const sessionDuration = currentTime - sessionStartTime;
    
    if (sessionDuration >= MAX_SESSION_TIME) {
        console.log('Session expired after 30 minutes');
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}

// Start session tracking
function startSessionTracking() {
    userLoggedIn = true;
    sessionStartTime = Date.now();
    
    // Check session time every minute
    setInterval(checkSessionTime, 60000);
    
    // Reset inactivity timer
    resetInactivityTimer();
    
    console.log('Session tracking started');
}

// Stop session tracking
function stopSessionTracking() {
    userLoggedIn = false;
    clearTimeout(inactivityTimer);
    console.log('Session tracking stopped');
}

// Setup event listeners for user activity
function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, false);
    });
    
    // Also reset timer when window gains focus
    window.addEventListener('focus', resetInactivityTimer);
}

// Check authentication state
function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            console.log('User authenticated:', user.email);
            
            // Check if user just logged in (first time)
            if (!userLoggedIn) {
                startSessionTracking();
                setupActivityListeners();
            }
        } else {
            // User is signed out
            console.log('User not authenticated');
            stopSessionTracking();
            
            // Only redirect if not already on index/login page
            const currentPage = window.location.pathname;
            const isIndexPage = currentPage.includes('index.html') || 
                               currentPage.includes('login.html') || 
                               currentPage === '/' ||
                               currentPage.endsWith('/');
            
            if (!isIndexPage) {
                console.log('Redirecting to index.html');
                window.location.href = 'index.html';
            }
        }
    });
}

// Handle page visibility change (when user switches tabs/windows)
function setupVisibilityChangeHandler() {
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            console.log('Page is hidden');
        } else {
            console.log('Page is visible again');
            // Reset timer when user comes back to tab
            if (userLoggedIn) {
                resetInactivityTimer();
            }
        }
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Session manager initialized');
    
    // Start checking auth state
    checkAuthState();
    
    // Setup visibility change handler
    setupVisibilityChangeHandler();
    
    // Handle browser/tab close
    window.addEventListener('beforeunload', function() {
        if (userLoggedIn) {
            // You could save session state here if needed
            console.log('Page unloading - user session active');
        }
    });
});

// Export functions if needed (for debugging)
window.sessionManager = {
    resetTimer: resetInactivityTimer,
    checkSession: checkSessionTime,
    getRemainingTime: function() {
        if (!sessionStartTime) return 0;
        const remaining = MAX_SESSION_TIME - (Date.now() - sessionStartTime);
        return Math.max(0, Math.floor(remaining / 1000));
    },
    getInactivityTime: function() {
        // This would require tracking last activity time
        return 'Active';
    }
};
