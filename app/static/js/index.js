// Preload map removed — it was creating a hidden second map instance that
// wasted API calls. The game page creates its own map when needed.

document.addEventListener("DOMContentLoaded", function () {
  let sidebar = document.getElementById("friends-sidebar");
  let toggle = document.getElementById("friends-toggle");
  let closeButton = document.getElementById("friends-close");
  let backdrop = document.getElementById("friends-backdrop");
  let navFriends = document.getElementById("sidebar-nav-friends");
  let navInvites = document.getElementById("sidebar-nav-invites");
  let navChallenges = document.getElementById("sidebar-nav-challenges");
  let friendsSection = document.getElementById("friends-list-section");
  let invitesSection = document.getElementById("pending-invites-section");
  let challengesSection = document.getElementById("challenges-section");

  if (
    !sidebar ||
    !toggle ||
    !closeButton ||
    !backdrop ||
    !navFriends ||
    !navInvites ||
    !navChallenges ||
    !friendsSection ||
    !invitesSection ||
    !challengesSection
  ) {
    return;
  }

  function setActiveNav(activeButton) {
    [navFriends, navInvites, navChallenges].forEach(function (button) {
      button.classList.toggle("active", button === activeButton);
    });
  }

  function openSidebar() {
    sidebar.classList.add("open");
    backdrop.classList.add("active");
    sidebar.setAttribute("aria-hidden", "false");
    toggle.classList.add("hidden");
    if (typeof loadFriends === "function") loadFriends();
    if (typeof loadPendingRequests === "function") loadPendingRequests();
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    backdrop.classList.remove("active");
    sidebar.setAttribute("aria-hidden", "true");
    toggle.classList.remove("hidden");
  }

  function clearSearch() {
    let results = document.getElementById('search-results');
    let input = document.getElementById('friends-search');
    if (results) results.remove();
    if (input) input.value = '';
  }

  toggle.addEventListener('click', openSidebar);
  closeButton.addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  navFriends.addEventListener('click', function () {
    friendsSection.classList.remove('section-hidden');
    invitesSection.classList.add('section-hidden');
    challengesSection.classList.add('section-hidden');
    setActiveNav(navFriends);
    clearSearch();
  });
  navInvites.addEventListener('click', function () {
    invitesSection.classList.remove('section-hidden');
    friendsSection.classList.add('section-hidden');
    challengesSection.classList.add('section-hidden');
    setActiveNav(navInvites);
    clearSearch();
  });
  navChallenges.addEventListener('click', function () {
    challengesSection.classList.remove('section-hidden');
    friendsSection.classList.add('section-hidden');
    invitesSection.classList.add('section-hidden');
    setActiveNav(navChallenges);
    clearSearch();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && sidebar.classList.contains("open")) {
      closeSidebar();
    }
  });
});
