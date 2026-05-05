// ===========================================
// SESSION MANAGER - COMPLETE VERSION
// For GlicoCapital Investment Platform
// ===========================================

console.log('🔐 Session manager loading...');

// ===========================================
// CONFIGURATION
// ===========================================
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const CHECK_INTERVAL = 10000; // Check every 10 seconds
let inactivityTimer = null;
let sessionCheckInterval = null;
let userLoggedIn = false;
let sessionStartTime = null;

// Pages that do NOT require authentication
const publicPages = ['index.html', 'login.html', 'register.html', 'forgot-password.html'];
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// ===========================================
// WAIT FOR FIREBASE TO BE READY
// ===========================================
function waitForFirebase() {
    return new Promise((resolve) => {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            resolve();
        } else {
            console.log('⏳ Waiting for Firebase to load...');
            setTimeout(() => waitForFirebase().then(resolve), 100);
        }
    });
}

// ===========================================
// INITIALIZE SESSION MANAGER
// ===========================================
async function initSessionManager() {
    await waitForFirebase();
    
    console.log('🚀 Initializing session manager...');
    
    const auth = firebase.auth();
    
    // Set up auth state listener
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('✅ User logged in:', user.email);
            if (!userLoggedIn) {
                startSessionTracking(user);
            }
        } else {
            console.log('❌ User logged out');
            if (userLoggedIn) {
                stopSessionTracking();
            }
            checkPageAccess();
        }
    });
    
    // Listen for tab visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for page unload
    window.addEventListener('beforeunload', () => {
        sessionStorage.setItem('lastActivity', Date.now().toString());
    });
    
    // Check existing session
    checkExistingSession();
    
    console.log('✅ Session manager initialized');
}

// ===========================================
// CHECK PAGE ACCESS (Public vs Protected)
// ===========================================
function checkPageAccess() {
    const isPublicPage = publicPages.some(page => currentPage.includes(page));
    
    if (!isPublicPage && !userLoggedIn && !sessionStorage.getItem('magicLinkPending')) {
        console.log('🔒 Redirecting to login - protected page');
        localStorage.removeItem('glico_logged_in');
        sessionStorage.removeItem('magicLinkPending');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(currentPage);
    }
}

// ===========================================
// CHECK EXISTING SESSION ON PAGE LOAD
// ===========================================
function checkExistingSession() {
    const lastActivity = localStorage.getItem('lastActivity');
    const loggedIn = localStorage.getItem('glico_logged_in');
    
    if (loggedIn === 'true' && lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity < INACTIVITY_TIMEOUT) {
            console.log('🔄 Restoring existing session');
            userLoggedIn = true;
            resetInactivityTimer();
        } else {
            console.log('⏰ Session expired');
            clearSession();
        }
    }
}

// ===========================================
// START SESSION TRACKING
// ===========================================
function startSessionTracking(user) {
    userLoggedIn = true;
    sessionStartTime = Date.now();
    
    console.log('🎯 Session tracking started at:', new Date().toLocaleTimeString());
    
    // Store session info
    localStorage.setItem('glico_logged_in', 'true');
    localStorage.setItem('user_email', user.email || '');
    generateSessionId();
    
    // Reset inactivity timer
    resetInactivityTimer();
    
    // Set up activity listeners
    setupActivityListeners();
    
    // Set up periodic session check
    if (sessionCheckInterval) clearInterval(sessionCheckInterval);
    sessionCheckInterval = setInterval(checkSessionHealth, CHECK_INTERVAL);
    
    // Update session timestamp in Firebase
    updateSessionInFirebase(user);
}

// ===========================================
// STOP SESSION TRACKING
// ===========================================
function stopSessionTracking() {
    userLoggedIn = false;
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    
    localStorage.removeItem('lastActivity');
    sessionStorage.removeItem('sessionId');
    
    console.log('🛑 Session tracking stopped');
}

// ===========================================
// GENERATE SESSION ID
// ===========================================
function generateSessionId() {
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('sessionId', sessionId);
    return sessionId;
}

// ===========================================
// RESET INACTIVITY TIMER
// ===========================================
function resetInactivityTimer() {
    if (!userLoggedIn) return;
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    const now = Date.now();
    localStorage.setItem('lastActivity', now.toString());
    sessionStorage.setItem('lastActivity', now.toString());
    
    inactivityTimer = setTimeout(() => {
        console.log('⏰ Session timeout due to inactivity');
        logoutUser();
    }, INACTIVITY_TIMEOUT);
    
    // Update session status display if exists
    updateSessionStatusDisplay();
}

// ===========================================
// HANDLE TAB VISIBILITY CHANGE
// ===========================================
function handleVisibilityChange() {
    if (!userLoggedIn) return;
    
    if (document.hidden) {
        // Tab hidden - store time
        sessionStorage.setItem('tabHiddenTime', Date.now().toString());
        console.log('👁️ Tab hidden at:', new Date().toLocaleTimeString());
        
        // Pause timer (will resume when visible)
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
    } else {
        // Tab visible again
        const hiddenTime = sessionStorage.getItem('tabHiddenTime');
        if (hiddenTime) {
            const timeAway = Date.now() - parseInt(hiddenTime);
            console.log(`👁️ Tab visible again. Away for: ${Math.floor(timeAway / 1000)} seconds`);
            
            if (timeAway >= INACTIVITY_TIMEOUT) {
                console.log('⚠️ Session expired while tab was hidden');
                logoutUser();
            } else {
                resetInactivityTimer();
            }
            sessionStorage.removeItem('tabHiddenTime');
        } else {
            resetInactivityTimer();
        }
    }
}

// ===========================================
// CHECK SESSION HEALTH
// ===========================================
function checkSessionHealth() {
    if (!userLoggedIn) return;
    
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
            console.log('⚠️ Session health check failed - timeout');
            logoutUser();
        }
    }
}

// ===========================================
// UPDATE SESSION IN FIREBASE
// ===========================================
async function updateSessionInFirebase(user) {
    try {
        if (!user) return;
        
        // Update user's last active timestamp in Firestore
        await firebase.firestore().collection('users').doc(user.uid).set({
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            sessionId: sessionStorage.getItem('sessionId') || generateSessionId(),
            ipAddress: await getClientIP()
        }, { merge: true });
        
        console.log('📡 Session info saved to Firebase');
    } catch (error) {
        console.error('Failed to update session in Firebase:', error);
    }
}

// ===========================================
// GET CLIENT IP (Simple version)
// ===========================================
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
}

// ===========================================
// UPDATE SESSION STATUS DISPLAY
// ===========================================
function updateSessionStatusDisplay() {
    const lastActivity = localStorage.getItem('lastActivity');
    if (!lastActivity) return;
    
    const timeSince = Math.floor((Date.now() - parseInt(lastActivity)) / 1000);
    const remaining = Math.max(0, (INACTIVITY_TIMEOUT / 1000) - timeSince);
    
    const statusBar = document.getElementById('session-status');
    if (statusBar) {
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        statusBar.innerHTML = `⏱️ Session expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (remaining < 60) {
            statusBar.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
        } else if (remaining < 120) {
            statusBar.style.backgroundColor = 'rgba(245, 158, 11, 0.8)';
        } else {
            statusBar.style.backgroundColor = 'rgba(0,0,0,0.7)';
        }
    }
}

// ===========================================
// ADD SESSION STATUS BAR (Optional)
// ===========================================
function addSessionStatusBar() {
    // Check if already exists
    if (document.getElementById('session-status')) return;
    
    const statusBar = document.createElement('div');
    statusBar.id = 'session-status';
    statusBar.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: rgba(0,0,0,0.7);
        color: #ccc;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 11px;
        z-index: 9999;
        font-family: monospace;
        cursor: pointer;
        backdrop-filter: blur(5px);
        transition: all 0.3s ease;
    `;
    statusBar.innerHTML = '🔐 Session active';
    statusBar.onclick = () => {
        resetInactivityTimer();
        showSessionToast('Session timer reset', 'info');
    };
    document.body.appendChild(statusBar);
    
    // Update status bar every second
    setInterval(updateSessionStatusDisplay, 1000);
}

// ===========================================
// SHOW SESSION TOAST
// ===========================================
function showSessionToast(message, type) {
    const existing = document.querySelector('.session-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'session-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 12px 20px;
        border-radius: 12px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        animation: fadeInUp 0.3s ease;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

// ===========================================
// SETUP ACTIVITY LISTENERS
// ===========================================
function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];
    
    events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
        document.addEventListener(event, resetInactivityTimer);
    });
    
    window.removeEventListener('focus', resetInactivityTimer);
    window.addEventListener('focus', resetInactivityTimer);
    
    console.log('👆 Activity listeners set up');
}

// ===========================================
// LOGOUT USER
// ===========================================
async function logoutUser() {
    try {
        console.log('🔓 Logging out user...');
        
        // Clear timers
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
        
        // Clear storage
        localStorage.removeItem('glico_logged_in');
        localStorage.removeItem('lastActivity');
        localStorage.removeItem('user_email');
        sessionStorage.removeItem('sessionId');
        sessionStorage.removeItem('lastActivity');
        sessionStorage.removeItem('tabHiddenTime');
        
        // Sign out from Firebase
        const auth = firebase.auth();
        if (auth.currentUser) {
            await auth.signOut();
        }
        
        userLoggedIn = false;
        
        // Redirect to login
        const isPublicPage = publicPages.some(page => currentPage.includes(page));
        if (!isPublicPage && !currentPage.includes('login.html')) {
            window.location.href = 'login.html?reason=session_expired';
        }
        
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'login.html';
    }
}

// ===========================================
// CLEAR SESSION (without redirect)
// ===========================================
function clearSession() {
    localStorage.removeItem('glico_logged_in');
    localStorage.removeItem('lastActivity');
    sessionStorage.clear();
    userLoggedIn = false;
}

// ===========================================
// ===========================================
// MAGIC LINK FUNCTIONS
// ===========================================
// ===========================================

// Generate magic link token
async function generateMagicLink(email, redirectUrl) {
    const token = 'ml_' + Date.now() + '_' + Math.random().toString(36).substr(2, 32);
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour expiry
    
    try {
        await firebase.firestore().collection('magicLinks').doc(token).set({
            email: email,
            redirectUrl: redirectUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            used: false
        });
        
        return `https://glicocapital.online/login.html?token=${token}&redirect=${encodeURIComponent(redirectUrl)}`;
    } catch (error) {
        console.error('Error generating magic link:', error);
        return null;
    }
}

// Check and validate magic link on page load
async function checkMagicLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const redirect = urlParams.get('redirect');
    const reason = urlParams.get('reason');
    
    // Check for session expired reason
    if (reason === 'session_expired') {
        showSessionToast('Session expired. Please login again.', 'warning');
        // Remove from URL without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
    
    if (token) {
        sessionStorage.setItem('magicLinkPending', 'true');
        
        try {
            const tokenDoc = await firebase.firestore().collection('magicLinks').doc(token).get();
            
            if (tokenDoc.exists && !tokenDoc.data().used && tokenDoc.data().expiresAt > Date.now()) {
                // Mark as used
                await tokenDoc.ref.update({ 
                    used: true, 
                    usedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    usedIp: await getClientIP()
                });
                
                const email = tokenDoc.data().email;
                const redirectUrl = tokenDoc.data().redirectUrl || 'dashboard.html';
                
                // Store email for sign in
                localStorage.setItem('emailForSignIn', email);
                
                // Send sign-in link via Firebase
                await firebase.auth().sendSignInLinkToEmail(email, {
                    url: `https://glicocapital.online/${redirectUrl}`,
                    handleCodeInApp: true
                });
                
                showSessionToast('Magic link sent! Check your email.', 'success');
                
                // Clear URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                
                setTimeout(() => {
                    sessionStorage.removeItem('magicLinkPending');
                }, 5000);
                
            } else if (tokenDoc.exists && tokenDoc.data().used) {
                showSessionToast('This link has already been used. Please login manually.', 'error');
            } else if (tokenDoc.exists && tokenDoc.data().expiresAt <= Date.now()) {
                showSessionToast('This link has expired. Please request a new one.', 'error');
            } else {
                showSessionToast('Invalid magic link. Please login manually.', 'error');
            }
            
        } catch (error) {
            console.error('Magic link error:', error);
            showSessionToast('Error processing magic link. Please login manually.', 'error');
        } finally {
            sessionStorage.removeItem('magicLinkPending');
        }
    }
}

// Complete sign-in from magic link
async function completeSignIn() {
    if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
        let email = localStorage.getItem('emailForSignIn');
        
        if (!email) {
            email = window.prompt('Please enter your email to confirm sign-in');
        }
        
        if (email) {
            try {
                const result = await firebase.auth().signInWithEmailLink(email, window.location.href);
                localStorage.removeItem('emailForSignIn');
                
                // Get redirect URL
                const urlParams = new URLSearchParams(window.location.search);
                const redirect = urlParams.get('redirect') || 'dashboard.html';
                
                showSessionToast('Sign in successful! Redirecting...', 'success');
                
                setTimeout(() => {
                    window.location.href = redirect;
                }, 1500);
                
            } catch (error) {
                console.error('Error completing sign-in:', error);
                showSessionToast('Error signing in. Please try again.', 'error');
            }
        }
    }
}

// ===========================================
// ADD STYLES FOR TOAST
// ===========================================
function addToastStyles() {
    if (document.getElementById('session-toast-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'session-toast-styles';
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes fadeOut {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-10px);
            }
        }
    `;
    document.head.appendChild(style);
}

// ===========================================
// UPDATE EXISTING LOGOUT BUTTONS
// ===========================================
function enhanceLogoutButtons() {
    // Find any existing logout buttons and ensure they use our logout function
    const logoutButtons = document.querySelectorAll('#logoutBtn, .logout-btn, [onclick="logout()"]');
    logoutButtons.forEach(btn => {
        if (btn.id === 'logoutBtn' || btn.classList.contains('logout-btn')) {
            btn.onclick = async (e) => {
                e.preventDefault();
                await logoutUser();
            };
        }
    });
}

// ===========================================
// INITIALIZE WHEN DOM IS READY
// ===========================================
document.addEventListener('DOMContentLoaded', async () => {
    addToastStyles();
    await initSessionManager();
    await checkMagicLink();
    await completeSignIn();
    enhanceLogoutButtons();
    
    // Add status bar to protected pages only
    const isPublicPage = publicPages.some(page => currentPage.includes(page));
    if (!isPublicPage && userLoggedIn) {
        addSessionStatusBar();
    }
    
    console.log('✅ Session manager fully loaded');
});

// ===========================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ===========================================
window.sessionManager = {
    logout: logoutUser,
    resetTimer: resetInactivityTimer,
    generateMagicLink: generateMagicLink,
    isLoggedIn: () => userLoggedIn
};

// Make logout available globally
window.logout = logoutUser;
