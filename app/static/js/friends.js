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
                                <div class="friend-card__name">${f.username}</div>
                                <div class="friend-card__label">${f.total_score ? f.total_score.toLocaleString() + ' pts' : 'No score yet'}</div>
                            </div>
                            <button class="btn btn-warning btn-sm challenge-invite-btn ms-auto" data-uid="${f.uid}" style="padding: 2px 8px; font-size: 0.8rem;">
                                Challenge
                            </button>
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
                const section = $('#pending-invites-section');
                section.find('.pending-card').remove();
                
                // Track invites and challenge notifications separately for badges
                let friendRequestsCount = requests.length;

                if (requests.length === 0) {
                    section.find('p.no-requests').remove();
                    section.append('<p class="text-muted-light small mt-2 no-requests">No pending friend requests.</p>');
                } else {
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

                // Now load game challenges
                $.ajax({
                    url: '/api/challenges/active',
                    method: 'GET',
                    success: function (challenges) {
                        const challengeSection = $('#challenges-section');
                        challengeSection.find('.challenge-card').remove();
                        challengeSection.find('p.no-challenges').remove();

                        const pendingIncoming = challenges.filter(c => c.status === 'pending' && c.challenged_id === current_user_id);
                        const myActive = challenges.filter(c => c.status !== 'pending' || c.challenger_id === current_user_id);

                        // Update badges: friends toggle shows total (invites + incoming challenges),
                        // invites nav shows friend request count, challenges nav shows incoming challenges
                        updateBadges(friendRequestsCount, pendingIncoming.length);

                        if (challenges.length === 0) {
                            challengeSection.append('<p class="text-muted-light small mt-2 no-challenges">No active challenges.</p>');
                            return;
                        }

                        challenges.forEach(function (c) {
                            const isChallenger = c.challenger_id === current_user_id;
                            const opponent = isChallenger ? c.challenged_username : c.challenger_username;
                            const initials = opponent.substring(0, 2).toUpperCase();
                            
                            let statusText = '';
                            let actionHtml = '';

                            if (c.status === 'pending') {
                                if (isChallenger) {
                                    statusText = 'Waiting for friend...';
                                    actionHtml = `<span class="text-muted small">Sent</span>`;
                                } else {
                                    statusText = 'Challenged you!';
                                    actionHtml = `
                                        <div class="d-flex gap-2 mt-1">
                                            <button class="btn btn-warning btn-sm challenge-accept-btn" data-id="${c.id}" style="padding: 2px 8px; font-size: 0.8rem;">Accept</button>
                                            <button class="btn btn-outline-light btn-sm challenge-reject-btn" data-id="${c.id}" style="padding: 2px 8px; font-size: 0.8rem;">Decline</button>
                                        </div>
                                    `;
                                }
                            } else if (c.status === 'ready_waiting' || c.status === 'in_progress') {
                                statusText = 'Game in progress!';
                                actionHtml = `<button class="btn btn-warning btn-sm challenge-play-btn" data-id="${c.id}" style="padding: 2px 8px; font-size: 0.8rem;">Enter Game</button>`;
                            }

                            challengeSection.append(`
                                <div class="pending-card challenge-card" data-id="${c.id}">
                                    <div class="pending-card__avatar" style="background: #ffc107; color: #000;">${initials}</div>
                                    <div class="pending-card__meta">
                                        <div class="pending-card__title">${opponent}</div>
                                        <div class="small text-muted-light">${statusText}</div>
                                        ${actionHtml}
                                    </div>
                                </div>
                            `);
                        });
                    }
                });
            }
        });
    }
    
    function updateBadges(inviteCount, challengeCount) {
        const toggleBadge = $('#friends-toggle-badge');
        const invitesBadge = $('#invites-nav-badge');
        const challengesBadge = $('#challenges-nav-badge');

        const total = (inviteCount || 0) + (challengeCount || 0);

        if (total > 0) {
            toggleBadge.text(total > 9 ? '9+' : total).show();
        } else {
            toggleBadge.hide();
        }

        if ((inviteCount || 0) > 0) {
            invitesBadge.text(inviteCount > 9 ? '9+' : inviteCount).show();
        } else {
            invitesBadge.hide();
        }

        if ((challengeCount || 0) > 0) {
            challengesBadge.text(challengeCount > 9 ? '9+' : challengeCount).show();
        } else {
            challengesBadge.hide();
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
                            btnHtml = '<span class="text-muted small">Requested</span>';
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
                                    <div class="friend-card__name">${u.username}</div>
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

    // ── Challenge Logic ──────────────────────────────────────────────
    $(document).on('click', '.challenge-invite-btn', function () {
        const uid = $(this).data('uid');
        const $btn = $(this);
        $btn.prop('disabled', true).text('Inviting...');

        $.ajax({
            url: '/api/challenges/create',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ uid: uid }),
            success: function (data) {
                if (data.redirect) {
                    window.location.href = data.redirect;
                    return;
                }
                $btn.text('Sent!').addClass('btn-success').removeClass('btn-warning');
                loadPendingRequests(); // Refresh Active Challenges list
            },
            error: function (xhr) {
                $btn.prop('disabled', false).text('Challenge');
                alert(xhr.responseJSON?.error || 'Something went wrong');
            }
        });
    });

    $(document).on('click', '.challenge-accept-btn', function () {
        const id = $(this).data('id');
        const $btn = $(this);
        $btn.prop('disabled', true);

        $.ajax({
            url: '/api/challenges/respond',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ id: id, action: 'accept' }),
            success: function (data) {
                window.location.href = `/game?challengeId=${id}`;
            },
            error: function (xhr) {
                $btn.prop('disabled', false);
                alert(xhr.responseJSON?.error || 'This challenge is no longer available');
                loadPendingRequests(); // Refresh to remove expired challenges
            }
        });
    });

    $(document).on('click', '.challenge-reject-btn', function () {
        const id = $(this).data('id');
        const $card = $(this).closest('.challenge-card');

        $.ajax({
            url: '/api/challenges/respond',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ id: id, action: 'reject' }),
            success: function () {
                $card.remove();
            }
        });
    });

    $(document).on('click', '.challenge-play-btn', function () {
        const id = $(this).data('id');
        window.location.href = `/game?challengeId=${id}`;
    });

    // ── Refresh button ─────────────────────────────────────────────
    $('#friends-refresh').on('click', function () {
        loadFriends();
        loadPendingRequests();
    });

    // ── Initial load if sidebar is already open ───────────────────────
    loadFriends();
    loadPendingRequests();

    // Auto-refresh challenges every 10 seconds while sidebar is open
    setInterval(function() {
        if ($('#friends-sidebar').hasClass('open')) {
            loadPendingRequests();
        }
    }, 10000);
});