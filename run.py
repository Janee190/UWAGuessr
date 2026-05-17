from app import app
from app.controllers import register_user
import click

@app.cli.command("create-user")
@click.argument("username")
@click.argument("email")
@click.argument("password")
def create_user(username, email, password):
    # Allows for the creation of a new user from the command line
    # Use with `flask --app run create-user <username> <email> <password>`
    user, errors = register_user({
        'username': username,
        'email': email,
        'password': password
    })
    if errors:
        print(f"Error: {errors}")
    else:
        print(f"User created: {user.username} ({user.email})")

@app.cli.command("dump-photos")
def dump_photos_command():
    """Exports photo data from the database to photos.json"""
    from app.image_upload import sync_photos_to_json
    sync_photos_to_json()
    print("Photos exported to photos.json")

@app.cli.command("load-photos")
def load_photos_command():
    """Imports photo data from photos.json to the database"""
    from app.image_upload import load_photos_from_json
    added = load_photos_from_json()
    print(f"Loaded {added} new photos from photos.json into the database")

@app.cli.command("admin-promote")
@click.argument("username")
def admin_promote(username):
    """Promotes a user to admin from the command line"""
    from app.models import User
    from app import db
    user = User.query.filter_by(username=username).first()
    if not user:
        print(f"User {username} not found")
        return
    user.is_admin = True
    db.session.commit()
    print(f"{username} has been promoted to admin")

@app.cli.command("admin-demote")
@click.argument("username")
def admin_demote(username):
    """Demotes a user from admin from the command line"""
    from app.models import User
    from app import db
    user = User.query.filter_by(username=username).first()
    if not user:
        print(f"User {username} not found")
        return
    user.is_admin = False
    db.session.commit()
    print(f"{username} has been demoted from admin")

if __name__ == "__main__":
    app.run(debug=True)