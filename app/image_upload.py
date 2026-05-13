"""Image upload helper: EXIF extraction, WebP conversion, and DB update."""

import os
from PIL import Image

from app import db
from app.models import Photos

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(BASE_DIR, 'static', 'game', 'photos')


# ── EXIF extraction (from legacy image_processor.py) ──────────────────────

def _to_float(value):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, tuple) and len(value) == 2 and value[1] != 0:
        return float(value[0]) / float(value[1])
    return float(value)


def _dms_to_decimal(dms, ref):
    degrees = _to_float(dms[0])
    minutes = _to_float(dms[1])
    seconds = _to_float(dms[2])
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ("S", "W"):
        decimal *= -1
    return decimal


def _normalize_gps_ref(ref):
    if isinstance(ref, bytes):
        ref = ref.decode("ascii", errors="ignore")
    return str(ref).strip().upper()


def extract_gps(image_path):
    """Extract (lat, lng) from image EXIF GPS data. Returns None if not found."""
    try:
        image = Image.open(image_path)
        exif_data = image.getexif()
        if exif_data:
            gps_info = {}
            if hasattr(exif_data, "get_ifd"):
                gps_info = exif_data.get_ifd(0x8825) or {}
            if not gps_info:
                legacy = exif_data.get(34853)
                if isinstance(legacy, dict):
                    gps_info = legacy
            if gps_info:
                lat_ref = _normalize_gps_ref(gps_info.get(1))
                latitude = gps_info.get(2)
                lng_ref = _normalize_gps_ref(gps_info.get(3))
                longitude = gps_info.get(4)
                if latitude and longitude and lat_ref and lng_ref:
                    lat = _dms_to_decimal(latitude, lat_ref)
                    lng = _dms_to_decimal(longitude, lng_ref)
                    return (lat, lng)
    except Exception as e:
        print(f"EXIF extraction error for {image_path}: {e}")
    return None


# ── WebP conversion ───────────────────────────────────────────────────────

def convert_to_webp(source_path, quality=85):
    """Convert an image to WebP, strip all EXIF, save to photos dir.
    Returns the new WebP filename (just the basename).
    """
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    img = Image.open(source_path)
    # Convert to RGB if necessary (WebP doesn't support all modes)
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGBA')
    else:
        img = img.convert('RGB')

    # Preserve original filename stem but force .webp extension
    stem, _ = os.path.splitext(os.path.basename(source_path))
    webp_filename = f"{stem}.webp"
    webp_path = os.path.join(PHOTOS_DIR, webp_filename)

    img.save(webp_path, 'WEBP', quality=quality, exif=b'')
    return webp_filename


# ── DB update ─────────────────────────────────────────────────────────────

def add_photo_record(image_path, lat, lng):
    """Insert a new location entry and return the new id."""
    photo = Photos(
        image_path=f"/static/game/photos/{image_path}",
        latitude=float(lat),
        longitude=float(lng),
    )
    db.session.add(photo)
    db.session.commit()
    
    try:
        sync_photos_to_json()
    except Exception as e:
        print(f"Error syncing photos to JSON: {e}")

    return photo.pid

def sync_photos_to_json():
    """Dump all photo records from the database to photos.json."""
    import json
    photos = Photos.query.all()
    data = []
    for p in photos:
        data.append({
            'pid': p.pid,
            'image_path': p.image_path,
            'latitude': p.latitude,
            'longitude': p.longitude,
            'timestamp': p.timestamp.isoformat() if p.timestamp else None
        })
    json_path = os.path.join(BASE_DIR, '..', 'photos.json')
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=4)

def load_photos_from_json():
    """Load photo records from photos.json into the database."""
    import json
    from datetime import datetime
    json_path = os.path.join(BASE_DIR, '..', 'photos.json')
    if not os.path.exists(json_path):
        return 0
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    added = 0
    for item in data:
        existing = Photos.query.filter_by(image_path=item['image_path']).first()
        if not existing:
            dt = datetime.fromisoformat(item['timestamp']) if item.get('timestamp') else datetime.utcnow()
            
            existing_pid = Photos.query.get(item['pid'])
            photo = Photos(
                image_path=item['image_path'],
                latitude=item['latitude'],
                longitude=item['longitude'],
                timestamp=dt
            )
            if not existing_pid:
                photo.pid = item['pid']
            
            db.session.add(photo)
            added += 1
    
    if added > 0:
        db.session.commit()
    return added
