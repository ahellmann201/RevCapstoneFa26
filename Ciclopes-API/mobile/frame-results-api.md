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
corner order; when present it takes precedence over the detected lane.

Ciclopes chooses the highest-confidence lane candidate when there is no manual
correction, selects the highest-confidence ball box in each submitted frame,
projects the box center into lane meters, and computes the existing quarterly
speed and acceleration result. Frames without a ball detection contribute no
position. This API only analyzes the submitted samples; it does not fetch the
video or rerun ONNX/YOLO. Client inference time is diagnostic metadata supplied
by the client, not a server measurement.

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
      frames: sampledFrames.map(({ frameIndex, timestampSeconds, result }) => ({
        frame_index: frameIndex,
        timestamp_s: timestampSeconds,
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
