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
    total_score = db.Column(db.Integer, default=0, nullable=True )
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

class Friendship(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey('user.uid'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.uid'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected

    requester = db.relationship('User', foreign_keys=[requester_id], backref='sent_requests')
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref='received_requests')

class Photos(db.Model):
    __tablename__ = 'photos'
    pid = db.Column(db.Integer, primary_key=True)
    image_path = db.Column(db.String(256), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class GameResult(db.Model):
    __tablename__ = 'game_results'
    sid = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.uid'), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('game_results', lazy=True))

class Challenge(db.Model):
    __tablename__ = 'challenges'
    id = db.Column(db.Integer, primary_key=True)
    challenger_id = db.Column(db.Integer, db.ForeignKey('user.uid'), nullable=False)
    challenged_id = db.Column(db.Integer, db.ForeignKey('user.uid'), nullable=False)
    
    # Comma-separated photo IDs
    photo_ids = db.Column(db.String(256), nullable=False)
    
    # Status: pending, accepted, in_progress, completed, expired
    status = db.Column(db.String(20), default='pending')
    
    challenger_ready = db.Column(db.Boolean, default=False)
    challenged_ready = db.Column(db.Boolean, default=False)
    
    challenger_score = db.Column(db.Integer, nullable=True)
    challenged_score = db.Column(db.Integer, nullable=True)
    
    # For progress tracking (Round 1-5)
    challenger_round = db.Column(db.Integer, default=0)
    challenged_round = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    challenger = db.relationship('User', foreign_keys=[challenger_id], backref='sent_challenges')
    challenged = db.relationship('User', foreign_keys=[challenged_id], backref='received_challenges')

    def to_dict(self):
        return {
            'id': self.id,
            'challenger_id': self.challenger_id,
            'challenged_id': self.challenged_id,
            'challenger_username': self.challenger.username,
            'challenged_username': self.challenged.username,
            'photo_ids': self.photo_ids.split(','),
            'status': self.status,
            'challenger_ready': self.challenger_ready,
            'challenged_ready': self.challenged_ready,
            'challenger_score': self.challenger_score,
            'challenged_score': self.challenged_score,
            'challenger_round': self.challenger_round,
            'challenged_round': self.challenged_round,
            'created_at': self.created_at.isoformat()
        }
    
@login.user_loader
def load_user(id):
    return User.query.get(int(id))

    