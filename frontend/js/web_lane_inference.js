import * as ort from "onnxruntime-web/wasm";
import modelUrl from "../../Ciclopes-API/mobile/capacitor-plugin/android/src/main/assets/ciclopes_lane_ball.onnx?url";

const INPUT_SIZE = 640;
const PROTO_SIZE = 160;
const PROTO_CHANNELS = 32;
const MAX_DETECTIONS = 300;
const ROW_SIZE = 6 + PROTO_CHANNELS;
const CONFIDENCE_THRESHOLD = 0.1;
const LANE_CONFIDENCE_THRESHOLD = 0.2;
const LANE_BOX_NMS_IOU = 0.78;
const LANE_WIDTH_METERS = 1.0541;
const LANE_LENGTH_METERS = 18.288;

let sessionPromise;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeInput(source) {
  const scale = Math.min(INPUT_SIZE / source.width, INPUT_SIZE / source.height);
  const resizedWidth = Math.round(source.width * scale);
  const resizedHeight = Math.round(source.height * scale);
  const padX = (INPUT_SIZE - resizedWidth) / 2;
  const padY = (INPUT_SIZE - resizedHeight) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not prepare this frame for ONNX inference.");
  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  context.drawImage(source, padX, padY, resizedWidth, resizedHeight);

  const rgba = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const planeSize = INPUT_SIZE * INPUT_SIZE;
  const chw = new Float32Array(planeSize * 3);
  for (let pixel = 0; pixel < planeSize; pixel += 1) {
    const sourceOffset = pixel * 4;
    chw[pixel] = rgba[sourceOffset] / 255;
    chw[planeSize + pixel] = rgba[sourceOffset + 1] / 255;
    chw[planeSize * 2 + pixel] = rgba[sourceOffset + 2] / 255;
  }

  const tensor = new ort.Tensor("float32", chw, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  // Each call creates a temporary canvas. Release its backing bitmap once the
  // input pixels have been copied into the tensor.
  canvas.width = 0;
  canvas.height = 0;

  return {
    tensor,
    scale,
    padX,
    padY,
  };
}

function sourcePoint(modelX, modelY, transform, width, height) {
  return {
    x: clamp((modelX - transform.padX) / transform.scale / width, 0, 1),
    y: clamp((modelY - transform.padY) / transform.scale / height, 0, 1),
  };
}

function medianBoundary(values, from, to) {
  const boundary = [];
  for (let y = Math.max(0, from); y <= Math.min(PROTO_SIZE - 1, to); y += 1) {
    if (values[y] >= 0) boundary.push(values[y]);
  }
  if (!boundary.length) return -1;
  boundary.sort((a, b) => a - b);
  const middle = Math.floor(boundary.length / 2);
  return boundary.length % 2 ? boundary[middle] : (boundary[middle - 1] + boundary[middle]) / 2;
}

function isValidQuad(points) {
  let area = 0;
  let sign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const p = points[index];
    const q = points[(index + 1) % points.length];
    const r = points[(index + 2) % points.length];
    area += p.x * q.y - q.x * p.y;
    const cross = (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
    if (Math.abs(cross) < 1e-8) return false;
    const nextSign = Math.sign(cross);
    if (sign && sign !== nextSign) return false;
    sign = nextSign;
  }
  return Math.abs(area) >= 1e-6;
}

function laneQuad(row, rowOffset, prototypes, box, transform, frameWidth, frameHeight) {
  const minX = Math.max(0, Math.floor(box.x1 * PROTO_SIZE / INPUT_SIZE));
  const maxX = Math.min(PROTO_SIZE - 1, Math.ceil(box.x2 * PROTO_SIZE / INPUT_SIZE));
  const minY = Math.max(0, Math.floor(box.y1 * PROTO_SIZE / INPUT_SIZE));
  const maxY = Math.min(PROTO_SIZE - 1, Math.ceil(box.y2 * PROTO_SIZE / INPUT_SIZE));
  if (maxX <= minX || maxY <= minY) return null;

  const left = new Int32Array(PROTO_SIZE).fill(-1);
  const right = new Int32Array(PROTO_SIZE).fill(-1);
  for (let y = minY; y <= maxY; y += 1) {
    let runLeft = -1;
    let bestLeft = -1;
    let bestRight = -1;
    for (let x = minX; x <= maxX; x += 1) {
      let logit = 0;
      for (let channel = 0; channel < PROTO_CHANNELS; channel += 1) {
        const coeff = row[rowOffset + 6 + channel];
        const protoIndex = (channel * PROTO_SIZE + y) * PROTO_SIZE + x;
        logit += coeff * prototypes[protoIndex];
      }
      const probability = 1 / (1 + Math.exp(-clamp(logit, -30, 30)));
      if (probability >= 0.5) {
        if (runLeft < 0) runLeft = x;
      } else if (runLeft >= 0) {
        if (x - runLeft > bestRight - bestLeft) {
          bestLeft = runLeft;
          bestRight = x - 1;
        }
        runLeft = -1;
      }
    }
    if (runLeft >= 0 && maxX + 1 - runLeft > bestRight - bestLeft) {
      bestLeft = runLeft;
      bestRight = maxX;
    }
    // Keeping the widest contiguous run prevents disconnected mask islands
    // (for example a bowler or pins) from being joined into a false lane.
    if (bestRight - bestLeft >= 2) {
      left[y] = bestLeft;
      right[y] = bestRight;
    }
  }

  let top = -1;
  let bottom = -1;
  for (let y = minY; y <= maxY; y += 1) {
    if (left[y] >= 0 && right[y] > left[y]) { top = y; break; }
  }
  for (let y = maxY; y >= minY; y -= 1) {
    if (left[y] >= 0 && right[y] > left[y]) { bottom = y; break; }
  }
  if (top < 0 || bottom - top < 8) return null;
  let validRows = 0;
  for (let y = top; y <= bottom; y += 1) if (left[y] >= 0) validRows += 1;
  if (validRows < Math.max(8, Math.ceil((bottom - top + 1) * 0.55))) return null;

  const band = Math.max(2, Math.round((bottom - top) * 0.12));
  const lTop = medianBoundary(left, top, Math.min(bottom, top + band));
  const rTop = medianBoundary(right, top, Math.min(bottom, top + band));
  const lBottom = medianBoundary(left, Math.max(top, bottom - band), bottom);
  const rBottom = medianBoundary(right, Math.max(top, bottom - band), bottom);
  if (lTop < 0 || rTop <= lTop || lBottom < 0 || rBottom <= lBottom) return null;

  const points = [
    sourcePoint(lTop * INPUT_SIZE / PROTO_SIZE, top * INPUT_SIZE / PROTO_SIZE, transform, frameWidth, frameHeight),
    sourcePoint(rTop * INPUT_SIZE / PROTO_SIZE, top * INPUT_SIZE / PROTO_SIZE, transform, frameWidth, frameHeight),
    sourcePoint(rBottom * INPUT_SIZE / PROTO_SIZE, bottom * INPUT_SIZE / PROTO_SIZE, transform, frameWidth, frameHeight),
    sourcePoint(lBottom * INPUT_SIZE / PROTO_SIZE, bottom * INPUT_SIZE / PROTO_SIZE, transform, frameWidth, frameHeight),
  ];
  return isValidQuad(points) ? points : null;
}

function boxIoU(left, right) {
  const intersectionWidth = Math.max(0, Math.min(left.x2, right.x2) - Math.max(left.x1, right.x1));
  const intersectionHeight = Math.max(0, Math.min(left.y2, right.y2) - Math.max(left.y1, right.y1));
  const intersection = intersectionWidth * intersectionHeight;
  const union = (left.x2 - left.x1) * (left.y2 - left.y1)
    + (right.x2 - right.x1) * (right.y2 - right.y1) - intersection;
  return union > 0 ? intersection / union : 0;
}

function suppressLaneBoxes(proposals) {
  const ordered = proposals.slice().sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  for (const proposal of ordered) {
    if (kept.some((selected) => boxIoU(selected.box, proposal.box) >= LANE_BOX_NMS_IOU)) continue;
    kept.push(proposal);
  }
  return kept;
}

function predictionRows(outputs) {
  const output = outputs.output0;
  const [batch, first, second] = output.dims;
  if (batch !== 1) throw new Error(`Expected one inference result, got output0 shape ${output.dims}.`);
  if (first === MAX_DETECTIONS && second === ROW_SIZE) return output.data;
  // Some exporters transpose the detection axes. Normalize to [detections, row].
  if (first === ROW_SIZE && second === MAX_DETECTIONS) {
    const rows = new Float32Array(MAX_DETECTIONS * ROW_SIZE);
    for (let row = 0; row < MAX_DETECTIONS; row += 1) {
      for (let column = 0; column < ROW_SIZE; column += 1) {
        rows[row * ROW_SIZE + column] = output.data[column * MAX_DETECTIONS + row];
      }
    }
    return rows;
  }
  throw new Error(`Unexpected ONNX detection output shape [${output.dims}]; expected [1,300,38].`);
}

function decode(outputs, transform, frameWidth, frameHeight, detectLane = true) {
  const predictions = predictionRows(outputs);
  const prototypes = outputs.output1.data;
  const rowCount = Math.min(MAX_DETECTIONS, predictions.length / ROW_SIZE);
  const candidates = [];
  const balls = [];
  const laneProposals = [];
  let lanePredictions = 0;
  let rejectedLaneMasks = 0;

  for (let index = 0; index < rowCount; index += 1) {
    const rowOffset = index * ROW_SIZE;
    const confidence = predictions[rowOffset + 4];
    const classId = Math.round(predictions[rowOffset + 5]);
    if (!Number.isFinite(confidence) || confidence < CONFIDENCE_THRESHOLD) continue;
    const x1 = clamp(predictions[rowOffset], 0, INPUT_SIZE);
    const y1 = clamp(predictions[rowOffset + 1], 0, INPUT_SIZE);
    const x2 = clamp(predictions[rowOffset + 2], 0, INPUT_SIZE);
    const y2 = clamp(predictions[rowOffset + 3], 0, INPUT_SIZE);
    if (x2 <= x1 || y2 <= y1) continue;

    if (classId === 0) {
      balls.push({
        confidence,
        box: [
          sourcePoint(x1, y1, transform, frameWidth, frameHeight).x,
          sourcePoint(x1, y1, transform, frameWidth, frameHeight).y,
          sourcePoint(x2, y2, transform, frameWidth, frameHeight).x,
          sourcePoint(x2, y2, transform, frameWidth, frameHeight).y,
        ],
      });
    } else if (classId === 1 && detectLane) {
      lanePredictions += 1;
      if (confidence < LANE_CONFIDENCE_THRESHOLD) continue;
      laneProposals.push({
        confidence,
        rowOffset,
        box: { x1, y1, x2, y2 },
      });
    }
  }

  for (const proposal of suppressLaneBoxes(laneProposals)) {
    const { confidence, rowOffset, box } = proposal;
    const corners = laneQuad(predictions, rowOffset, prototypes, box, transform, frameWidth, frameHeight);
    if (corners) {
      candidates.push({ confidence, corners, geometrySource: "segmentation-mask" });
    } else {
      rejectedLaneMasks += 1;
    }
  }

  return {
    candidates,
    balls,
    health: {
      inferenceMs: 0,
      laneCount: candidates.length,
      ballCount: balls.length,
      lanePredictions,
      rejectedLaneMasks,
    },
  };
}

export async function initializeWebInference() {
  if (!sessionPromise) {
    // Single-thread WASM works without cross-origin isolation, including Safari/WKWebView.
    ort.env.wasm.numThreads = 1;
    sessionPromise = ort.InferenceSession.create(modelUrl, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    }).catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

export async function analyzeCanvas(canvas, { detectLane = true } = {}) {
  const session = await initializeWebInference();
  const start = performance.now();
  const prepared = makeInput(canvas);
  let outputs;
  try {
    outputs = await session.run({ [session.inputNames[0]]: prepared.tensor });
    const result = decode(outputs, prepared, canvas.width, canvas.height, detectLane);
    result.health.inferenceMs = Math.round(performance.now() - start);
    return result;
  } finally {
    // The prototype output is several megabytes per frame. ONNX Runtime Web
    // keeps its WASM allocations until each Tensor is explicitly disposed.
    prepared.tensor.dispose();
    for (const output of Object.values(outputs ?? {})) output.dispose();
  }
}

function solve(matrix) {
  const size = 8;
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    if (Math.abs(matrix[pivot][column]) < 1e-10) throw new Error("Lane corners do not define a stable mapping.");
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    for (let j = column; j <= size; j += 1) matrix[column][j] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let j = column; j <= size; j += 1) matrix[row][j] -= factor * matrix[column][j];
    }
  }
  return matrix.map((row) => row[size]);
}

export function applyWebLaneCorrection(corners, width, height) {
  if (!Array.isArray(corners) || corners.length !== 4 || width <= 0 || height <= 0) {
    throw new Error("Exactly four lane corners and positive frame dimensions are required.");
  }
  const points = corners.map(({ x, y }) => ({ x: Number(x), y: Number(y) }));
  if (points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1)
      || !isValidQuad(points)) {
    throw new Error("Lane corners must form a valid convex quadrilateral in top-left, top-right, bottom-right, bottom-left order.");
  }
  const target = [[0, LANE_LENGTH_METERS], [LANE_WIDTH_METERS, LANE_LENGTH_METERS], [LANE_WIDTH_METERS, 0], [0, 0]];
  const matrix = [];
  for (let index = 0; index < 4; index += 1) {
    const x = points[index].x * width;
    const y = points[index].y * height;
    const [u, v] = target[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const h = solve(matrix);
  const homography = [...h, 1];
  if (!homography.every(Number.isFinite)) throw new Error("Correction produces an invalid lane mapping.");
  return { accepted: true, homography, laneWidthMeters: LANE_WIDTH_METERS, laneLengthMeters: LANE_LENGTH_METERS };
}
