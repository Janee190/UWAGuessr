from app import db, models

def register_user(data):
    if models.User.query.filter_by(email=data['email']).first():
        return None, 'Account already exists with this email'
    
    if models.User.query.filter_by(username=data['username']).first():
        return None, 'Account already exists with this username'
    
    user = models.User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return user, None

def login_user(data):
    user = models.User.query.filter_by(email=data['email']).first()
    if user is None or not user.check_password(data['password']):
        return None, 'Invalid email or password'
    return user, None