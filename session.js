// AUTO LOGOUT AFTER INACTIVITY (5 minutes)
const MAX_INACTIVE_TIME = 300000; // 5 minutes
let logoutTimer;

// RESET TIMER WHEN USER IS ACTIVE
function resetLogoutTimer() {
    clearTimeout(logoutTimer);
    logoutTimer = setTimeout(forceLogout, MAX_INACTIVE_TIME);
}

// FORCE LOGOUT
function forceLogout() {
    // Clears local session storage
    localStorage.removeItem("isLoggedIn");

    // If Firebase auth exists, sign out
    if (window.firebase && firebase.auth) {
        firebase.auth().signOut().catch((error) => {
            console.error("Firebase sign-out error:", error);
        });
    }

    // Redirect back to login page
    window.location.href = "index.html";
}

// BLOCK ACCESS IF USER IS NOT LOGGED IN
function checkIfLoggedIn() {
    if (!localStorage.getItem("isLoggedIn")) {
        forceLogout();
    }
}

// EVENTS THAT KEEP SESSION ALIVE
window.onload = () => {
    checkIfLoggedIn();
    resetLogoutTimer();
};

document.onmousemove = resetLogoutTimer;
document.onkeypress = resetLogoutTimer;
document.onclick = resetLogoutTimer;
document.onscroll = resetLogoutTimer;
