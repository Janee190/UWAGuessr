from datetime import datetime

from app import db, login
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

class User(UserMixin, db.Model):
    uid = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(128), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    security_question = db.Column(db.String(256), nullable=True)
    security_answer_hash = db.Column(db.String(256), nullable=True)
    total_score = db.Column(db.Integer, default=0, nullable=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=True)

    def get_id(self):
        return str(self.uid)

    def to_dict(self):
        # Helper function to return a dictionary representation of user
        return {
            'uid': self.uid,
            'username': self.username,
            'email': self.email,
            'total_score': self.total_score
        }

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def set_security_answer(self, answer):
        self.security_answer_hash = generate_password_hash(answer.lower().strip())
    
    def check_security_answer(self, answer):
        return check_password_hash(self.security_answer_hash, answer.lower().strip())
    
    def add_total_score(self, points):
        self.total_score += points
        db.session.commit()

class Photos(db.Model):
    __tablename__ = 'photos'
    pid = db.Column(db.Integer, primary_key=True)
    image_path = db.Column(db.String(256), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    