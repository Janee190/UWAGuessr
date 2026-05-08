from app import db, models
from models import User
import re

def validate_username(username):
    if not username:
        return 'Username is required'
    if len(username) < 3:
        return 'Username must be at least 3 characters'
    if len(username) > 80:
        return 'Username must be less than 80 characters'
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return 'Username can only contain letters, numbers and underscores'
    return None

def validate_email(email):
    if not email:
        return 'Email is required'
    if len(email) > 120:
        return 'Email must be less than 120 characters'
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return 'Invalid email address'
    return None

def validate_password(password):
    if not password:
        return 'Password is required'
    if len(password) < 8:
        return 'Password must be at least 8 characters'
    if len(password) > 128:
        return 'Password must be less than 128 characters'
    return None

def validate_registration(data):
    errors = {}
    
    username_error = validate_username(data.get('username', ''))
    if username_error:
        errors['username'] = username_error
    
    email_error = validate_email(data.get('email', ''))
    if email_error:
        errors['email'] = email_error

    password_error = validate_password(data.get('password', ''))
    if password_error:
        errors['password'] = password_error

    return errors

def validate_login(data):
    errors = {}

    email_error = validate_email(data.get('email', ''))
    if email_error:
        errors['email'] = email_error

    if not data.get('password'):
        errors['password'] = 'Password is required'

    return errors

def register_user(data):
    errors = validate_registration(data)
    if errors:
        return None, errors

    if User.query.filter_by(email=data['email']).first():
        return None, {'email': 'Email already registered'}
    if User.query.filter_by(username=data['username']).first():
        return None, {'username': 'Username already taken'}

    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return user, None

def login_user_service(data):
    errors = validate_login(data)
    if errors:
        return None, errors

    user = User.query.filter_by(email=data['email']).first()
    if not user or not user.check_password(data['password']):
        return None, {'credentials': 'Invalid email or password'}
    return user, None