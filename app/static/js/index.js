// Preload map removed — it was creating a hidden second map instance that
// wasted API calls. The game page creates its own map when needed.

document.addEventListener('DOMContentLoaded', function () {
    var sidebar = document.getElementById('friends-sidebar');
    var toggle = document.getElementById('friends-toggle');
    var closeButton = document.getElementById('friends-close');
    var backdrop = document.getElementById('friends-backdrop');
    var navFriends = document.getElementById('sidebar-nav-friends');
    var navInvites = document.getElementById('sidebar-nav-invites');
    var navChallenges = document.getElementById('sidebar-nav-challenges');
    var friendsSection = document.getElementById('friends-list-section');
    var invitesSection = document.getElementById('pending-invites-section');
    var challengesSection = document.getElementById('challenges-section');

    if (!sidebar || !toggle || !closeButton || !backdrop ||
        !navFriends || !navInvites || !navChallenges ||
        !friendsSection || !invitesSection || !challengesSection) {
        return;
    }

    function setActiveNav(activeButton) {
        [navFriends, navInvites, navChallenges].forEach(function (button) {
            button.classList.toggle('active', button === activeButton);
        });
    }

    function openSidebar() {
        sidebar.classList.add('open');
        backdrop.classList.add('active');
        sidebar.setAttribute('aria-hidden', 'false');
        toggle.classList.add('hidden');
        if(typeof loadFriends === 'function') loadFriends();
        if(typeof loadPendingRequests === 'function') loadPendingRequests();
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
        sidebar.setAttribute('aria-hidden', 'true');
        toggle.classList.remove('hidden');
    }

    toggle.addEventListener('click', openSidebar);
    closeButton.addEventListener('click', closeSidebar);
    backdrop.addEventListener('click', closeSidebar);
    navFriends.addEventListener('click', function () {
        friendsSection.classList.remove('section-hidden');
        invitesSection.classList.add('section-hidden');
        challengesSection.classList.add('section-hidden');
        setActiveNav(navFriends);
    });
    navInvites.addEventListener('click', function () {
        invitesSection.classList.remove('section-hidden');
        friendsSection.classList.add('section-hidden');
        challengesSection.classList.add('section-hidden');
        setActiveNav(navInvites);
    });
    navChallenges.addEventListener('click', function () {
        challengesSection.classList.remove('section-hidden');
        friendsSection.classList.add('section-hidden');
        invitesSection.classList.add('section-hidden');
        setActiveNav(navChallenges);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
});