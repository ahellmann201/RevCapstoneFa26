# Android inference bridge contract

The web frontend remains shared JavaScript/HTML. Android performs the ONNX
inference in a native Android layer and returns decoded lane candidates to the
web UI. Assuming the app uses Capacitor, expose this through a custom Android
Capacitor plugin. Keep the analysis payload independent of Capacitor so the
inference core can still be reused if the packaging choice changes.

## Native capability

Expose a plugin named `CiclopesLaneAnalysis` with:

- `isAvailable()`: whether the Android ONNX runtime and compatible model are
  ready;
- `analyzeFrame({frameUri, width, height, rotation})`: run one selected video
  frame through local detection, returning normalized lane candidates and
  health signals; and
- `applyLaneCorrection({corners, coordinateSpace})`: use a user-adjusted
  normalized quadrilateral for local homography/trajectory processing; and
- `release()`: free the ONNX session and native buffers when analysis ends.

The JavaScript wrapper can declare this interface with Capacitor's
`registerPlugin`:

```ts
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface CiclopesLaneAnalysisPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  analyzeFrame(options: {
    frameUri: string;
    width: number;
    height: number;
    rotation: number;
  }): Promise<LaneFrameResult>;
  applyLaneCorrection(options: {
    corners: Array<{ x: number; y: number }>;
    coordinateSpace: 'normalized_frame';
  }): Promise<{ accepted: boolean }>;
  release(): Promise<void>;
}

export interface LaneFrameResult {
  frameWidth: number;
  frameHeight: number;
  candidates: Array<{
    confidence: number;
    corners: Array<{ x: number; y: number }>;
  }>;
  health: Record<string, number>;
}

export const CiclopesLaneAnalysis =
  registerPlugin<CiclopesLaneAnalysisPlugin>('CiclopesLaneAnalysis');

export async function canUseLocalLaneAnalysis(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return false;
  return (await CiclopesLaneAnalysis.isAvailable()).available;
}
```

Call the native plugin only on Android. On iPhone, keep using the frontend's
existing analysis path; do not register an iOS stub that implies local ONNX
support exists.

The `frame` transport should avoid base64 if the chosen wrapper can pass a file
URI, shared buffer, or native camera frame. Keep video decoding and inference
off the UI thread. Return only compact candidate geometry and diagnostics to
JavaScript, not full-resolution segmentation masks unless the overlay needs
them.

## Response shape

Coordinates are normalized against the unrotated source frame. Corner order is
top-left, top-right, bottom-right, bottom-left. This lets the web UI draw the
quad over the corresponding video frame and send a correction back without
depending on pixel resolution.

```json
{
  "frameWidth": 1920,
  "frameHeight": 1080,
  "candidates": [
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
  "health": {
    "meanLaneCoverageRatio": 0.08,
    "homographyConditionNumber": 120.0
  }
}
```

When detection is empty or fails a calibrated quality gate, JavaScript should
show a correction UI: choose a detected candidate when there are several, or
drag the four lane corners. Submit the corrected normalized geometry as
`source: "userCorrection"`; native processing then uses it to build the
homography and calculate the ball path. The frontend owns this UI and should
keep the correction associated with the video/frame used to define it.

## Android runtime notes

Implement the plugin using Capacitor's Android `Plugin` and `@PluginMethod`
API, and add ONNX Runtime's Android package
(`com.microsoft.onnxruntime:onnxruntime-android`) to the Android app/plugin.
Start with CPU or XNNPACK; benchmark NNAPI on
the target phones before choosing it, since accelerator performance depends on
model operators and device support. Keep the ONNX file as an Android app asset
or managed model file. Don't add the model to the watch application.

The bridge must preprocess RGB frames to the export manifest's fixed NCHW
float32 0..1 input, apply letterboxing, decode raw YOLO segmentation outputs,
perform NMS and mask reconstruction, and map lane corners back to normalized
source-frame coordinates. These responsibilities are not implemented by model
export alone.
