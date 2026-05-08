# No longer used — replaced by app/image_upload.py (upload UI on website)
# The EXIF extraction, WebP conversion, and CSV update logic now lives in
# app/image_upload.py and is driven from the /image-upload web page.

import os
import re
import sys

from PIL import Image


def process_folder(folder_path):
    images = {}
    for filename in os.listdir(folder_path):
        if filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            image_path = os.path.join(folder_path, filename)
            images[filename] = process_image(image_path)
    return images


def _to_float(value):
    # Handles EXIF rational values represented as tuples or PIL rational objects.
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


def process_image(image_path):
    # Extracts location data from the image metadata
    try:
        image = Image.open(image_path)
        exif_data = image.getexif()
        if exif_data:
            gps_info = {}

            # Pillow commonly stores GPS data in the GPS IFD, not directly as a dict at tag 34853.
            if hasattr(exif_data, "get_ifd"):
                gps_info = exif_data.get_ifd(0x8825) or {}

            if not gps_info:
                legacy_gps_info = exif_data.get(34853)
                if isinstance(legacy_gps_info, dict):
                    gps_info = legacy_gps_info

            if gps_info:
                lat_ref = _normalize_gps_ref(gps_info.get(1))
                latitude = gps_info.get(2)
                lng_ref = _normalize_gps_ref(gps_info.get(3))
                longitude = gps_info.get(4)
                if latitude and longitude and lat_ref and lng_ref:
                    latitude = _dms_to_decimal(latitude, lat_ref)
                    longitude = _dms_to_decimal(longitude, lng_ref)
                    return (latitude, longitude)
    except Exception as e:
        print(f"Error processing image {image_path}: {e}")
    return None


def update_datafile(datafile_path, images):
    with open(datafile_path, "r", encoding="utf-8") as f:
        content = f.read()

    location_entries = []
    valid_images = [
        (name, coords) for name, coords in sorted(images.items()) if coords is not None
    ]

    for idx, (filename, coords) in enumerate(valid_images, start=1):
        lat, lng = coords
        location_entries.append(
            "    {\n"
            f"        id: {idx},\n"
            f'        imagePath: "game/photos/{filename}",\n'
            f"        lat: {lat:.6f},\n"
            f"        lng: {lng:.6f}\n"
            "    }"
        )

    locations_block = (
        "// Hardcoded locations \n"
        "const uwaLocations = [\n" + ",\n".join(location_entries) + "\n];"
    )

    pattern = r"// Hardcoded locations\s*const uwaLocations\s*=\s*\[[\s\S]*?\];"
    if re.search(pattern, content):
        updated_content = re.sub(pattern, locations_block, content, count=1)
    else:
        updated_content = locations_block + "\n\n" + content

    with open(datafile_path, "w", encoding="utf-8") as f:
        f.write(updated_content)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_photos_dir = os.path.join(script_dir, "photos")
    default_data_file = os.path.join(script_dir, "js", "data.js")

    photos_dir = sys.argv[1] if len(sys.argv) > 1 else default_photos_dir
    data_file = sys.argv[2] if len(sys.argv) > 2 else default_data_file

    if not os.path.isdir(photos_dir):
        print(f"Photos folder not found: {photos_dir}")
        return 1

    if not os.path.isfile(data_file):
        print(f"Data file not found: {data_file}")
        return 1

    images = process_folder(photos_dir)
    update_datafile(data_file, images)
    valid_count = sum(1 for coords in images.values() if coords is not None)
    print(f"Updated {data_file} with {valid_count} image locations.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
