import math
from datetime import datetime, timedelta

import pytest

from app import db
from app.models import User, Photos, Challenge, Friendship, GameResult
from app.game.game_logic import calculate_score, calculate_haversine, get_game_images
from app.controllers import add_score

from tests.conftest import login_as, _make_user, _make_photo


# ═══════════════════════════════════════════════════════════════════════════
# 1. Scoring Engine
# ═══════════════════════════════════════════════════════════════════════════

class TestScoringEngine:

    def test_perfect_score_at_exact_location(self, photo):
        score, distance, lat, lng = calculate_score(
            photo.latitude, photo.longitude, photo.pid
        )
        assert score == 5000
        assert distance == pytest.approx(0.0, abs=0.5)
        assert lat == photo.latitude
        assert lng == photo.longitude

    def test_full_score_within_10_meters(self, photo):
        # ~5 m north of photo: 5 / 111_320 ≈ 0.000045 degrees
        offset = 5 / 111_320
        score, distance, _, _ = calculate_score(
            photo.latitude + offset, photo.longitude, photo.pid
        )
        assert score == 5000
        assert distance == pytest.approx(5.0, abs=1)

    def test_score_decay_at_200_meters(self, photo):
        # 200 m north: 200 / 111_320 ≈ 0.0018 degrees
        # Expected: 5000 * exp(-0.005 * 190) ≈ 1934
        offset = 0.0018
        score, distance, _, _ = calculate_score(
            photo.latitude + offset, photo.longitude, photo.pid
        )
        assert 1600 < score < 2200
        assert 180 < distance < 220

    def test_score_near_zero_at_2km(self, photo):
        offset = 0.018
        score, distance, _, _ = calculate_score(
            photo.latitude + offset, photo.longitude, photo.pid
        )
        assert 0 <= score < 50
        assert distance > 1900

    def test_score_clamped_to_zero(self, photo):
        score, distance, _, _ = calculate_score(0, 0, photo.pid)
        assert score == 0

    def test_invalid_img_id_returns_none(self, photo):
        score, distance, _, _ = calculate_score(
            photo.latitude, photo.longitude, 99999
        )
        assert score is None
        assert distance is None

    def test_non_numeric_img_id_returns_none(self, photo):
        score, distance, _, _ = calculate_score(
            photo.latitude, photo.longitude, "abc"
        )
        assert score is None

    def test_invalid_coordinates_returns_none(self, photo):
        assert calculate_score(200, 0, photo.pid)[0] is None
        assert calculate_score(-200, 0, photo.pid)[0] is None
        assert calculate_score(float("nan"), 0, photo.pid)[0] is None
        assert calculate_score(0, float("nan"), photo.pid)[0] is None

    def test_haversine_same_point_zero(self):
        d = calculate_haversine(-31.98, 115.81, -31.98, 115.81)
        assert d == 0.0

    def test_haversine_known_distance(self):
        # 0.001 degrees lat ≈ 111.2 m at the equator
        d = calculate_haversine(-31.98, 115.81, -31.981, 115.81)
        assert d == pytest.approx(111.2, rel=0.02)


# ═══════════════════════════════════════════════════════════════════════════
# 2. Game Images API  ─  GET /api/game-images
# ═══════════════════════════════════════════════════════════════════════════

class TestGameImagesAPI:

    def test_returns_5_random_images(self, client, ten_photos):
        resp = client.get("/api/game-images")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 5
        ids = [item["id"] for item in data]
        assert len(set(ids)) == 5

    def test_returns_fewer_when_less_than_5_photos(self, app):
        _make_photo(lat=-31.98, lng=115.81)
        _make_photo(lat=-31.99, lng=115.82)
        # Import the module-level app's test client
        from app import app as flask_app
        with flask_app.test_client() as c:
            resp = c.get("/api/game-images")
        assert resp.status_code == 200
        assert len(resp.get_json()) == 2

    def test_response_format(self, client, ten_photos):
        resp = client.get("/api/game-images")
        data = resp.get_json()
        for item in data:
            assert isinstance(item["id"], int)
            assert "/static/game/photos/" in item["imagePath"]

    def test_challenge_mode_filters_by_photo_ids(self, app, ten_photos, user, user2):
        # Create a friendship and challenge
        f = Friendship(requester_id=user.uid, receiver_id=user2.uid, status="accepted")
        db.session.add(f)
        expected_ids = [p.pid for p in ten_photos[2:7]]
        photo_ids_str = ",".join(str(pid) for pid in expected_ids)
        c = Challenge(
            challenger_id=user.uid,
            challenged_id=user2.uid,
            photo_ids=photo_ids_str,
            status="pending",
        )
        db.session.add(c)
        db.session.commit()

        from app import app as flask_app
        with flask_app.test_client() as client:
            resp = client.get(f"/api/game-images?challengeId={c.id}")
            assert resp.status_code == 200
            data = resp.get_json()
            returned_ids = [item["id"] for item in data]
            assert set(returned_ids) == set(expected_ids)

    def test_invalid_challenge_id(self, client):
        resp = client.get("/api/game-images?challengeId=99999")
        assert resp.status_code == 200
        # Returns empty list because the challenge doesn't exist
        data = resp.get_json()
        assert data == []

    def test_no_duplicate_photos(self, client, ten_photos):
        resp = client.get("/api/game-images")
        ids = [item["id"] for item in resp.get_json()]
        assert len(ids) == len(set(ids))


# ═══════════════════════════════════════════════════════════════════════════
# 3. Guess Submission API  ─  POST /api/guess
# ═══════════════════════════════════════════════════════════════════════════

class TestGuessAPI:

    def test_valid_guess_returns_score_and_distance(self, client, photo):
        resp = client.post("/api/guess", json={
            "lat": photo.latitude, "lng": photo.longitude, "id": photo.pid,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["score"] == 5000
        assert "distance" in data
        assert "actual_lat" in data
        assert "actual_lng" in data

    def test_missing_lat_returns_400(self, client, photo):
        resp = client.post("/api/guess", json={"lng": 115.81, "id": photo.pid})
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_missing_lng_returns_400(self, client, photo):
        resp = client.post("/api/guess", json={"lat": -31.98, "id": photo.pid})
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_missing_id_returns_400(self, client):
        resp = client.post("/api/guess", json={"lat": -31.98, "lng": 115.81})
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_invalid_img_id_returns_404(self, client):
        resp = client.post("/api/guess", json={
            "lat": -31.98, "lng": 115.81, "id": 99999,
        })
        assert resp.status_code == 404

    def test_guess_at_zero_zero(self, client, photo):
        resp = client.post("/api/guess", json={
            "lat": 0, "lng": 0, "id": photo.pid,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["score"] == 0

    def test_score_is_integer(self, client, photo):
        resp = client.post("/api/guess", json={
            "lat": photo.latitude + 0.01, "lng": photo.longitude, "id": photo.pid,
        })
        assert isinstance(resp.get_json()["score"], int)


# ═══════════════════════════════════════════════════════════════════════════
# 4. Game Complete API  ─  POST /api/game-complete
# ═══════════════════════════════════════════════════════════════════════════

class TestGameCompleteAPI:

    def test_saves_score_to_db(self, auth_client, user):
        resp = auth_client.post("/api/game-complete", json={"totalScore": 12000})
        assert resp.status_code == 200
        gr = GameResult.query.filter_by(user_id=user.uid).first()
        assert gr is not None
        assert gr.score == 12000

    def test_updates_user_total_score(self, auth_client, user):
        auth_client.post("/api/game-complete", json={"totalScore": 12000})
        # Re-fetch user from DB
        updated = User.query.get(user.uid)
        assert updated.total_score == 12000

    def test_rejects_negative_score(self, auth_client):
        resp = auth_client.post("/api/game-complete", json={"totalScore": -1})
        assert resp.status_code == 400

    def test_rejects_score_above_25000(self, auth_client):
        resp = auth_client.post("/api/game-complete", json={"totalScore": 25001})
        assert resp.status_code == 400
        assert "exceeds maximum" in resp.get_json()["error"]

    def test_rejects_missing_score(self, auth_client):
        resp = auth_client.post("/api/game-complete", json={})
        assert resp.status_code == 400

    def test_rejects_non_integer_score(self, auth_client):
        resp = auth_client.post("/api/game-complete", json={"totalScore": "abc"})
        assert resp.status_code == 400

    def test_unauthenticated_rejected(self, client):
        resp = client.post("/api/game-complete", json={"totalScore": 1000})
        assert resp.status_code == 302

    def test_accepts_boundary_score_0(self, auth_client):
        resp = auth_client.post("/api/game-complete", json={"totalScore": 0})
        assert resp.status_code == 200

    def test_accepts_boundary_score_25000(self, auth_client):
        resp = auth_client.post("/api/game-complete", json={"totalScore": 25000})
        assert resp.status_code == 200

    def test_game_result_timestamp_set(self, auth_client):
        auth_client.post("/api/game-complete", json={"totalScore": 1000})
        gr = GameResult.query.first()
        assert gr.timestamp is not None


# ═══════════════════════════════════════════════════════════════════════════
# 5. Challenge Create API  ─  POST /api/challenges/create
# ═══════════════════════════════════════════════════════════════════════════

class TestChallengeCreateAPI:

    def test_creates_challenge_with_valid_friend(self, auth_client, user, user2, friendship, ten_photos):
        resp = auth_client.post("/api/challenges/create", json={"uid": user2.uid})
        assert resp.status_code == 201
        data = resp.get_json()
        assert "challenge_id" in data
        c = Challenge.query.get(data["challenge_id"])
        assert c is not None
        assert c.status == "pending"
        assert c.challenger_id == user.uid
        assert c.challenged_id == user2.uid

    def test_rejects_non_friend(self, auth_client, user2):
        resp = auth_client.post("/api/challenges/create", json={"uid": user2.uid})
        assert resp.status_code == 403
        assert "only challenge friends" in resp.get_json()["error"]

    def test_rejects_missing_uid(self, auth_client):
        resp = auth_client.post("/api/challenges/create", json={})
        assert resp.status_code == 400

    def test_rejects_self_challenge(self, auth_client, user):
        resp = auth_client.post("/api/challenges/create", json={"uid": user.uid})
        assert resp.status_code == 403

    def test_duplicate_pending_returns_409(self, auth_client, user, user2, friendship, ten_photos):
        auth_client.post("/api/challenges/create", json={"uid": user2.uid})
        resp = auth_client.post("/api/challenges/create", json={"uid": user2.uid})
        assert resp.status_code == 409

    def test_auto_accepts_incoming_challenge(self, client, user, user2, friendship, ten_photos):
        # user creates challenge against user2
        login_as(client, user)
        client.post("/api/challenges/create", json={"uid": user2.uid})

        # user2 creates challenge back → auto-accepts
        login_as(client, user2)
        resp = client.post("/api/challenges/create", json={"uid": user.uid})
        assert resp.status_code == 201
        data = resp.get_json()
        assert "redirect" in data

        c = Challenge.query.get(data["challenge_id"])
        assert c.status == "ready_waiting"

    def test_not_enough_photos_returns_400(self, auth_client, user2, friendship):
        # Only the friendship creates entries, 0 photos in DB
        resp = auth_client.post("/api/challenges/create", json={"uid": user2.uid})
        assert resp.status_code == 400

    def test_unauthenticated_rejected(self, client, user2):
        resp = client.post("/api/challenges/create", json={"uid": user2.uid})
        assert resp.status_code == 302

    def test_challenge_has_unique_photos(self, auth_client, user2, friendship, ten_photos):
        resp = auth_client.post("/api/challenges/create", json={"uid": user2.uid})
        c = Challenge.query.get(resp.get_json()["challenge_id"])
        ids = c.photo_ids.split(",")
        assert len(ids) == 5
        assert len(set(ids)) == 5

    def test_challenger_and_challenged_set_correctly(self, auth_client, user, user2, friendship, ten_photos):
        resp = auth_client.post("/api/challenges/create", json={"uid": user2.uid})
        c = Challenge.query.get(resp.get_json()["challenge_id"])
        assert c.challenger_id == user.uid
        assert c.challenged_id == user2.uid


# ═══════════════════════════════════════════════════════════════════════════
# 6. Challenge Active / Poll APIs
# ═══════════════════════════════════════════════════════════════════════════

class TestChallengeActivePollAPI:

    def test_active_returns_users_challenges(self, auth_client, user, challenge_pending):
        resp = auth_client.get("/api/challenges/active")
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert any(c["id"] == challenge_pending.id for c in data)

    def test_active_excludes_other_users_challenges(self, auth_client2, user2, challenge_pending):
        """user2 should not see challenges they are not involved in — wait, they ARE the challenged.
        Instead, test that an unrelated user 3 sees nothing."""
        user3 = _make_user("outsider", "outsider@test.com")
        from app import app as flask_app
        with flask_app.test_client() as c:
            login_as(c, user3)
            resp = c.get("/api/challenges/active")
            data = resp.get_json()
            assert not any(ch["id"] == challenge_pending.id for ch in data)

    def test_active_excludes_completed(self, auth_client, challenge_in_progress):
        c = challenge_in_progress
        c.status = "completed"
        db.session.commit()
        resp = auth_client.get("/api/challenges/active")
        assert not any(ch["id"] == c.id for ch in resp.get_json())

    def test_active_excludes_expired(self, auth_client, challenge_pending):
        c = challenge_pending
        c.status = "expired"
        db.session.commit()
        resp = auth_client.get("/api/challenges/active")
        assert not any(ch["id"] == c.id for ch in resp.get_json())

    def test_active_excludes_when_player_finished(self, auth_client, challenge_in_progress):
        c = challenge_in_progress
        c.challenger_round = 6
        db.session.commit()
        resp = auth_client.get("/api/challenges/active")
        assert not any(ch["id"] == c.id for ch in resp.get_json())

    def test_poll_returns_challenge_data(self, auth_client, challenge_pending):
        resp = auth_client.get(f"/api/challenges/poll/{challenge_pending.id}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == challenge_pending.id
        assert data["status"] == "pending"
        assert "photo_ids" in data
        assert "challenger_username" in data

    def test_poll_404_for_nonexistent(self, auth_client):
        resp = auth_client.get("/api/challenges/poll/99999")
        assert resp.status_code == 404

    def test_expiry_on_active_check(self, auth_client, challenge_pending):
        c = challenge_pending
        c.created_at = datetime.utcnow() - timedelta(minutes=5)
        db.session.commit()
        resp = auth_client.get("/api/challenges/active")
        data = resp.get_json()
        assert not any(ch["id"] == c.id for ch in data)
        # Challenge should now be marked expired
        updated = Challenge.query.get(c.id)
        assert updated.status == "expired"

    def test_expiry_on_poll(self, auth_client, challenge_ready_waiting):
        c = challenge_ready_waiting
        c.created_at = datetime.utcnow() - timedelta(minutes=5)
        db.session.commit()
        resp = auth_client.get(f"/api/challenges/poll/{c.id}")
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "expired"


# ═══════════════════════════════════════════════════════════════════════════
# 7. Challenge Respond API  ─  POST /api/challenges/respond
# ═══════════════════════════════════════════════════════════════════════════

class TestChallengeRespondAPI:

    def test_accept_changes_status(self, auth_client2, challenge_pending):
        resp = auth_client2.post("/api/challenges/respond", json={
            "id": challenge_pending.id, "action": "accept",
        })
        assert resp.status_code == 200
        assert Challenge.query.get(challenge_pending.id).status == "ready_waiting"

    def test_accept_returns_redirect(self, auth_client2, challenge_pending):
        resp = auth_client2.post("/api/challenges/respond", json={
            "id": challenge_pending.id, "action": "accept",
        })
        data = resp.get_json()
        assert "redirect" in data
        assert f"challengeId={challenge_pending.id}" in data["redirect"]

    def test_reject_deletes_challenge(self, auth_client2, challenge_pending):
        resp = auth_client2.post("/api/challenges/respond", json={
            "id": challenge_pending.id, "action": "reject",
        })
        assert resp.status_code == 200
        assert Challenge.query.get(challenge_pending.id) is None

    def test_only_challenged_can_respond(self, auth_client, challenge_pending):
        # auth_client is logged in as the challenger (user), not challenged (user2)
        resp = auth_client.post("/api/challenges/respond", json={
            "id": challenge_pending.id, "action": "accept",
        })
        assert resp.status_code == 400

    def test_cannot_respond_to_non_pending(self, auth_client2, challenge_ready_waiting):
        resp = auth_client2.post("/api/challenges/respond", json={
            "id": challenge_ready_waiting.id, "action": "accept",
        })
        assert resp.status_code == 400

    def test_unauthenticated_rejected(self, client, challenge_pending):
        resp = client.post("/api/challenges/respond", json={
            "id": challenge_pending.id, "action": "accept",
        })
        assert resp.status_code == 302


# ═══════════════════════════════════════════════════════════════════════════
# 8. Challenge Ready API  ─  POST /api/challenges/ready
# ═══════════════════════════════════════════════════════════════════════════

class TestChallengeReadyAPI:

    def test_challenger_marks_ready(self, auth_client, challenge_ready_waiting):
        resp = auth_client.post("/api/challenges/ready", json={"id": challenge_ready_waiting.id})
        assert resp.status_code == 200
        c = Challenge.query.get(challenge_ready_waiting.id)
        assert c.challenger_ready is True

    def test_challenged_marks_ready(self, auth_client2, challenge_ready_waiting):
        resp = auth_client2.post("/api/challenges/ready", json={"id": challenge_ready_waiting.id})
        assert resp.status_code == 200
        c = Challenge.query.get(challenge_ready_waiting.id)
        assert c.challenged_ready is True

    def test_both_ready_triggers_in_progress(self, client, user, user2, challenge_ready_waiting):
        login_as(client, user)
        client.post("/api/challenges/ready", json={"id": challenge_ready_waiting.id})
        login_as(client, user2)
        resp = client.post("/api/challenges/ready", json={"id": challenge_ready_waiting.id})
        assert resp.status_code == 200
        assert Challenge.query.get(challenge_ready_waiting.id).status == "in_progress"

    def test_non_participant_rejected(self, client, challenge_ready_waiting):
        outsider = _make_user("outsider", "outsider@test.com")
        login_as(client, outsider)
        resp = client.post("/api/challenges/ready", json={"id": challenge_ready_waiting.id})
        assert resp.status_code == 403

    def test_only_one_ready_does_not_start(self, auth_client, challenge_ready_waiting):
        resp = auth_client.post("/api/challenges/ready", json={"id": challenge_ready_waiting.id})
        assert resp.status_code == 200
        c = Challenge.query.get(challenge_ready_waiting.id)
        assert c.challenger_ready is True
        assert c.status == "ready_waiting"


# ═══════════════════════════════════════════════════════════════════════════
# 9. Challenge Progress API  ─  POST /api/challenges/update-progress
# ═══════════════════════════════════════════════════════════════════════════

class TestChallengeProgressAPI:

    def test_updates_challenger_round_and_score(self, auth_client, challenge_in_progress):
        resp = auth_client.post("/api/challenges/update-progress", json={
            "id": challenge_in_progress.id, "round": 3, "score": 12000,
        })
        assert resp.status_code == 200
        c = Challenge.query.get(challenge_in_progress.id)
        assert c.challenger_round == 3
        assert c.challenger_score == 12000

    def test_updates_challenged_round_and_score(self, auth_client2, challenge_in_progress):
        resp = auth_client2.post("/api/challenges/update-progress", json={
            "id": challenge_in_progress.id, "round": 2, "score": 7500,
        })
        assert resp.status_code == 200
        c = Challenge.query.get(challenge_in_progress.id)
        assert c.challenged_round == 2
        assert c.challenged_score == 7500

    def test_rejects_round_below_1(self, auth_client, challenge_in_progress):
        resp = auth_client.post("/api/challenges/update-progress", json={
            "id": challenge_in_progress.id, "round": 0, "score": 0,
        })
        assert resp.status_code == 400

    def test_rejects_round_above_5(self, auth_client, challenge_in_progress):
        resp = auth_client.post("/api/challenges/update-progress", json={
            "id": challenge_in_progress.id, "round": 6, "score": 25000,
        })
        assert resp.status_code == 400

    def test_rejects_score_above_round_max(self, auth_client, challenge_in_progress):
        # round=3 → max score = 15000
        resp = auth_client.post("/api/challenges/update-progress", json={
            "id": challenge_in_progress.id, "round": 3, "score": 15001,
        })
        assert resp.status_code == 400

    def test_rejects_negative_score(self, auth_client, challenge_in_progress):
        resp = auth_client.post("/api/challenges/update-progress", json={
            "id": challenge_in_progress.id, "round": 1, "score": -1,
        })
        assert resp.status_code == 400

    def test_non_participant_rejected(self, client, challenge_in_progress):
        outsider = _make_user("outsider", "outsider@test.com")
        login_as(client, outsider)
        resp = client.post("/api/challenges/update-progress", json={
            "id": challenge_in_progress.id, "round": 1, "score": 1000,
        })
        assert resp.status_code == 403

    def test_accepts_boundary_score(self, auth_client, challenge_in_progress):
        # round=5 → max = 25000
        resp = auth_client.post("/api/challenges/update-progress", json={
            "id": challenge_in_progress.id, "round": 5, "score": 25000,
        })
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# 10. Challenge Game Completion (via POST /api/game-complete)
# ═══════════════════════════════════════════════════════════════════════════

class TestChallengeGameCompletion:

    def test_sets_round_to_6(self, auth_client, challenge_in_progress):
        resp = auth_client.post("/api/game-complete", json={
            "totalScore": 15000, "challengeId": challenge_in_progress.id,
        })
        assert resp.status_code == 200
        c = Challenge.query.get(challenge_in_progress.id)
        assert c.challenger_round == 6

    def test_saves_score_to_challenge(self, auth_client, challenge_in_progress):
        auth_client.post("/api/game-complete", json={
            "totalScore": 18500, "challengeId": challenge_in_progress.id,
        })
        c = Challenge.query.get(challenge_in_progress.id)
        assert c.challenger_score == 18500

    def test_both_complete_triggers_completed(self, client, user, user2, challenge_in_progress):
        login_as(client, user)
        client.post("/api/game-complete", json={
            "totalScore": 15000, "challengeId": challenge_in_progress.id,
        })
        login_as(client, user2)
        client.post("/api/game-complete", json={
            "totalScore": 18000, "challengeId": challenge_in_progress.id,
        })
        assert Challenge.query.get(challenge_in_progress.id).status == "completed"

    def test_one_complete_does_not_finish(self, auth_client, challenge_in_progress):
        auth_client.post("/api/game-complete", json={
            "totalScore": 15000, "challengeId": challenge_in_progress.id,
        })
        c = Challenge.query.get(challenge_in_progress.id)
        assert c.challenger_round == 6
        assert c.status == "in_progress"

    def test_duplicate_submission_prevented(self, auth_client, challenge_in_progress):
        auth_client.post("/api/game-complete", json={
            "totalScore": 15000, "challengeId": challenge_in_progress.id,
        })
        # Second submission should be a no-op (not an error)
        resp = auth_client.post("/api/game-complete", json={
            "totalScore": 15000, "challengeId": challenge_in_progress.id,
        })
        assert resp.status_code == 200
        c = Challenge.query.get(challenge_in_progress.id)
        assert c.challenger_round == 6

    def test_winner_is_challenger(self, client, user, user2, challenge_in_progress):
        login_as(client, user)
        client.post("/api/game-complete", json={
            "totalScore": 20000, "challengeId": challenge_in_progress.id,
        })
        login_as(client, user2)
        client.post("/api/game-complete", json={
            "totalScore": 10000, "challengeId": challenge_in_progress.id,
        })
        c = Challenge.query.get(challenge_in_progress.id)
        assert c.status == "completed"
        d = c.to_dict()
        assert d["winner_id"] == user.uid
        assert d["result"] == "win"

    def test_tie_detected(self, client, user, user2, challenge_in_progress):
        login_as(client, user)
        client.post("/api/game-complete", json={
            "totalScore": 15000, "challengeId": challenge_in_progress.id,
        })
        login_as(client, user2)
        client.post("/api/game-complete", json={
            "totalScore": 15000, "challengeId": challenge_in_progress.id,
        })
        d = Challenge.query.get(challenge_in_progress.id).to_dict()
        assert d["result"] == "tie"
        assert d["winner_id"] is None


# ═══════════════════════════════════════════════════════════════════════════
# 11. Challenge Model  ─  to_dict()
# ═══════════════════════════════════════════════════════════════════════════

class TestChallengeModel:

    def test_to_dict_includes_all_fields(self, challenge_pending):
        d = challenge_pending.to_dict()
        for key in ["id", "challenger_id", "challenged_id", "challenger_username",
                     "challenged_username", "photo_ids", "status", "challenger_ready",
                     "challenged_ready", "challenger_score", "challenged_score",
                     "challenger_round", "challenged_round", "winner_id", "result",
                     "created_at"]:
            assert key in d

    def test_to_dict_splits_photo_ids(self, challenge_pending):
        d = challenge_pending.to_dict()
        assert isinstance(d["photo_ids"], list)
        assert len(d["photo_ids"]) == 5
        assert all(isinstance(pid, str) for pid in d["photo_ids"])

    def test_to_dict_result_null_when_incomplete(self, challenge_pending):
        d = challenge_pending.to_dict()
        assert d["result"] is None
        assert d["winner_id"] is None

    def test_to_dict_winner_is_challenger(self, challenge_in_progress):
        c = challenge_in_progress
        c.challenger_score = 20000
        c.challenger_round = 6
        c.challenged_score = 15000
        c.challenged_round = 6
        db.session.commit()
        d = c.to_dict()
        assert d["winner_id"] == c.challenger_id
        assert d["result"] == "win"

    def test_to_dict_winner_is_challenged(self, challenge_in_progress):
        c = challenge_in_progress
        c.challenger_score = 10000
        c.challenger_round = 6
        c.challenged_score = 22000
        c.challenged_round = 6
        db.session.commit()
        d = c.to_dict()
        assert d["winner_id"] == c.challenged_id
        assert d["result"] == "lose"


# ═══════════════════════════════════════════════════════════════════════════
# 12. Challenge Lifecycle (integration-style)
# ═══════════════════════════════════════════════════════════════════════════

class TestChallengeLifecycle:

    def test_full_lifecycle(self, client, user, user2, friendship, ten_photos):
        # Create
        login_as(client, user)
        resp = client.post("/api/challenges/create", json={"uid": user2.uid})
        assert resp.status_code == 201
        cid = resp.get_json()["challenge_id"]

        # Accept
        login_as(client, user2)
        resp = client.post("/api/challenges/respond", json={"id": cid, "action": "accept"})
        assert resp.status_code == 200
        assert Challenge.query.get(cid).status == "ready_waiting"

        # Both ready
        login_as(client, user)
        client.post("/api/challenges/ready", json={"id": cid})
        login_as(client, user2)
        resp = client.post("/api/challenges/ready", json={"id": cid})
        assert Challenge.query.get(cid).status == "in_progress"

        # Both complete
        login_as(client, user)
        client.post("/api/game-complete", json={"totalScore": 18000, "challengeId": cid})
        login_as(client, user2)
        client.post("/api/game-complete", json={"totalScore": 15000, "challengeId": cid})

        c = Challenge.query.get(cid)
        assert c.status == "completed"
        assert c.to_dict()["result"] == "win"
        assert c.to_dict()["winner_id"] == user.uid

    def test_reject_ends_flow(self, client, user, user2, friendship, ten_photos):
        login_as(client, user)
        resp = client.post("/api/challenges/create", json={"uid": user2.uid})
        cid = resp.get_json()["challenge_id"]

        login_as(client, user2)
        client.post("/api/challenges/respond", json={"id": cid, "action": "reject"})
        assert Challenge.query.get(cid) is None

    def test_expiry_flow(self, client, user, user2, friendship, ten_photos):
        login_as(client, user)
        resp = client.post("/api/challenges/create", json={"uid": user2.uid})
        cid = resp.get_json()["challenge_id"]

        c = Challenge.query.get(cid)
        c.created_at = datetime.utcnow() - timedelta(minutes=5)
        db.session.commit()

        # Poll should mark expired
        resp = client.get(f"/api/challenges/poll/{cid}")
        assert resp.get_json()["status"] == "expired"


# ═══════════════════════════════════════════════════════════════════════════
# 13. Controller  ─  add_score()
# ═══════════════════════════════════════════════════════════════════════════

class TestControllerAddScore:

    def test_add_score_creates_game_result(self, user):
        add_score(user.uid, 5000)
        gr = GameResult.query.filter_by(user_id=user.uid).first()
        assert gr is not None
        assert gr.score == 5000

    def test_add_score_increments_user_total(self, user):
        add_score(user.uid, 5000)
        updated = User.query.get(user.uid)
        assert updated.total_score == 5000

    def test_add_score_accumulates(self, user):
        add_score(user.uid, 3000)
        add_score(user.uid, 4000)
        updated = User.query.get(user.uid)
        assert updated.total_score == 7000
        assert GameResult.query.filter_by(user_id=user.uid).count() == 2
