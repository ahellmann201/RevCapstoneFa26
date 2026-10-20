import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { CiclopesLaneAnalysis } from "@revmetrix/ciclopes-lane-analysis";

const status = document.getElementById("status");
const resultOutput = document.getElementById("result");
const fileInput = document.getElementById("image-file");
const analyzeButton = document.getElementById("analyze");
const manualButton = document.getElementById("manual");
const correctButton = document.getElementById("correct");
const candidateSelect = document.getElementById("candidate");
const preview = document.getElementById("preview");
const frameCanvas = document.getElementById("frame");
const overlayCanvas = document.getElementById("overlay");
const frameContext = frameCanvas.getContext("2d");
const overlayContext = overlayCanvas.getContext("2d");

let frameDimensions = null;
let laneCorners = null;
let result = null;
let draggedCorner = -1;
let canRunOnDevice = false;

function setStatus(message) {
  status.textContent = message;
}

function drawCorners() {
  overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (!laneCorners) return;

  overlayContext.lineWidth = Math.max(3, overlayCanvas.width / 350);
  overlayContext.strokeStyle = "#20d6a1";
  overlayContext.fillStyle = "#ffb000";
  overlayContext.beginPath();
  laneCorners.forEach((point, index) => {
    const x = point.x * overlayCanvas.width;
    const y = point.y * overlayCanvas.height;
    if (index === 0) overlayContext.moveTo(x, y);
    else overlayContext.lineTo(x, y);
  });
  overlayContext.closePath();
  overlayContext.stroke();

  const radius = Math.max(9, overlayCanvas.width / 70);
  laneCorners.forEach((point) => {
    overlayContext.beginPath();
    overlayContext.arc(point.x * overlayCanvas.width, point.y * overlayCanvas.height, radius, 0, 2 * Math.PI);
    overlayContext.fill();
    overlayContext.stroke();
  });
}

function selectCandidate(index) {
  const candidate = result?.candidates[index];
  laneCorners = candidate ? candidate.corners.map(({ x, y }) => ({ x, y })) : null;
  correctButton.disabled = !laneCorners;
  drawCorners();
}

function pointFromPointer(event) {
  const bounds = overlayCanvas.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  };
}

overlayCanvas.addEventListener("pointerdown", (event) => {
  if (!laneCorners) return;
  const point = pointFromPointer(event);
  const threshold = Math.max(0.025, 18 / overlayCanvas.width);
  draggedCorner = laneCorners.findIndex((corner) => Math.hypot(corner.x - point.x, corner.y - point.y) < threshold);
  if (draggedCorner >= 0) overlayCanvas.setPointerCapture(event.pointerId);
});

overlayCanvas.addEventListener("pointermove", (event) => {
  if (draggedCorner < 0) return;
  laneCorners[draggedCorner] = pointFromPointer(event);
  drawCorners();
});

function finishDrag() {
  draggedCorner = -1;
}
overlayCanvas.addEventListener("pointerup", finishDrag);
overlayCanvas.addEventListener("pointercancel", finishDrag);

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
    await image.decode();

    const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    frameCanvas.width = overlayCanvas.width = width;
    frameCanvas.height = overlayCanvas.height = height;
    frameContext.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(objectUrl);

    frameDimensions = { width, height };
    laneCorners = null;
    result = null;
    candidateSelect.replaceChildren(new Option("No detected lane", ""));
    candidateSelect.disabled = true;
    correctButton.disabled = true;
    manualButton.disabled = !canRunOnDevice;
    analyzeButton.disabled = !canRunOnDevice;
    preview.hidden = false;
    drawCorners();
    resultOutput.textContent = `${file.name} (${width} × ${height}) ready.`;
    setStatus("Image ready. Run detection on the Android phone.");
  } catch (error) {
    setStatus(`Could not read image: ${error.message}`);
  }
});

async function writeFrameToCache() {
  const dataUrl = frameCanvas.toDataURL("image/jpeg", 0.92);
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const path = `ciclopes-frame-${Date.now()}.jpg`;
  await Filesystem.writeFile({ path, data, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return { path, uri };
}

analyzeButton.addEventListener("click", async () => {
  if (!frameDimensions || !canRunOnDevice) return;
  analyzeButton.disabled = true;
  setStatus("Running ONNX Runtime on this phone…");
  try {
    const cached = await writeFrameToCache();
    try {
      result = await CiclopesLaneAnalysis.analyzeFrame({
        frameUri: cached.uri,
        width: frameDimensions.width,
        height: frameDimensions.height,
        rotation: 0,
      });
    } finally {
      await Filesystem.deleteFile({ path: cached.path, directory: Directory.Cache }).catch(() => {});
    }

    candidateSelect.replaceChildren();
    result.candidates.forEach((candidate, index) => {
      candidateSelect.add(new Option(`Lane ${index + 1} (${candidate.confidence.toFixed(2)})`, String(index)));
    });
    candidateSelect.disabled = result.candidates.length === 0;
    laneCorners = result.candidates[0]?.corners.map(({ x, y }) => ({ x, y })) ?? null;
    correctButton.disabled = !laneCorners;
    drawCorners();
    resultOutput.textContent = JSON.stringify(result, null, 2);
    setStatus(`Inference finished in ${result.health.inferenceMs} ms. Drag corners to correct the lane.`);
  } catch (error) {
    resultOutput.textContent = error.stack ?? String(error);
    setStatus(`Inference failed: ${error.message}`);
  } finally {
    analyzeButton.disabled = !frameDimensions;
  }
});

candidateSelect.addEventListener("change", () => {
  if (candidateSelect.value !== "") selectCandidate(Number(candidateSelect.value));
});

manualButton.addEventListener("click", () => {
  laneCorners = [
    { x: 0.3, y: 0.25 },
    { x: 0.7, y: 0.25 },
    { x: 0.95, y: 0.98 },
    { x: 0.05, y: 0.98 },
  ];
  correctButton.disabled = false;
  drawCorners();
  setStatus("Drag the four points to match the lane, then apply the correction.");
});

correctButton.addEventListener("click", async () => {
  if (!laneCorners || !frameDimensions) return;
  correctButton.disabled = true;
  try {
    const correction = await CiclopesLaneAnalysis.applyLaneCorrection({
      corners: laneCorners,
      coordinateSpace: "normalized_frame",
      frameWidth: frameDimensions.width,
      frameHeight: frameDimensions.height,
    });
    resultOutput.textContent = JSON.stringify({ detections: result, correction }, null, 2);
    setStatus("Lane correction accepted. The returned homography maps the frame into lane meters.");
  } catch (error) {
    setStatus(`Correction rejected: ${error.message}`);
  } finally {
    correctButton.disabled = !laneCorners;
  }
});

async function initialize() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    canRunOnDevice = false;
    setStatus("Open this test page in the installed Android app to use ONNX inference.");
    resultOutput.textContent = "Local model inference is Android-only.";
    return;
  }
  try {
    const availability = await CiclopesLaneAnalysis.isAvailable();
    canRunOnDevice = availability.available;
    setStatus(availability.available ? "ONNX model is ready on this phone." : `Model unavailable: ${availability.reason ?? "unknown reason"}`);
    analyzeButton.disabled = !canRunOnDevice || !frameDimensions;
    manualButton.disabled = !canRunOnDevice || !frameDimensions;
  } catch (error) {
    setStatus(`Could not initialize the ONNX plugin: ${error.message}`);
  }
}

initialize();
