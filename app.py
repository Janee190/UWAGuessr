from flask import Flask, render_template

application = Flask(__name__)


@application.route("/")
def index():
    return render_template("index.html")


@application.route("/login")
def login():
    return render_template("login.html")


@application.route("/how-to-play")
def how_to_play():
    return render_template("howtoplay.html")


@application.route("/leaderboard")
def leaderboard():
    return render_template("leaderboard.html")


if __name__ == "__main__":
    application.run(debug=True)
