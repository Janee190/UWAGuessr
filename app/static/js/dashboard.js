$(function () {

    function getCSRFToken() {
        return $('meta[name="csrf-token"]').attr('content');
    }

    // ── Dashboard Stats ───────────────────────────────────────────────
    const statsUrl = IS_OWN_PROFILE
        ? '/api/dashboard-stats'
        : '/api/user-stats/' + VIEWED_UID;

    $.ajax({
        url: statsUrl,
        method: 'GET',
        success: function (data) {
            $('#totalGames').text(data.total_games || '0');
            $('#bestScore').text(
                data.best_score !== null && data.best_score !== undefined
                    ? data.best_score.toLocaleString() + ' pts'
                    : '—'
            );

            const container = $('#recentScores');
            if (!data.recent_games || data.recent_games.length === 0) {
                container.html(`
                    <div class="empty-state">
                        <p class="text-muted-light">No games played yet.</p>
                        ${IS_OWN_PROFILE ? '<a href="/game" class="btn btn-outline-warning btn-sm bangers-font">Play your first game!</a>' : ''}
                    </div>
                `);
                return;
            }

            let html = '';
            data.recent_games.forEach(function (g) {
                html += `
                    <div class="profile-stat mb-2">
                        <span class="stat-label">${g.timestamp}</span>
                        <span class="stat-value">${g.score.toLocaleString()} pts</span>
                    </div>
                `;
            });
            container.html(html);
        },
        error: function () {
            $('#totalGames').text('—');
            $('#bestScore').text('—');
        }
    });

    // ── Friends List (own dashboard only) ─────────────────────────────
    if (IS_OWN_PROFILE) {
        $.ajax({
            url: '/api/friends',
            method: 'GET',
            success: function (friends) {
                const container = $('#friendsList');
                if (friends.length === 0) {
                    container.html(`
                        <div class="empty-state">
                            <p class="text-muted-light">No friends added yet.</p>
                            <a href="/" class="btn btn-outline-warning btn-sm bangers-font">Find Friends</a>
                        </div>
                    `);
                    return;
                }

                let html = '';
                friends.forEach(function (f) {
                    const initials = f.username.substring(0, 2).toUpperCase();
                    html += `
                        <div class="profile-stat mb-2">
                            <div class="d-flex align-items-center gap-2">
                                <div class="avatar-circle" style="width:2rem;height:2rem;font-size:0.8rem;">
                                    ${initials}
                                </div>
                                <a href="/user/${f.username}" class="stat-value" style="color:var(--text-light);text-decoration:none;">
                                    ${f.username}
                                </a>
                            </div>
                            <span class="stat-label">${f.total_score ? f.total_score.toLocaleString() + ' pts' : '0 pts'}</span>
                        </div>
                    `;
                });
                container.html(html);
            },
            error: function () {
                $('#friendsList').html('<p class="text-muted-light small">Failed to load friends.</p>');
            }
        });

        // ── Friends Leaderboard ───────────────────────────────────────
        $.ajax({
            url: '/api/friends',
            method: 'GET',
            success: function (friends) {
                const everyone = [...friends, CURRENT_USER];
                const sorted = everyone.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

                let html = '';
                sorted.forEach(function (f, i) {
                    const isMe = f.username === CURRENT_USER.username;
                    const nameLink = isMe
                        ? `${f.username} (you)`
                        : `<a href="/user/${f.username}" style="color:inherit;text-decoration:none;">${f.username}</a>`;
                    html += `
                        <tr ${isMe ? 'style="color: var(--golden);"' : ''}>
                            <td><span class="fw-bold">#${i + 1}</span></td>
                            <td>${nameLink}</td>
                            <td class="text-end">${f.total_score ? f.total_score.toLocaleString() : '0'} pts</td>
                        </tr>
                    `;
                });
                $('table tbody').html(html);
            }
        });
    }

    // ── Add Friend button (on other user's profile) ───────────────────
    $('#add-friend-btn').on('click', function () {
        const uid = $(this).data('uid');
        const $btn = $(this);
        $btn.prop('disabled', true).text('Sending...');

        $.ajax({
            url: '/api/friends/add',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'X-CSRFToken': getCSRFToken() },
            data: JSON.stringify({ uid: uid }),
            success: function () {
                $btn.text('Request Sent!').removeClass('btn-warning').addClass('btn-outline-warning');
            },
            error: function (xhr) {
                const msg = xhr.responseJSON?.error || 'Something went wrong';
                if (msg.includes('already exists')) {
                    $btn.text('Already Friends').prop('disabled', true);
                } else {
                    $btn.prop('disabled', false).text('Add Friend');
                    alert(msg);
                }
            }
        });
    });
});