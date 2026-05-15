$(function () {

    // ── Load friends list ─────────────────────────────────────────────
    function loadFriends() {
        $.ajax({
            url: '/api/friends',
            method: 'GET',
            success: function (friends) {
                const section = $('#friends-list-section');
                const heading = section.find('.section-heading');
                section.find('.friend-card').remove();

                if (friends.length === 0) {
                    section.append('<p class="text-muted-light small mt-2">No friends yet. Search for players to add!</p>');
                    return;
                }

                friends.forEach(function (f) {
                    const initials = f.username.substring(0, 2).toUpperCase();
                    section.append(`
                        <div class="friend-card">
                            <div class="friend-card__avatar">${initials}</div>
                            <div class="friend-card__meta">
                                <a href="/user/${f.username}" class="friend-card__name" style="color:var(--text-light);text-decoration:none;">
                                    ${f.username}
                                </a>
                                <div class="friend-card__label">${f.total_score ? f.total_score.toLocaleString() + ' pts' : 'No score yet'}</div>
                            </div>
                        </div>
                    `);
                });
            }
        });
    }

    // ── Load pending requests ─────────────────────────────────────────
    function loadPendingRequests() {
        $.ajax({
            url: '/api/friends/requests',
            method: 'GET',
            success: function (requests) {
                updateBadges(requests.length);
                const section = $('#pending-invites-section');
                section.find('.pending-card').remove();
                const heading = section.find('.section-heading');

                if (requests.length === 0) {
                    section.find('p.no-requests').remove();
                    section.append('<p class="text-muted-light small mt-2 no-requests">No pending requests.</p>');
                    return;
                }

                section.find('p.no-requests').remove();
                requests.forEach(function (r) {
                    const initials = r.username.substring(0, 2).toUpperCase();
                    section.append(`
                        <div class="pending-card" data-id="${r.id}">
                            <div class="pending-card__avatar">${initials}</div>
                            <div class="pending-card__meta">
                                <div class="pending-card__title">${r.username}</div>
                                <div class="d-flex gap-2 mt-1">
                                    <button class="btn btn-warning btn-sm bangers-font accept-btn" data-id="${r.id}">Accept</button>
                                    <button class="btn btn-outline-light btn-sm bangers-font reject-btn" data-id="${r.id}">Reject</button>
                                </div>
                            </div>
                        </div>
                    `);
                });
            }
        });
    }
    
    function updateBadges(count) {
        const toggleBadge = $('#friends-toggle-badge');
        const navBadge = $('#invites-nav-badge');
        
        if (count > 0) {
            toggleBadge.text(count > 9 ? '9+' : count).show();
            navBadge.text(count > 9 ? '9+' : count).show();
        } else {
            toggleBadge.hide();
            navBadge.hide();
        }
    }

    // ── Search users ──────────────────────────────────────────────────
    let searchTimeout;
    $('#friends-search').on('input', function () {
        clearTimeout(searchTimeout);
        const query = $(this).val().trim();

        if (query.length < 2) {
            $('#search-results').remove();
            return;
        }

        searchTimeout = setTimeout(function () {
            $.ajax({
                url: '/api/friends/search?q=' + encodeURIComponent(query),
                method: 'GET',
                success: function (users) {
                    $('#search-results').remove();
                    if (users.length === 0) return;

                    let html = '<div id="search-results">';
                    users.forEach(function (u) {
                        let btnHtml = '';
                        if (u.friendship_status === 'friends') {
                            btnHtml = '<span class="text-muted small">Friends</span>';
                        } else if (u.friendship_status === 'sent') {
                            btnHtml = '<span class="badge" style="background:rgba(255,202,44,0.2);color:var(--golden);border:1px solid var(--golden);border-radius:0.5rem;padding:0.25rem 0.5rem;font-size:0.75rem;">⏳ Invite Sent</span>';
                        } else if (u.friendship_status === 'received') {
                            btnHtml = '<span class="text-muted small">Wants to add you</span>';
                        } else {
                            btnHtml = `<button class="btn btn-warning btn-sm bangers-font add-friend-btn" data-uid="${u.uid}">Add</button>`;
                        }

                        const initials = u.username.substring(0, 2).toUpperCase();
                        html += `
                            <div class="friend-card mt-2">
                                <div class="friend-card__avatar">${initials}</div>
                                <div class="friend-card__meta">
                                    <a href="/user/${u.username}" class="friend-card__name" style="color:var(--text-light);text-decoration:none;">${u.username}</a>
                                    <div>${btnHtml}</div>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    $('#friends-search').after(html);
                }
            });
        }, 400);
    });

    // ── Add friend button (from search results) ───────────────────────
    $(document).on('click', '.add-friend-btn', function () {
        const uid = $(this).data('uid');
        const $btn = $(this);
        $btn.prop('disabled', true).text('Sending...');

        $.ajax({
            url: '/api/friends/add',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ uid: uid }),
            success: function () {
                $btn.text('Requested').prop('disabled', true);
            },
            error: function (xhr) {
                $btn.prop('disabled', false).text('Add');
                alert(xhr.responseJSON?.error || 'Something went wrong');
            }
        });
    });

    // ── Accept/Reject friend requests ─────────────────────────────────
    $(document).on('click', '.accept-btn, .reject-btn', function () {
        const id = $(this).data('id');
        const action = $(this).hasClass('accept-btn') ? 'accept' : 'reject';
        const $card = $(this).closest('.pending-card');

        $.ajax({
            url: '/api/friends/respond',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ id: id, action: action }),
            success: function () {
                $card.remove();
                if (action === 'accept') loadFriends();
            }
        });
    });

    // ── Sidebar open: load data ───────────────────────────────────────
    $('#friends-toggle').on('click', function () {
        loadFriends();
        loadPendingRequests();
    });

    // ── Initial load if sidebar is already open ───────────────────────
    loadFriends();
    loadPendingRequests();
});