#!/usr/bin/env python3
"""
Pont serveur vers les workflows Roboflow Valeo.

MODELE 1 : Détection des produits.
MODELE 2 : Détection / comptage des JIGS.

Le modèle 1 conserve sa compression.
Le modèle 2 reçoit l'image originale pour préserver les petits JIGS.
"""

import concurrent.futures
import json
import os
import sys

from PIL import Image
from inference_sdk import InferenceHTTPClient

# ============================================================
# CONFIGURATION MODELE 1 - PRODUITS
# ============================================================
WORKSPACE_NAME = "iyeds-workspace-tzluv"
WORKFLOW_ID = "valeo-vvaleo-pz9hm-1-resnet18-t1-logic"
PRIMARY_MIN_CONFIDENCE = 0.40

# ============================================================
# CONFIGURATION MODELE 2 - JIGS
# ============================================================
SECOND_WORKSPACE_NAME = "new-workspace-syrvd"
SECOND_WORKFLOW_ID = "valeodetectionororrec-vvaleodetection-rec-ugvjh-1-yolo11n-t1-logic"
JIG_MIN_CONFIDENCE = 0.20


def compress_image(image_path, max_width=640, max_height=480, quality=75):
    """Compression utilisée uniquement pour le modèle 1."""
    try:
        img = Image.open(image_path)

        if img.width > max_width or img.height > max_height:
            img.thumbnail(
                (max_width, max_height),
                Image.Resampling.LANCZOS
            )

        compressed_path = image_path.rsplit(".", 1)[0] + "_compressed.jpg"
        img.save(
            compressed_path,
            "JPEG",
            quality=quality,
            optimize=True
        )
        return compressed_path

    except Exception as e:
        print(f"Compression warning: {e}", file=sys.stderr)
        return image_path


def find_predictions(value):
    """Extrait récursivement les listes 'predictions' d'une réponse Roboflow."""
    all_predictions = []

    if isinstance(value, dict):
        predictions = value.get("predictions")
        if isinstance(predictions, list):
            all_predictions.extend(predictions)

        for child in value.values():
            all_predictions.extend(find_predictions(child))

    elif isinstance(value, list):
        for child in value:
            all_predictions.extend(find_predictions(child))

    return all_predictions


def normalize_detection(prediction, min_confidence):
    """Transforme une prédiction Roboflow en format standard."""
    if not isinstance(prediction, dict):
        return None

    confidence = prediction.get(
        "confidence",
        prediction.get("confidence_score", 0)
    )

    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        return None

    if confidence < min_confidence:
        return None

    label = (
        prediction.get("class")
        or prediction.get("class_name")
        or prediction.get("label")
    )

    if not label:
        return None

    return {
        "product": str(label),
        "confidence": confidence,
        "x": prediction.get("x"),
        "y": prediction.get("y"),
        "width": prediction.get("width"),
        "height": prediction.get("height")
    }


def main(image_path):
    api_key = os.environ.get("VALEO_ROBOFLOW_API_KEY")
    if not api_key:
        raise RuntimeError("VALEO_ROBOFLOW_API_KEY est manquante")

    second_api_key = os.environ.get("VALEO_ROBOFLOW_SECOND_API_KEY")
    if not second_api_key:
        raise RuntimeError("VALEO_ROBOFLOW_SECOND_API_KEY est manquante")

    compressed_path = compress_image(image_path)

    first_client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=api_key
    )

    second_client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=second_api_key
    )

    def run_first_workflow():
        try:
            return first_client.run_workflow(
                workspace_name=WORKSPACE_NAME,
                workflow_id=WORKFLOW_ID,
                images={"image": compressed_path},
                use_cache=True
            )
        except Exception as e:
            print(f"Error in first workflow: {e}", file=sys.stderr)
            return {}

    def run_second_workflow():
        try:
            return second_client.run_workflow(
                workspace_name=SECOND_WORKSPACE_NAME,
                workflow_id=SECOND_WORKFLOW_ID,
                images={"image": image_path},
                use_cache=False
            )
        except Exception as e:
            print(f"Error in second workflow: {e}", file=sys.stderr)
            return {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(run_first_workflow)
        second_future = executor.submit(run_second_workflow)
        first_result = first_future.result()
        second_result = second_future.result()

    # ========================================================
    # MODELE 1 - PRODUITS
    # ========================================================
    product_detections = []

    for prediction in find_predictions(first_result):
        detection = normalize_detection(
            prediction,
            PRIMARY_MIN_CONFIDENCE
        )
        if detection:
            detection["model"] = "primary"
            product_detections.append(detection)

    counts = {}
    for detection in product_detections:
        product = detection["product"]
        counts[product] = counts.get(product, 0) + 1

    # ========================================================
    # MODELE 2 - JIGS
    # ========================================================
    jig_detections = []
    second_predictions = find_predictions(second_result)

    print(
        f"[JIG] Predictions brutes : {len(second_predictions)}",
        file=sys.stderr
    )

    for prediction in second_predictions:
        detection = normalize_detection(
            prediction,
            JIG_MIN_CONFIDENCE
        )
        if detection:
            detection["model"] = "secondary"
            jig_detections.append(detection)

    jig_counts = {}
    for detection in jig_detections:
        jig = detection["product"]
        jig_counts[jig] = jig_counts.get(jig, 0) + 1

    jig_count = len(jig_detections)

    print(
        f"[JIG] Après seuil {JIG_MIN_CONFIDENCE:.2f} : {jig_count}",
        file=sys.stderr
    )

    # ========================================================
    # NETTOYAGE
    # ========================================================
    try:
        if compressed_path != image_path and os.path.exists(compressed_path):
            os.remove(compressed_path)
    except Exception:
        pass

    result = {
        "detections": product_detections,
        "counts": counts,
        "jig_detections": jig_detections,
        "jig_count": jig_count,
        "jig_counts": jig_counts
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: inference.py IMAGE_PATH")
    main(sys.argv[1])
