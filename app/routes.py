from flask import Blueprint, render_template, jsonify, request

bp = Blueprint('main', __name__, template_folder='../templates')


@bp.route("/")
def index():
    return render_template("index.html")


@bp.route("/login")
def login():
    return render_template("login.html")


@bp.route("/game")
def game():
    return render_template("game.html")


@bp.route("/how-to-play")
def how_to_play():
    return render_template("howtoplay.html")


@bp.route("/leaderboard")
def leaderboard():
    return render_template("leaderboard.html")


@bp.route("/api/rounds")
def api_rounds():
    from game.game_logic import get_game_data
    return jsonify(get_game_data())


@bp.route("/api/guess", methods=["POST"])
def api_guess():
    from game.game_logic import calculate_score
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

@bp.route("/signup")
def signup():
    return render_template("signup.html")

@bp.route("/api/signup", methods=["POST"])
def api_signup():
    from app.models import User
    from app import db
    data = request.json
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({'error': 'Missing required fields'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists.'}), 409
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'That username is already taken.'}), 409

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'Account created successfully'}), 201