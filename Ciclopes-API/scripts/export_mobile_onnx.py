#!/usr/bin/env python3
"""Export the production lane/ball YOLO segmentation checkpoint for mobile ONNX."""

from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

from ultralytics import YOLO

API_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WEIGHTS = API_ROOT / "core" / "weights" / "best_v2_26n.pt"
CLASS_NAMES = {0: "ball", 1: "lane", 2: "pins"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    parser.add_argument("--imgsz", type=int, default=640,
                        help="Mobile input size; benchmark 640 and 1024 on target devices")
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument("--output-dir", type=Path, default=API_ROOT / "mobile" / "models")
    args = parser.parse_args()

    weights = args.weights.expanduser().resolve()
    if not weights.is_file():
        parser.error(f"Weights not found: {weights}")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    model = YOLO(str(weights), task="segment")
    destination = args.output_dir / "ciclopes_lane_ball.onnx"
    with tempfile.TemporaryDirectory(prefix="ciclopes_onnx_") as temp_dir:
        exported = Path(model.export(
            format="onnx", imgsz=args.imgsz, opset=args.opset,
            dynamic=False, simplify=False, half=False, nms=False,
            project=temp_dir, name="export", exist_ok=True,
        )).resolve()
        destination.write_bytes(exported.read_bytes())

    manifest = {
        "model": destination.name,
        "source_weights": weights.name,
        "task": "instance-segmentation",
        "input": {"name": "images", "layout": "NCHW", "color": "RGB",
                  "dtype": "float32", "range": [0, 1], "imgsz": args.imgsz,
                  "letterbox": True},
        "classes": CLASS_NAMES,
        "outputs": {
            "output0": {
                "shape": [1, 300, 38],
                "layout": "[x1,y1,x2,y2,confidence,class_id,mask_coefficients(32)]",
                "box_coordinates": "xyxy in letterboxed model-input pixels",
                "note": "YOLO26 end-to-end top-k detections; filter by confidence. No separate anchor decoding or NMS is required.",
            },
            "output1": {
                "shape": [1, 32, args.imgsz // 4, args.imgsz // 4],
                "layout": "mask prototypes (channels,height,width)",
            },
        },
        "mask_reconstruction": "Multiply each detection's 32 mask coefficients by the flattened 32 prototype maps; reshape to prototype resolution, threshold logits, crop to the box, resize, and undo letterboxing.",
        "opset": args.opset,
        "end_to_end": True,
        "nms_in_graph": False,
    }
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Exported model: {destination}")
    print(f"Wrote manifest: {args.output_dir / 'manifest.json'}")


if __name__ == "__main__":
    main()
