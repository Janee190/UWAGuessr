import os
import uuid

from flask import Flask, render_template, jsonify, request, url_for, send_from_directory, redirect
from werkzeug.utils import secure_filename
from flask_login import login_user, login_required, logout_user, current_user

from app import app
from app.image_upload import extract_gps, convert_to_webp, add_photo_record
from app.controllers import login_user_service, register_user, change_password


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/api/signup", methods=["POST"])
def api_register():
    user, errors = register_user(request.get_json())
    if errors:
        return jsonify({'errors': errors}), 400
    login_user(user)
    return jsonify({'message': 'Signup successful'}), 201


@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/api/login", methods=["POST"])
def api_login():
    user, errors = login_user_service(request.get_json())
    if errors:
        return jsonify({'errors': errors}), 401
    login_user(user)
    return jsonify({'message': 'Login successful'}), 200

@app.route("/game")
def game():
    return render_template("game.html")

@app.route("/forgot-password")
def forgot_password():
    return render_template("forgot_password.html")

@app.route("/api/forgot-password", methods=["POST"])
def api_forgot_password():
    pass

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

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")

@app.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('index'))


# ── Image upload page ─────────────────────────────────────────────────────

@app.route("/image-upload")
@login_required
def image_upload():
    return render_template("imageupload.html")


# ── Temporary upload directory ────────────────────────────────────────────

UPLOAD_TEMP_DIR = os.path.join(app.instance_path, 'uploads')
os.makedirs(UPLOAD_TEMP_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


@app.route('/instance/uploads/<path:filename>')
def serve_temp_upload(filename):
    """Serve temporarily uploaded files (for panorama preview)."""
    return send_from_directory(UPLOAD_TEMP_DIR, filename)


@app.route("/api/upload-image", methods=["POST"])
def api_upload_image():
    """Upload a panorama, extract GPS coords, return temp path + coords."""
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Unsupported file type: {ext}'}), 400

    # Save to a temp location with a unique name to avoid collisions
    temp_name = f"{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(UPLOAD_TEMP_DIR, temp_name)
    file.save(temp_path)

    # Extract GPS
    coords = extract_gps(temp_path)
    if coords is None:
        # Clean up — no GPS found
        os.remove(temp_path)
        return jsonify({'error': 'No GPS location data found in the image. Ensure the image has EXIF coordinates.'}), 400

    lat, lng = coords
    return jsonify({
        'tempPath': temp_name,
        'lat': lat,
        'lng': lng,
        'originalName': file.filename,
    })


def _process_single_upload(file_obj):
    """Upload a single file to temp directory and extract GPS.
    Returns (result_dict, error_str).
    """
    ext = os.path.splitext(file_obj.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return None, f'Unsupported file type: {ext}'

    temp_name = f"{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(UPLOAD_TEMP_DIR, temp_name)
    file_obj.save(temp_path)

    coords = extract_gps(temp_path)
    if coords is None:
        os.remove(temp_path)
        return None, 'No GPS location data found in the image.'

    lat, lng = coords
    return {
        'tempPath': temp_name,
        'lat': lat,
        'lng': lng,
        'originalName': file_obj.filename,
    }, None


@app.route("/api/upload-images", methods=["POST"])
def api_upload_images():
    """Upload multiple panoramas at once, extract GPS for each.
    Accepts multiple files under the 'images[]' field.
    Returns an array of results, each with tempPath/lat/lng/originalName or an error.
    """
    files = request.files.getlist('images[]')
    if not files:
        return jsonify({'error': 'No image files provided'}), 400

    results = []
    for f in files:
        if not f.filename:
            continue
        result, error = _process_single_upload(f)
        if result:
            results.append(result)
        else:
            results.append({
                'originalName': f.filename,
                'error': error,
            })

    return jsonify({'images': results})


@app.route("/api/confirm-image", methods=["POST"])
def api_confirm_image():
    """Confirm final location, convert to WebP, and save to the database."""
    data = request.json
    temp_name = data.get('tempPath')
    lat = data.get('lat')
    lng = data.get('lng')

    if not temp_name or lat is None or lng is None:
        return jsonify({'error': 'Missing required fields'}), 400

    temp_path = os.path.join(UPLOAD_TEMP_DIR, temp_name)
    if not os.path.isfile(temp_path):
        return jsonify({'error': 'Temporary file not found. Please re-upload.'}), 404

    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid coordinates'}), 400

    # Convert to WebP (strips EXIF)
    webp_filename = convert_to_webp(temp_path)

    # Clean up temp file
    os.remove(temp_path)

    # Insert into database
    new_id = add_photo_record(webp_filename, lat, lng)

    return jsonify({
        'success': True,
        'id': new_id,
        'imagePath': f'/static/game/photos/{webp_filename}',
        'lat': lat,
        'lng': lng,
    })

@app.route("/api/game-complete", methods=["POST"])
@login_required
def api_game_complete():
    data = request.get_json(silent=True) or {}
    total_score = data.get('totalScore', data.get('score'))

    if total_score is None:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        total_score = int(total_score)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid field types'}), 400

    if total_score < 0:
        return jsonify({'error': 'Invalid field values'}), 400

    current_user.add_total_score(total_score)

    return jsonify({'success': True, 'totalScore': current_user.total_score})


if __name__ == "__main__":
    app.run(debug=True)

