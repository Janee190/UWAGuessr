$(function () {
    $.ajax({
        url: '/api/dashboard-stats',
        method: 'GET',
        success: function (data) {
            $('#totalGames').text(data.total_games || '0');
            $('#bestScore').text(
                data.best_score !== null
                    ? data.best_score.toLocaleString() + ' pts'
                    : '—'
            );
            
            const container = $('#recentScores');
            if (data.recent_games.length === 0) {
                container.html(`
                    <div class="empty-state">
                        <p class="text-muted-light">No games played yet.</p>
                        <a href="/game" class="btn btn-outline-warning btn-sm bangers-font">
                            Play your first game!
                        </a>
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
    // Load friends list
    $.ajax({
        url: '/api/friends',
        method: 'GET',
        success: function (friends) {
            const container = $('#friendsList');
            if (friends.length === 0) {
                container.html(`
                    <div class="empty-state">
                        <p class="text-muted-light">No friends added yet.</p>
                        <a href="/" class="btn btn-outline-warning btn-sm bangers-font">
                            Find Friends
                        </a>
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
                            <span class="stat-value">${f.username}</span>
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

    // Load friends leaderboard
    $.ajax({
        url: '/api/friends',
        method: 'GET',
        success: function (friends) {
            // Add current user to the list
            const everyone = [...friends, CURRENT_USER];
            const sorted = everyone.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

            let html = '';
            sorted.forEach(function (f, i) {
                const isMe = f.username === CURRENT_USER.username;
                html += `
                    <tr ${isMe ? 'style="color: var(--golden);"' : ''}>
                        <td><span class="fw-bold">#${i + 1}</span></td>
                        <td>${f.username}${isMe ? ' (you)' : ''}</td>
                        <td class="text-end">${f.total_score ? f.total_score.toLocaleString() : '0'} pts</td>
                    </tr>
                `;
            });
            $('table tbody').html(html);
        }
    });
});