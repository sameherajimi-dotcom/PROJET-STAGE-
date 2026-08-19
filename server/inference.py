#!/usr/bin/env python3

import json
import os
import sys

from PIL import Image
from inference_sdk import InferenceHTTPClient
from ultralytics import YOLO


WORKSPACE_NAME = "iyeds-workspace-tzluv"
WORKFLOW_ID = "valeo-vvaleo-pz9hm-1-resnet18-t1-logic"
PRIMARY_MIN_CONFIDENCE = 0.40

JIG_MIN_CONFIDENCE = 0.20

MODEL2_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "best.pt"
)


def compress_image(image_path, max_width=640, max_height=480, quality=75):
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

    x = prediction.get("x")
    y = prediction.get("y")
    width = prediction.get("width")
    height = prediction.get("height")

    if x is None and "detection_box" in prediction:
        box = prediction["detection_box"]

        x = box.get("x")
        y = box.get("y")
        width = box.get("width")
        height = box.get("height")

    try:
        x = float(x) if x is not None else None
        y = float(y) if y is not None else None
        width = float(width) if width is not None else None
        height = float(height) if height is not None else None
    except (TypeError, ValueError):
        pass

    return {
        "product": str(label),
        "confidence": confidence,
        "x": x,
        "y": y,
        "width": width,
        "height": height
    }


def detect_jigs_local(image_path, model):
    detections = []

    results = model.predict(
        source=image_path,
        conf=JIG_MIN_CONFIDENCE,
        verbose=False
    )

    for result in results:
        if result.boxes is None:
            continue

        boxes = result.boxes

        for i in range(len(boxes)):
            confidence = float(boxes.conf[i].item())

            if confidence < JIG_MIN_CONFIDENCE:
                continue

            class_id = int(boxes.cls[i].item())

            if isinstance(model.names, dict):
                label = model.names.get(class_id, str(class_id))
            else:
                label = model.names[class_id]

            xywh = boxes.xywh[i].tolist()

            x = float(xywh[0])
            y = float(xywh[1])
            width = float(xywh[2])
            height = float(xywh[3])

            detections.append({
                "product": str(label),
                "confidence": confidence,
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "model": "secondary"
            })

    return detections


def main(image_path):

    api_key = os.environ.get("VALEO_ROBOFLOW_API_KEY")

    if not api_key:
        raise RuntimeError(
            "VALEO_ROBOFLOW_API_KEY est manquante"
        )

    if not os.path.isfile(image_path):
        raise RuntimeError(
            f"Image introuvable : {image_path}"
        )

    if not os.path.isfile(MODEL2_PATH):
        raise RuntimeError(
            f"Modèle local introuvable : {MODEL2_PATH}"
        )

    compressed_path = compress_image(image_path)

    first_client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=api_key
    )

    try:
        first_result = first_client.run_workflow(
            workspace_name=WORKSPACE_NAME,
            workflow_id=WORKFLOW_ID,
            images={"image": compressed_path},
            use_cache=True
        )

    except Exception as e:
        print(
            f"Error in first workflow: {e}",
            file=sys.stderr
        )
        first_result = {}

    try:
        local_model = YOLO(MODEL2_PATH)

        jig_detections = detect_jigs_local(
            image_path,
            local_model
        )

    except Exception as e:
        print(
            f"Error in local YOLO model: {e}",
            file=sys.stderr
        )
        jig_detections = []

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

    jig_counts = {}

    for detection in jig_detections:

        jig = detection["product"]

        jig_counts[jig] = jig_counts.get(jig, 0) + 1

    jig_count = len(jig_detections)

    print(
        f"[JIG] Modèle local : {MODEL2_PATH}",
        file=sys.stderr
    )

    print(
        f"[JIG] Après seuil {JIG_MIN_CONFIDENCE:.2f} : {jig_count}",
        file=sys.stderr
    )

    try:

        if (
            compressed_path != image_path
            and os.path.exists(compressed_path)
        ):
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

    print(
        json.dumps(
            result,
            ensure_ascii=False
        )
    )


if __name__ == "__main__":

    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: inference.py IMAGE_PATH"
        )

    main(sys.argv[1])