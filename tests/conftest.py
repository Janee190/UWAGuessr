import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app import app as flask_app, db
from app.test_config import TestConfig
from app.models import User, Photos, Challenge, Friendship, GameResult


@pytest.fixture
def app():
    """Fresh Flask app with in-memory database for each test."""
    flask_app.config.from_object(TestConfig)
    ctx = flask_app.app_context()
    ctx.push()
    db.drop_all()
    db.create_all()
    yield flask_app
    db.session.remove()
    db.drop_all()
    ctx.pop()


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """Active database session."""
    return db.session


# ── User fixtures ──────────────────────────────────────────────────────────


def _make_user(username, email, password="password123"):
    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def user(app):
    """A default test user (not logged in)."""
    return _make_user("testuser", "test@example.com")


@pytest.fixture
def user2(app):
    """A second test user (not logged in)."""
    return _make_user("testuser2", "test2@example.com")


# ── Auth helpers ───────────────────────────────────────────────────────────


def login_as(client, user):
    """Log in as *user* on *client* for subsequent requests."""
    with client.session_transaction() as sess:
        sess["_user_id"] = str(user.uid)
        sess["_fresh"] = True
    return client


@pytest.fixture
def auth_client(client, user):
    """Test client pre-authenticated as *user*."""
    return login_as(client, user)


@pytest.fixture
def auth_client2(client, user2):
    """Test client pre-authenticated as *user2*."""
    return login_as(client, user2)


# ── Photo fixtures ─────────────────────────────────────────────────────────


def _make_photo(lat=-31.98, lng=115.81, path=None):
    import uuid
    photo = Photos(
        latitude=lat,
        longitude=lng,
        image_path=path or f"/static/game/photos/{uuid.uuid4().hex}.webp",
    )
    db.session.add(photo)
    db.session.commit()
    return photo


@pytest.fixture
def photo(app):
    """A single sample photo."""
    return _make_photo()


@pytest.fixture
def ten_photos(app):
    """Ten sample photos with varied coordinates for game tests."""
    return [
        _make_photo(
            lat=-31.98 + i * 0.001,
            lng=115.81 + i * 0.001,
            path=f"/static/game/photos/test_{i}.webp",
        )
        for i in range(10)
    ]


# ── Friendship fixture ─────────────────────────────────────────────────────


@pytest.fixture
def friendship(app, user, user2):
    """An accepted friendship between *user* and *user2*."""
    f = Friendship(requester_id=user.uid, receiver_id=user2.uid, status="accepted")
    db.session.add(f)
    db.session.commit()
    return f


# ── Challenge fixtures ─────────────────────────────────────────────────────


@pytest.fixture
def challenge_pending(app, ten_photos, user, user2, friendship):
    """A challenge from *user* to *user2* in 'pending' state."""
    photo_ids = ",".join([str(p.pid) for p in ten_photos[:5]])
    c = Challenge(
        challenger_id=user.uid,
        challenged_id=user2.uid,
        photo_ids=photo_ids,
        status="pending",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def challenge_ready_waiting(app, ten_photos, user, user2, friendship):
    """A challenge in 'ready_waiting' state."""
    photo_ids = ",".join([str(p.pid) for p in ten_photos[:5]])
    c = Challenge(
        challenger_id=user.uid,
        challenged_id=user2.uid,
        photo_ids=photo_ids,
        status="ready_waiting",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def challenge_in_progress(app, ten_photos, user, user2, friendship):
    """A challenge in 'in_progress' state (both players ready)."""
    photo_ids = ",".join([str(p.pid) for p in ten_photos[:5]])
    c = Challenge(
        challenger_id=user.uid,
        challenged_id=user2.uid,
        photo_ids=photo_ids,
        status="in_progress",
        challenger_ready=True,
        challenged_ready=True,
    )
    db.session.add(c)
    db.session.commit()
    return c
