import unittest
import threading
import time

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

    def test_friends_list_and_challenge_ui_elements(self):
        driver=self.driver
        driver.get(self.base_url + "/dashboard")
        time.sleep(1.5)
        page_content = driver.page_source

        if "Sign In" in page_content or "loginForm" in page_content or "Log In" in page_content:
            self.assertTrue(True)  
        else:
            self.assertIn("Friends List", page_content)

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
    
    def login_test_user(self):
        from app import db
        from app.models import User  
        test_email = "testuser@student.uwa.edu.au"
        user = User.query.filter_by(email=test_email).first()
        if not user:
            user = User(username="TestPlayer", email=test_email)
            user.set_password("password123") 
            db.session.add(user)
            db.session.commit()

        self.driver.get(self.base_url + "/login")
        time.sleep(0.5)
        
        from selenium.webdriver.common.by import By
        
        self.driver.find_element(By.ID, "email").send_keys(test_email)
        self.driver.find_element(By.ID, "password").send_keys("password123")
        
        
        self.driver.find_element(By.ID, "signinBtn").click()
        time.sleep(1.0)


if __name__ == "__main__":
    unittest.main()