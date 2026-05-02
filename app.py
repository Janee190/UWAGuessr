from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/how-to-play")
def how_to_play():
    return render_template("howtoplay.html")


if __name__ == "__main__":
    app.run(debug=True)
