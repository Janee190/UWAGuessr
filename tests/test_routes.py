import unittest

from app import app, db
from app.models import Photos
from app.test_config import TestConfig


class RouteTests(unittest.TestCase):

    def setUp(self):
        app.config.from_object(TestConfig)

        self.app_context = app.app_context()
        self.app_context.push()
        db.drop_all()
        db.create_all()
        
        # Add sample photo data so routes/API endpoints that query the
        # photos table can run correctly during testing.
        sample_photo = Photos(
            image_path="test.webp",
            latitude=-31.98,
            longitude=115.81
        )

        db.session.add(sample_photo)
        db.session.commit()
        self.client = app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_homepage_loads(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)

    def test_login_page_loads(self):
        response = self.client.get("/login")
        self.assertEqual(response.status_code, 200)

    def test_signup_page_loads(self):
        response = self.client.get("/signup")
        self.assertEqual(response.status_code, 200)

    def test_how_to_play_page_loads(self):
        response = self.client.get("/how-to-play")
        self.assertEqual(response.status_code, 200)

    def test_game_page_loads(self):
        response = self.client.get("/game")
        self.assertEqual(response.status_code, 200)

    def test_forgot_password_page_loads(self):
        response = self.client.get("/forgot-password")
        self.assertEqual(response.status_code, 200)

    def test_leaderboard_page_loads(self):
        response = self.client.get("/leaderboard")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()