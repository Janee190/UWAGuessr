import csv
import math
import random


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
    actual_lat, actual_lng = None, None
    with open("game/locations.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if int(row["id"]) == img_id:
                actual_lat = float(row["lat"])
                actual_lng = float(row["lng"])
                break
        else:
            return None, None, None, None

    distance = calculate_haversine(guess_lat, guess_lng, actual_lat, actual_lng)

    max_score = 5000
    dropoff_rate = 0.005

    if distance < 20:
        score = max_score
    else:
        score = max_score * math.exp(-dropoff_rate * (distance - 20))

    return max(0, round(score)), distance, actual_lat, actual_lng


def get_game_images():
    data = []
    with open("game/locations.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append({"id": int(row["id"]), "imagePath": row["imagePath"]})
    images = random.sample(data, 5)  # select 5 random pictures
    return images
