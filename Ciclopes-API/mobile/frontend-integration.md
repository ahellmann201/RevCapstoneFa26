# Ciclopes frontend integration pieces

The ONNX demo page is one example interface. Frontend developers can keep its
workflow or build a different one using the inference and API modules below.
These modules expose data and operations; they do not impose a screen layout.

## On-device inference

- Android/Capacitor: `@revmetrix/ciclopes-lane-analysis` is the local Capacitor
  plugin in `mobile/capacitor-plugin`. It exposes `isAvailable()`,
  `analyzeFrame({ frameUri, width, height, rotation, detectLane })`, and
  `applyLaneCorrection({ corners, coordinateSpace, frameWidth, frameHeight })`.
- Browser: `frontend/js/web_lane_inference.js` exports
  `initializeWebInference()`, `analyzeCanvas(canvas, options)`, and
  `applyWebLaneCorrection(corners, width, height)` with the same normalized
  lane/ball result shape.

The frame result uses normalized upright-image coordinates. Lane corners are
top-left, top-right, bottom-right, bottom-left. Ball boxes are
`[left, top, right, bottom]`.

## Ciclopes API client

`frontend/js/ciclopes_api_client.js` is a UI-independent JavaScript module:

```js
import {
  uploadVideoToCiclopes,
  submitFrameResultsToCiclopes,
} from "./ciclopes_api_client.js";

const videoKey = await uploadVideoToCiclopes(videoFile, apiBaseUrl);
const analysis = await submitFrameResultsToCiclopes({
  apiBaseUrl,
  videoKey,
  fps: 30,
  frames: sampledFrames,
});
```

Each item in `frames` has `timeSeconds`, `width`, `height`, `inferenceRan`,
`corners`, `laneSource`, and `result` (`candidates`, `balls`, `health`). The
client converts these into the `POST /laneballs/frame-results` request and
returns the analysis JSON. `uploadVideoToCiclopes` stores the original video
and returns its `video_key`; the frame-results request sends compact detection
data, not images or base64 frames. See [`frame-results-api.md`](frame-results-api.md)
for the full wire contract and response fields.

## Example interface

`frontend/onnx-demo.html` and `frontend/js/onnx_demo.js` demonstrate importing or
recording video, reviewing sampled frames, correcting the lane, optionally
seeding the ball's first lane-contact box, submitting results, and rendering a
plain-language summary. That UI can be replaced independently while keeping
the plugin, browser inference module, and API client.
