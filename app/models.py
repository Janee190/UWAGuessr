from app import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    uid = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(128), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    def to_dict(self):
        # Helper function to return a dictionary representation of user
        return {
            'uid': self.uid,
            'username': self.username,
            'email': self.email
        }

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)