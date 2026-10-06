# Ciclopes mobile inference side path

This is an additive export target for the existing `best_v2_26n.pt` lane/ball
segmentation model. The production FastAPI pipeline remains the reference and
fallback while the Android on-device path is validated. The shared frontend is
expected to remain JavaScript/HTML; Android inference should be exposed through
a native bridge. iPhone can continue using its existing analysis path.

## Export

From `Ciclopes/Ciclopes-API` with the API's Python dependencies installed:

```sh
python scripts/export_mobile_onnx.py --imgsz 640
```

The export writes `mobile/models/ciclopes_lane_ball.onnx` and `manifest.json`.
Model files are generated artifacts and should not be committed. The exported
graph contains raw segmentation heads (`nms=false`); a phone adapter must do
YOLO decoding, NMS, prototype-mask reconstruction, and source-frame coordinate
mapping. The manifest documents the expected RGB, NCHW, float32, 0..1 input.

## Integration sequence

1. Compare ONNX Runtime outputs and decoded masks with PyTorch on a fixed set
   of representative frames; measure accuracy, latency, and memory on target
   Android and iOS devices.
2. Implement preprocessing, ONNX Runtime execution, and output decoding in the
   Android native layer. Keep inference off the UI thread.
3. Feed masks into lane geometry and ball tracking. The existing Python
   postprocessing is the behavioral reference; the phone implementation should
   be ported in small, parity-checked stages.
4. If lane confidence/geometry health is poor, request a user correction.
   Persist normalized frame coordinates so corrections survive resize and
   video playback. Allow a detected-lane choice when multiple candidates exist.
5. Keep the API upload route available as an optional server fallback until
   device parity and performance are acceptable.

This scaffold deliberately does not claim that exporting alone makes the model
phone-ready. Segmentation output decoding and device benchmarks are required
before enabling local analysis by default.

See `mobile/android/bridge-contract.md` for the JavaScript/native interface.
The exact bridge adapter depends on whether the frontend packages its web app
with Capacitor, a WebView shell, or another native wrapper. Do not place this
work in the separate Android watch app.
