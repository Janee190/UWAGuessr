from app import db, login
from werkzeug.security import generate_password_hash, check_password_hash

from flask_login import UserMixin


class User(UserMixin, db.Model):
    uid = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(128), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    def get_id(self):
        return str(self.uid)

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
    
@login.user_loader
def load_user(id):
    return User.query.get(int(id))