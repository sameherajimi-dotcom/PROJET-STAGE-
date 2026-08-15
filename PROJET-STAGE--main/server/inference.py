#!/usr/bin/env python3
"""Pont serveur vers le workflow Roboflow Valeo.

La clé est lue depuis VALEO_ROBOFLOW_API_KEY : elle ne doit jamais être
ajoutée au dépôt, au JavaScript du navigateur, ou à une page HTML.
"""
import json
import os
import sys

from inference_sdk import InferenceHTTPClient

WORKSPACE_NAME = "iyeds-workspace-tzluv"
WORKFLOW_ID = "valeo-vvaleo-pz9hm-1-resnet18-t1-logic"
SECOND_WORKSPACE_NAME = "new-workspace-syrvd"
SECOND_WORKFLOW_ID = "valeodetectionororrec-vvaleodetection-rec-ugvjh-1-yolo11n-t1-logic"
# The deployed product classifier returns about 43% for the supplied sample.
# Keep a conservative threshold while allowing that valid classification through.
MIN_CONFIDENCE = 0.40


def find_predictions(value):
    """Extrait les prédictions des différentes formes de réponse Workflow."""
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


def normalise_detection(prediction):
    """Normalise les sorties de détection et de classification Roboflow."""
    if not isinstance(prediction, dict):
        return None
    confidence = prediction.get("confidence", prediction.get("confidence_score", 0))
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        return None
    if confidence < MIN_CONFIDENCE:
        return None

    label = prediction.get("class") or prediction.get("class_name") or prediction.get("label")
    if not label:
        return None
    return {
        "product": str(label),
        "confidence": confidence,
        "x": prediction.get("x"),
        "y": prediction.get("y"),
        "width": prediction.get("width"),
        "height": prediction.get("height"),
    }


def main(image_path):
    api_key = os.environ.get("VALEO_ROBOFLOW_API_KEY")
    if not api_key:
        raise RuntimeError("VALEO_ROBOFLOW_API_KEY est manquante")
    second_api_key = os.environ.get("VALEO_ROBOFLOW_SECOND_API_KEY")
    if not second_api_key:
        raise RuntimeError("VALEO_ROBOFLOW_SECOND_API_KEY is missing")

    first_client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=api_key,
    )
    second_client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=second_api_key,
    )

    # First identify the product. Jig counting is not attempted without one.
    first_result = first_client.run_workflow(
        workspace_name=WORKSPACE_NAME,
        workflow_id=WORKFLOW_ID,
        images={"image": image_path},
        use_cache=True,
    )
    product_detections = []
    for prediction in find_predictions(first_result):
        detection = normalise_detection(prediction)
        if detection:
            detection["model"] = "primary"
            product_detections.append(detection)

    counts = {}
    for detection in product_detections:
        product = detection["product"]
        counts[product] = counts.get(product, 0) + 1

    jig_detections = []
    if product_detections:
        second_result = second_client.run_workflow(
            workspace_name=SECOND_WORKSPACE_NAME,
            workflow_id=SECOND_WORKFLOW_ID,
            images={"image": image_path},
            use_cache=True,
        )
        for prediction in find_predictions(second_result):
            detection = normalise_detection(prediction)
            if detection:
                detection["model"] = "secondary"
                jig_detections.append(detection)

    jig_counts = {}
    for detection in jig_detections:
        jig = detection["product"]
        jig_counts[jig] = jig_counts.get(jig, 0) + 1

    print(json.dumps({
        "detections": product_detections,
        "counts": counts,
        "jig_detections": jig_detections,
        "jig_count": len(jig_detections),
        "jig_counts": jig_counts,
    }))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: inference.py IMAGE_PATH")
    main(sys.argv[1])
