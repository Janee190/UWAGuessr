from flask import Flask, render_template, jsonify, request, url_for
from app import app
from app.controllers import login_user_service, register_user
from flask_login import login_user

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/api/login", methods=["POST"])
def api_login():
    user, errors = login_user_service(request.get_json())
    if errors:
        return jsonify({'errors': errors}), 401
    login_user(user)
    return jsonify({'redirect': url_for('index')}), 200

@app.route("/game")
def game():
    return render_template("game.html")

@app.route("/api/game-images")
def api_game_images():
    from app.game.game_logic import get_game_images

    return jsonify(get_game_images())

@app.route("/api/guess", methods=["POST"])
def api_guess():
    from app.game.game_logic import calculate_score
    data = request.json
    guess_lat = data.get('lat')
    guess_lng = data.get('lng')
    img_id = data.get('id')
    
    if guess_lat is None or guess_lng is None or img_id is None:
        return jsonify({'error': 'Missing required fields'}), 400
        
    score, distance, actual_lat, actual_lng = calculate_score(guess_lat, guess_lng, img_id)
    if score is None:
        return jsonify({'error': 'Invalid image ID'}), 404
        
    return jsonify({
        'score': score,
        'distance': distance,
        'actual_lat': actual_lat,
        'actual_lng': actual_lng
    })


@app.route("/how-to-play")
def how_to_play():
    return render_template("howtoplay.html")


@app.route("/leaderboard")
def leaderboard():
    return render_template("leaderboard.html")


if __name__ == "__main__":
    app.run(debug=True)
