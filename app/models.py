from app import db, login
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

<<<<<<< HEAD
from flask_login import UserMixin


=======
>>>>>>> 131d8ba205223ec6749575864dc08d92904be3d4
class User(UserMixin, db.Model):
    uid = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(128), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    security_question = db.Column(db.String(256), nullable=True)
    security_answer_hash = db.Column(db.String(256), nullable=True)

    def get_id(self):
        return str(self.uid)

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
    
<<<<<<< HEAD
@login.user_loader
def load_user(id):
    return User.query.get(int(id))
=======
    def set_security_answer(self, answer):
        self.security_answer_hash = generate_password_hash(answer)
    
    def check_security_answer(self, answer):
        return check_password_hash(self.security_answer_hash, answer)
>>>>>>> 131d8ba205223ec6749575864dc08d92904be3d4
