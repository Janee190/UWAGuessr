import unittest
import threading
import time

import pytest
from selenium import webdriver

from app import app, db
from app.models import Photos
from app.test_config import TestConfig


class SeleniumTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.config.from_object(TestConfig)

        cls.app_context = app.app_context()
        cls.app_context.push()

        db.drop_all()
        db.create_all()

        # Add sample photo data so the game page API can
        # retrieve image data during Selenium testing.
        sample_photo = Photos(
            image_path="test.webp",
            latitude=-31.98,
            longitude=115.81
        )

        db.session.add(sample_photo)
        db.session.commit()

        cls.server_thread = threading.Thread(
            target=lambda: app.run(port=5050, use_reloader=False)
        )

        cls.server_thread.daemon = True
        cls.server_thread.start()

        time.sleep(2)

        options = webdriver.ChromeOptions()
        options.add_argument("--headless=new")

        cls.driver = webdriver.Chrome(options=options)
        cls.base_url = "http://127.0.0.1:5050"

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        db.session.remove()
        db.drop_all()
        cls.app_context.pop()

    def test_homepage_title(self):
        self.driver.get(self.base_url + "/")
        self.assertIn("EXPLORE UWA", self.driver.page_source)

    def test_login_page(self):
        self.driver.get(self.base_url + "/login")
        self.assertIn("Sign in", self.driver.page_source)

    def test_signup_page(self):
        self.driver.get(self.base_url + "/signup")
        self.assertIn("Sign Up", self.driver.page_source)

    def test_how_to_play_page(self):
        self.driver.get(self.base_url + "/how-to-play")
        self.assertIn("How to Play", self.driver.page_source)

    def test_game_page(self):
        self.driver.get(self.base_url + "/game")
        self.assertIn("UWA", self.driver.page_source)


if __name__ == "__main__":
    unittest.main()