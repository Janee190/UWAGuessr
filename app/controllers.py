from app import db
from app.models import User
import re

def validate_username(username):
    if not username:
        return 'Please enter a username'
    if len(username) < 3:
        return 'Username must be at least 3 characters'
    if len(username) > 80:
        return 'Username must be less than 80 characters'
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return 'Username can only contain letters, numbers and underscores'
    return None

def validate_email(email):
    if not email:
        return 'Please enter a valid email address'
    if len(email) > 120:
        return 'Email must be less than 120 characters'
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return 'Please enter a valid email address'
    return None

def validate_password(password):
    if not password:
        return 'Please enter a password'
    if len(password) < 8:
        return 'Password must be at least 8 characters'
    if len(password) > 128:
        return 'Password must be less than 128 characters'
    return None

def validate_security_question(question):
    if not question:
        return 'Please enter a security question'
    if len(question) > 256:
        return 'Security question must be less than 256 characters'
    return None

def validate_security_answer(answer):
    if not answer:
        return 'Please enter a security answer'
    if len(answer) > 256:
        return 'Security answer must be less than 256 characters'
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

    security_question_error = validate_security_question(data.get('securityQuestion', ''))
    if security_question_error:
        errors['securityQuestion'] = security_question_error

    security_answer_error = validate_security_answer(data.get('securityAnswer', ''))
    if security_answer_error:
        errors['securityAnswer'] = security_answer_error
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

    user = User(
    username=data['username'],
    email=data['email'],
    security_question=data['securityQuestion']
    )
    
    user.set_password(data['password'])
    user.set_security_answer(data['securityAnswer'])

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

def validate_password_change(data):
    errors = {}

    email_error = validate_email(data.get('email', ''))
    if email_error:
        errors['email'] = email_error
    password_error = validate_password(data.get('newPassword', ''))
    if password_error:
        errors['newPassword'] = password_error
    security_answer_error = validate_security_answer(data.get('securityAnswer', ''))
    if security_answer_error:
        errors['securityAnswer'] = security_answer_error

    return errors

def change_user_password(data):
    errors = validate_password_change(data)
    if errors:
        return errors
    user = User.query.filter_by(email=data['email']).first()
    if not user or not user.check_security_answer(data['securityAnswer']):
        return {'credentials': 'Invalid email or security answer'}
    user.set_password(data['newPassword'])
    db.session.commit()
    return None
