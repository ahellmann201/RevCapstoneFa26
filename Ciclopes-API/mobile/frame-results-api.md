# Client frame results API

This is an additive path for the shared JavaScript frontend to send its sampled
ONNX results to Ciclopes. It does not change `/laneballs/run`: that endpoint
still fetches the stored video and runs Ciclopes' server-side detector.

## Endpoint

`POST /laneballs/frame-results`

Send the compact lane and ball detections returned by
`CiclopesLaneAnalysis.analyzeFrame`. Do not send frame images or base64 data.
The frontend supplies the original video frame index and timestamp because the
native plugin analyzes one image at a time.

```json
{
  "video_key": "uploaded-video-key",
  "fps": 30.0,
  "frames": [
    {
      "frame_index": 72,
      "timestamp_s": 2.4,
      "inference_ran": true,
      "frame_width": 1920,
      "frame_height": 1080,
      "lanes": [
        {
          "confidence": 0.91,
          "corners": [
            {"x": 0.41, "y": 0.22},
            {"x": 0.59, "y": 0.22},
            {"x": 0.83, "y": 0.98},
            {"x": 0.17, "y": 0.98}
          ]
        }
      ],
      "balls": [
        {"confidence": 0.84, "box": [0.48, 0.71, 0.53, 0.78]}
      ],
      "inference_ms": 42
    }
  ],
  "corrected_lane_corners": null,
  "save_name": "optional-run-name"
}
```

`frames` can contain up to 600 sampled frames. Every frame must have the same
upright width and height. Coordinates are normalized to `[0, 1]`; lane corners
are ordered top-left, top-right, bottom-right, bottom-left, and ball boxes are
`[left, top, right, bottom]`. Timestamps must be seconds from the start of the
video. `corrected_lane_corners` uses the same normalized coordinate space and
corner order; when present it applies to every frame and takes precedence over
the per-frame detected lane. When it is null, Ciclopes uses each frame's own
highest-confidence lane candidate. Older clients that provide a lane only on
one anchor frame continue to use that lane for frames without a candidate.

The phone demo samples at up to 12 fps, capped at 60 frames per clip. It starts
ONNX on every other sample, then after three successful runs uses the median
time from the last two to select a cadence for the rest of the clip. The cadence
aims to keep model time near a 10-second budget while retaining at least about
two ONNX observations per second when the clip has enough samples; it never
skips more than five samples between runs. The first run is excluded from the
benchmark as a warm-up. All sampled frames remain available for review, and
skipped samples can receive short interpolated ball estimates. It searches for
lane geometry every fourth sample until it finds one, then reuses that lane for
the rest of the fixed-camera clip. After a user draws a reference lane, the
frontend rechecks lane geometry on analyzed frames and accepts an inferred lane
only when at least 15% of the reference polygon's area overlaps it. If no lane
candidate reaches that threshold, the user's polygon is used for that frame.
Without a moving-camera reference, ball inference crops each analyzed frame to
the selected lane, masks pixels outside it, and maps detections back to
full-frame coordinates. With a user reference, lane and ball inference run on
the full frame so the detected lane can move with the camera; ball detections
are then filtered against the selected per-frame polygon. On skipped samples it extrapolates a
short constant-velocity ball box from the last two ONNX observations. Those
boxes carry `source: "predicted"`; measured boxes carry `source: "detected"`.
Predictions are for the brief gap between detections and are not independent
measurements. `inference_ran` identifies which samples actually ran ONNX so the
API confirms floor contact using consecutive detector observations only.

Ciclopes chooses the highest-confidence lane candidate when there is no manual
correction, filters ball boxes to the selected lane, then chooses the
highest-confidence in-lane box. Speed tracking starts only after a detected (not
predicted) bottom-centre appears inside the corrected/detected lane in two
consecutive ONNX runs no more than two seconds apart. After contact is
confirmed, short predicted boxes can fill gaps between measured positions.
Earlier ball boxes are excluded. Accepted bottom-centre points are projected
into lane meters and used to compute quarterly speed and acceleration. The response health object
includes the estimated contact frame/time and counts before and after contact.
If contact cannot be confirmed or fewer than two post-contact positions are
available, the speed rows have zero samples instead of reporting pre-release
movement as bowling speed. These speeds remain estimates: the mobile demo
samples at up to 12 frames per second, capped at 60 samples per clip. Long
clips still use evenly spaced samples across the clip and may miss brief motion
between samples. The model input remains 640 × 640, so cropping focuses detection
on the lane and enlarges it in the model input but does not reduce the model's
fixed neural-network input size. This API only analyzes the submitted samples; it
does not fetch the video or rerun ONNX/YOLO. It applies each submitted frame's
lane polygon and homography independently, so accepted lane changes from a
moving camera affect both ball filtering and meter projection. Client inference time is
diagnostic metadata supplied by the client, not a server measurement.

## JavaScript call

The following maps native plugin results into the API payload. `sampledFrames`
is an array of `{ frameIndex, timestampSeconds, result }`, where `result` is
the response from `analyzeFrame`. Set `apiBaseUrl` to the reachable Ciclopes
server for the current environment.

```js
export async function submitFrameResults({
  apiBaseUrl,
  videoKey,
  fps,
  sampledFrames,
  correctedLaneCorners,
  saveName,
}) {
  const response = await fetch(`${apiBaseUrl}/laneballs/frame-results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_key: videoKey,
      fps,
      frames: sampledFrames.map(({ frameIndex, timestampSeconds, inferenceRan, result }) => ({
        frame_index: frameIndex,
        timestamp_s: timestampSeconds,
        inference_ran: Boolean(inferenceRan),
        frame_width: result.frameWidth,
        frame_height: result.frameHeight,
        lanes: result.candidates,
        balls: result.balls,
        inference_ms: result.health?.inferenceMs,
      })),
      corrected_lane_corners: correctedLaneCorners ?? null,
      save_name: saveName ?? null,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ciclopes frame analysis failed (${response.status}): ${detail}`);
  }
  return response.json(); // LaneBallRunOutput: ball_points, kinematics_table, health, ...
}
```

## Connection configuration

Browser and Capacitor web requests need CORS permission. Local development
origins and the standard Capacitor localhost origins are enabled by default.
Set `CICLOPES_CORS_ORIGINS` to a comma-separated list containing the exact
deployed frontend origins before deployment; do not use `*` with credentials.
The app must use a Ciclopes URL reachable from the running device (for example,
an emulator's host address or a deployed HTTPS API, not the phone's own
`localhost`).

The frame-results route is additive and leaves the existing video-based
`/laneballs/run` contract unchanged.
# Uploading a phone video

The Android demo sends the original clip to Ciclopes before submitting its
sampled ONNX detections. Ciclopes uses its existing `API_BASE`, `API_USERNAME`,
and `API_PASSWORD` server configuration to upload the file to RevMetrix storage;
the storage credential never goes to the phone.

```http
POST /videos/upload?folder=videos
Content-Type: multipart/form-data
```

Multipart field: `file` (MP4, MOV, M4V, WebM, 3GP, or AVI; up to 500 MB).

Response:

```json
{
  "video_key": "videos/example.mp4",
  "filename": "example.mp4"
}
```

Pass `video_key` in the subsequent `POST /laneballs/frame-results` request.
The upload endpoint and frame-results endpoint must use the same reachable
Ciclopes API base URL entered in the Android demo.
