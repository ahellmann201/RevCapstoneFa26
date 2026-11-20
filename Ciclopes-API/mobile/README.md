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

The export writes `mobile/models/ciclopes_lane_ball.onnx` and `manifest.json`,
and stages a copy in
`mobile/capacitor-plugin/android/src/main/assets/ciclopes_lane_ball.onnx`.
The `mobile/models` copy is generated and ignored; the Android plugin asset is
committed so a fresh checkout can build and run the demo without exporting the
model again. This YOLO26 export returns 300 end-to-end detections in `output0`
plus mask prototypes in `output1`; it does not need a separate NMS stage. The
manifest records the actual graph shapes and preprocessing contract.

## On-device lane candidate design

The mobile demo uses lightweight postprocessing for interactive frame review.
The ONNX graph emits end-to-end detections and mask prototypes; the browser
and Android adapter decode lane masks into normalized lane quadrilaterals.
End-to-end graph output does not remove the need to deduplicate and validate
lane candidates for this use case.

Candidate handling follows these choices:

- Lane proposals need confidence of at least `0.20`; ball detections retain
  the general `0.10` threshold.
- Before decoding a lane mask, box NMS removes near-identical lane proposals
  with IoU at or above `0.78`. The high threshold suppresses duplicates while
  retaining distinct neighboring lanes.
- Mask geometry keeps the widest contiguous foreground run on each row,
  requires coherent vertical support, and uses median boundary estimates for
  the far and near edges. Failed masks are discarded instead of being shown
  as rectangular lanes derived from detection boxes.
- Shared frontend postprocessing rejects implausibly small or short
  quadrilaterals and applies polygon NMS at IoU `0.68` in normalized frame
  coordinates.
- Before processing a full clip, the demo scans its first three sampled
  frames. It matches candidates by polygon overlap or corner proximity, ranks
  them by opening-frame support, and asks the user to choose if multiple lanes
  remain. A single candidate proceeds automatically.

These thresholds and geometry checks are postprocessing heuristics, not a
replacement for model evaluation. They reduce duplicates and fragments but
cannot correct a consistently misplaced segmentation mask. Validate changes
against labeled footage with multiple lanes, camera angles, and partial
occlusions. The Python server pipeline above is separate and remains the
reference implementation.

## Integration sequence

1. Compare ONNX Runtime outputs and decoded masks with PyTorch on a fixed set
   of representative frames; measure accuracy, latency, and memory on target
   Android and iOS devices.
2. The initial Capacitor Android plugin is in `mobile/capacitor-plugin`. It
   contains 640x640 RGB letterboxing, ONNX Runtime execution, YOLO26 output
   decoding, lane mask prototype decoding, lane candidate corners, ball boxes,
   and normalized-corner homography construction. Gradle packages the model
   from its `android/src/main/assets` directory; inference runs on a worker
   thread.
3. Compare decoded candidates with the Python pipeline and representative
   frames, then refine mask-to-quadrilateral fitting. The existing Python
   postprocessing remains the behavioral reference.
4. The Android correction method validates a user quadrilateral and returns
   its source-pixel-to-lane-meter homography. A full multi-frame ball tracking
   and kinematics pass using that correction still needs implementation.
5. If lane confidence/geometry health is poor, request a user correction.
   Persist normalized frame coordinates so corrections survive resize and
   video playback. Allow a detected-lane choice when multiple candidates exist.
6. Keep the API upload route available as an optional server fallback until
   device parity and performance are acceptable.

The plugin expects the Capacitor Android host project to include this local
package. Its committed model asset is packaged at build time. The plugin has been
built against the current frontend Capacitor Android project and its native
smoke tests pass on an Android emulator. The smoke test uses a synthetic image;
real bowling footage and a physical Android phone are still needed to evaluate
detection quality and device performance.

See `mobile/android/bridge-contract.md` for the JavaScript/native interface.
The exact bridge adapter depends on whether the frontend packages its web app
with Capacitor, a WebView shell, or another native wrapper. Do not place this
work in the separate Android watch app.

The reusable browser and API-client pieces for the shared JavaScript frontend
are documented in [`frontend-integration.md`](frontend-integration.md).
