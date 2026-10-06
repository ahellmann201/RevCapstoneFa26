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
        "output": "Raw YOLO segmentation heads; decode/NMS/prototype-mask reconstruction required.",
        "opset": args.opset,
        "nms_in_graph": False,
    }
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Exported model: {destination}")
    print(f"Wrote manifest: {args.output_dir / 'manifest.json'}")


if __name__ == "__main__":
    main()
