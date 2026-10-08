# Ciclopes Capacitor bridge scaffold

This is a standalone local Capacitor plugin package. It gives the shared web
frontend a typed API and an Android native entry point without depending on
the frontend's component framework. The Android methods currently report that
inference is unavailable; they do not load the ONNX model or analyze frames.

## Frontend usage

Build and install this directory from the Capacitor app, then sync Android:

```sh
npm install ../path/to/Ciclopes-API/mobile/capacitor-plugin
npx cap sync android
```

The frontend can check availability before taking the local-inference path:

```ts
import { Capacitor } from '@capacitor/core';
import { CiclopesLaneAnalysis } from '@revmetrix/ciclopes-lane-analysis';

const localInferenceReady =
  Capacitor.getPlatform() === 'android' &&
  (await CiclopesLaneAnalysis.isAvailable()).available;
```

The web fallback reports unavailable, so iOS can stay on its existing analysis
path. Capacitor's required major version range may need narrowing to match the
frontend app once its version is known.

## Current methods

- `isAvailable()` resolves successfully and reports inference unavailable. This
  is a bridge handshake and a deliberate placeholder until model loading exists.
- `analyzeFrame()` validates that a frame URI was supplied, then rejects with a
  clear not-implemented error.
- `applyLaneCorrection()` is present in the bridge API but not implemented.
- `release()` is currently a no-op.

The next native work is to add frame decoding, ONNX Runtime session loading,
input preprocessing, YOLO26 mask reconstruction, and lane/ball postprocessing.
See `../android/bridge-contract.md` for tensor shapes, normalized geometry,
correction behavior, and payload conventions.

Capacitor uses `registerPlugin()` in JavaScript and a native Android class
extending `Plugin` with `@CapacitorPlugin` and `@PluginMethod` annotations.
See the [Capacitor Android plugin guide](https://next.capacitorjs.com/docs/next/plugins/android).
