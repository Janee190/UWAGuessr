from app import app
from app.controllers import register_user
import click

@app.cli.command("create-user")
@click.argument("username")
@click.argument("email")
@click.argument("password")
def create_user(username, email, password):
    # Allows for the creation of a new user from the command line
    # Use with `flask create-user <username> <email> <password>`
    user, errors = register_user({
        'username': username,
        'email': email,
        'password': password
    })
    if errors:
        print(f"Error: {errors}")
    else:
        print(f"User created: {user.username} ({user.email})")

if __name__ == "__main__":
    app.run(debug=True)