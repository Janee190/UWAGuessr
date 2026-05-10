import os

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
default_db_path = 'sqlite:///' + os.path.join(basedir, 'app.db')

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or default_db_path
<<<<<<< HEAD
    SECRET_KEY = os.environ.get('UWAGUESSR_SECRET_KEY') 
=======
    SECRET_KEY = os.environ.get('UWAGUESSR_SECRET_KEY') or 'dev-secret-key-change-in-production'
>>>>>>> 41070eb62bd6e7743bbcb5d2c296d25360c13c48
