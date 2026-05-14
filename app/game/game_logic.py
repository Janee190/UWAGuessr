import math
import random

from app.models import Photos

def calculate_haversine(lat1, lon1, lat2, lon2):
    R = 6371e3  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def calculate_score(guess_lat, guess_lng, img_id):
    try:
        img_id = int(img_id)
    except (TypeError, ValueError):
        return None, None, None, None

    photo = Photos.query.filter_by(pid=img_id).first()
    if not photo:
        return None, None, None, None

    actual_lat = float(photo.latitude)
    actual_lng = float(photo.longitude)

    distance = calculate_haversine(guess_lat, guess_lng, actual_lat, actual_lng)

    max_score = 5000
    dropoff_rate = 0.005

    if distance < 10:
        score = max_score
    else:
        score = max_score * math.exp(-dropoff_rate * (distance - 10))

    return max(0, round(score)), distance, actual_lat, actual_lng


def get_game_images(photo_id_list=None):
    if photo_id_list:
        # Fetch specific photos by their IDs
        photos = Photos.query.filter(Photos.pid.in_(photo_id_list)).all()
        # Sort them to match the provided ID order if necessary, 
        # but for simplicity we'll just return the 5 photos.
        data = [
            {"id": photo.pid, "imagePath": photo.image_path}
            for photo in photos
        ]
        # Ensure we return 5 (or however many were provided)
        return data

    photos = Photos.query.with_entities(Photos.pid, Photos.image_path).all()
    data = [
        {"id": photo.pid, "imagePath": photo.image_path}
        for photo in photos
    ]
    random.shuffle(data)
    images = data[:5]  # select up to 5 random pictures

    return images
