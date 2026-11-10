import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { CiclopesLaneAnalysis } from "@revmetrix/ciclopes-lane-analysis";
import { loadNavbar } from "./navbar.js";
import { analyzeCanvas, applyWebLaneCorrection, initializeWebInference } from "./web_lane_inference.js";

loadNavbar();

const status = document.getElementById("status");
const resultOutput = document.getElementById("result");
const technicalOutput = document.getElementById("technical-result");
const fileInput = document.getElementById("image-file");
const analyzeButton = document.getElementById("analyze");
const manualButton = document.getElementById("manual");
const correctButton = document.getElementById("correct");
const candidateSelect = document.getElementById("candidate");
const preview = document.getElementById("preview");
const frameCanvas = document.getElementById("frame");
const overlayCanvas = document.getElementById("overlay");
const imageName = document.getElementById("image-name");
const videoInput = document.getElementById("video-file");
const videoName = document.getElementById("video-name");
const ciclopesApiBaseInput = document.getElementById("ciclopes-api-base");
const uploadStatus = document.getElementById("upload-status");
const uploadResult = document.getElementById("upload-result");
const analysisResult = document.getElementById("ciclopes-analysis-result");
const analysisSummary = document.getElementById("analysis-summary");
const exportShowcaseButton = document.getElementById("export-showcase");
const showcaseStatus = document.getElementById("showcase-status");
const sendCiclopesAnalysisButton = document.getElementById("send-ciclopes-analysis");
const recordStartButton = document.getElementById("record-start");
const recordStopButton = document.getElementById("record-stop");
const recordStatus = document.getElementById("record-status");
const cameraPreview = document.getElementById("camera-preview");
const videoPreview = document.getElementById("video-preview");
const videoFrameReview = document.getElementById("video-frame-review");
const frameList = document.getElementById("frame-list");
const frameProcessingStatus = document.getElementById("frame-processing-status");
const frameReviewStatus = document.getElementById("frame-review-status");
const frameContext = frameCanvas.getContext("2d");
const overlayContext = overlayCanvas.getContext("2d");
const inferenceCanvas = document.createElement("canvas");
const inferenceContext = inferenceCanvas.getContext("2d", { willReadFrequently: true });
const TARGET_ONNX_BUDGET_MS = 10_000;
const MIN_ONNX_OBSERVATIONS_PER_SECOND = 2;
const MAX_INFERENCE_STRIDE = 6;
const forceLegacy60Benchmark = new URLSearchParams(window.location.search).get("benchmark") === "legacy60";

let frameDimensions = null;
let laneCorners = null;
let result = null;
let draggedCorner = -1;
let canRunInference = false;
let useAndroidPlugin = false;
let videoFrames = [];
let selectedVideoFrame = -1;
let lockedLane = null;
let sharedLaneOverride = null;
let laneAnchorFrame = -1;
let frameSelectionVersion = 0;
let videoProcessingInProgress = false;
let ballReprocessPending = false;
let activeInferenceStride = 2;
let recorder = null;
let cameraStream = null;
let recordingChunks = [];
let currentVideoUrl = null;
let uploadedVideoKey = null;

function renderAnalysisSummary(analysis, submittedFrameCount) {
  analysisSummary.replaceChildren();
  const addParagraph = (text, className = "") => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    if (className) paragraph.className = className;
    analysisSummary.append(paragraph);
  };

  const points = Array.isArray(analysis.ball_points) ? analysis.ball_points : [];
  const health = analysis.health ?? {};
  const analyzedFrames = videoFrames.filter((frame) => !frame.error && frame.result);
  const fallbackLaneFrames = analyzedFrames.filter((frame) => frame.laneSource === "manual-fallback").length;
  const fallbackLaneRatio = fallbackLaneFrames / Math.max(1, analyzedFrames.length);
  const detectedCount = Number(health.frames_with_ball ?? points.length);
  const predictedCount = Number(health.frames_with_predicted_ball ?? 0);
  const measuredCount = Math.max(0, detectedCount - predictedCount);
  addParagraph(
    points.length
      ? `Ciclopes mapped ${measuredCount} detected ball positions and ${predictedCount} estimated positions across ${submittedFrameCount} reviewed frames.`
      : Number(health.frames_with_ball_before_contact) > 0
        ? `The ball appeared in ${health.frames_with_ball_before_contact} frames before lane contact could be confirmed. Ciclopes needs two consecutive ONNX detections with the ball on the lane before it reports speed.`
        : `Ciclopes could not confirm the ball on the lane in the ${submittedFrameCount} reviewed frames. Try correcting the lane outline or reviewing frames where the ball is visible.`,
  );
  if (Number.isFinite(Number(health.ball_contact_timestamp_s))) {
    addParagraph(`Speed tracking starts at about ${Number(health.ball_contact_timestamp_s).toFixed(2)} seconds, when the ball was confirmed on the lane.`);
  }

  const quarters = (analysis.kinematics_table ?? [])
    .filter((row) => Number(row.sample_count) > 0 && Number.isFinite(Number(row.mean_speed_mps)))
    .sort((a, b) => Number(a.quarter) - Number(b.quarter));
  if (quarters.length) {
    if (fallbackLaneRatio >= 0.25) {
      addParagraph(`Speed is not shown because the user-drawn lane fallback was used on ${Math.round(fallbackLaneRatio * 100)}% of samples. With a moving camera, that can distort the mapping from pixels to lane distance.`, "analysis-note");
    } else {
      const mph = (mps) => `${(Number(mps) * 2.23694).toFixed(1)} mph`;
      const sampleWeight = quarters.reduce((sum, row) => sum + Number(row.sample_count), 0);
      const weightedMps = quarters.reduce((sum, row) => sum + Number(row.mean_speed_mps) * Number(row.sample_count), 0) / sampleWeight;
      addParagraph(`Estimated average lane speed: ${mph(weightedMps)} across ${sampleWeight} measured intervals.`);
    }
  } else {
    addParagraph("There were not enough ball positions to estimate speed. More clear frames of the ball in motion may help.");
  }

  if (fallbackLaneFrames > 0) {
    addParagraph(`The user-drawn lane was used on ${fallbackLaneFrames} of ${analyzedFrames.length} samples because no overlapping lane inference was available. Since the camera moves, speed and path measurements from those samples may be off.`, "analysis-note");
  }

  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    const lateralFeet = (Number(last.x) - Number(first.x)) * 3.28084;
    const lateralMagnitude = Math.abs(lateralFeet);
    if (Number.isFinite(lateralFeet) && lateralMagnitude >= 0.3) {
      addParagraph(`Across the reviewed frames, the detected path moved about ${lateralMagnitude.toFixed(1)} ft toward the ${lateralFeet > 0 ? "right" : "left"} side of the lane.`);
    } else if (Number.isFinite(lateralFeet)) {
      addParagraph("Across the reviewed frames, the detected path stayed close to the same side-to-side position.");
    }
    const outOfLane = points.some((point) => Number(point.x) < 0 || Number(point.x) > 1.0541 || Number(point.y) < 0 || Number(point.y) > 18.288);
    if (outOfLane) {
      addParagraph("Some plotted positions fall outside the lane dimensions. Check the orange lane outline; an inaccurate outline can distort speed and path measurements.", "analysis-note");
    }
  }

  addParagraph("These are estimates from sampled video frames. Speed begins after lane contact is confirmed by detections; short predicted gaps may contribute between measured positions. Sparse samples and camera movement can make the result imprecise. The path shift describes movement across the lane; it does not measure ball spin.", "analysis-note");
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else line = candidate;
  }
  if (line) context.fillText(line, x, y);
  return y + lineHeight;
}

async function renderShowcaseVideo() {
  if (!videoFrames.length || !analysisSummary.children.length) {
    throw new Error("Run Ciclopes analysis before exporting the showcase.");
  }
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot record the showcase. Try Chrome or Edge on a desktop computer.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  const candidates = videoFrames.filter((frame) => !frame.error && frame.result);
  const maxSlides = 12;
  const slides = candidates.length <= maxSlides
    ? candidates
    : Array.from({ length: maxSlides }, (_, index) => candidates[Math.round(index * (candidates.length - 1) / (maxSlides - 1))]);
  const stream = canvas.captureStream(30);
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("This browser does not support WebM video export.");
  }

  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType });
  const recordingFinished = new Promise((resolve, reject) => {
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener("stop", resolve, { once: true });
    recorder.addEventListener("error", () => reject(recorder.error ?? new Error("Video recording failed.")), { once: true });
  });
  const drawBase = (title, subtitle) => {
    context.fillStyle = "#06232b";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#d06c01";
    context.fillRect(0, 0, canvas.width, 10);
    context.fillStyle = "#f5f7f7";
    context.font = "700 35px system-ui, sans-serif";
    context.fillText(title, 56, 70);
    context.fillStyle = "#afc3c8";
    context.font = "20px system-ui, sans-serif";
    context.fillText(subtitle, 58, 106);
  };

  try {
    recorder.start();
    for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
      const frame = slides[slideIndex];
      drawBase("CICLOPES · SHOT REVIEW", `LANE + BALL DETECTION     ${slideIndex + 1} / ${slides.length}     ${frame.label}`);
      context.fillStyle = "#001116";
      context.fillRect(56, 138, 820, 520);
      const image = new Image();
      image.src = frame.imageUrl;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error(`Could not load ${frame.label} for the showcase.`));
      });
      const scale = Math.min(800 / image.width, 500 / image.height);
      const imageWidth = image.width * scale;
      const imageHeight = image.height * scale;
      const imageX = 66 + (800 - imageWidth) / 2;
      const imageY = 148 + (500 - imageHeight) / 2;
      context.drawImage(image, imageX, imageY, imageWidth, imageHeight);
      const toCanvas = ({ x, y }) => ({ x: imageX + x * imageWidth, y: imageY + y * imageHeight });
      if (frame.corners?.length === 4) {
        context.beginPath();
        frame.corners.map(toCanvas).forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
        context.closePath();
        context.strokeStyle = "#ff9b22";
        context.lineWidth = 5;
        context.stroke();
        context.fillStyle = "rgba(255, 155, 34, .12)";
        context.fill();
      }
      for (const ball of frame.result.balls ?? []) {
        const [left, top, right, bottom] = ball.box;
        context.strokeStyle = ball.source === "predicted" ? "#ffe16a" : "#74e6a1";
        context.lineWidth = 4;
        context.setLineDash(ball.source === "predicted" ? [10, 7] : []);
        context.strokeRect(imageX + left * imageWidth, imageY + top * imageHeight, (right - left) * imageWidth, (bottom - top) * imageHeight);
        context.setLineDash([]);
      }

      context.fillStyle = "#0b333d";
      context.fillRect(902, 138, 322, 520);
      context.fillStyle = "#ff9b22";
      context.font = "700 18px system-ui, sans-serif";
      context.fillText("FRAME FINDINGS", 930, 180);
      context.fillStyle = "#f5f7f7";
      context.font = "25px system-ui, sans-serif";
      let y = 228;
      y = wrapCanvasText(context, frame.laneSource === "inferred-overlap" ? "Lane: detected and matched" : frame.corners ? "Lane: user outline fallback" : "Lane: not found", 930, y, 260, 34);
      y += 18;
      const balls = frame.result.balls ?? [];
      y = wrapCanvasText(context, balls.length ? `Ball boxes: ${balls.length}` : "Ball: no detection on this frame", 930, y, 260, 34);
      y += 12;
      if (balls.length) {
        y = wrapCanvasText(context, `Top confidence: ${Math.max(...balls.map((ball) => Number(ball.confidence) || 0)).toFixed(2)}`, 930, y, 260, 30);
      }
      context.fillStyle = "#b7c9ce";
      context.font = "18px system-ui, sans-serif";
      context.fillText("Orange = lane · Green = detected ball", 930, 612);
      context.fillText("Yellow dashed = estimated ball", 930, 638);
      await delay(650);
    }

    drawBase("SHOT SUMMARY", "Plain-language estimates from the reviewed video samples");
    context.fillStyle = "#0b333d";
    context.fillRect(56, 138, 1168, 520);
    context.fillStyle = "#f5f7f7";
    context.font = "23px system-ui, sans-serif";
    let y = 190;
    for (const paragraph of analysisSummary.querySelectorAll("p")) {
      y = wrapCanvasText(context, paragraph.textContent, 92, y, 1090, 33) + 13;
      if (y > 620) break;
    }
    await delay(5000);
    recorder.stop();
    await recordingFinished;
    return new Blob(chunks, { type: mimeType });
  } catch (error) {
    if (recorder.state !== "inactive") recorder.stop();
    throw error;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

const localDevelopmentHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
ciclopesApiBaseInput.value = import.meta.env.VITE_CICLOPES_API_BASE
  || (localDevelopmentHost ? `${window.location.origin}/ciclopes` : "");

function setStatus(message) {
  status.textContent = message;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function chooseInferenceStride(measuredInferenceMs, sampleCount, durationSeconds) {
  if (!measuredInferenceMs.length || sampleCount < 4) return 2;
  const medianMs = median(measuredInferenceMs);
  const maxRuns = Math.ceil(sampleCount / 2);
  // Keep at least about two ONNX observations per second where the clip allows it.
  const minRuns = Math.min(maxRuns, Math.max(8, Math.ceil(durationSeconds * MIN_ONNX_OBSERVATIONS_PER_SECOND)));
  const budgetRuns = Math.floor(TARGET_ONNX_BUDGET_MS / Math.max(medianMs, 1));
  const targetRuns = Math.min(maxRuns, Math.max(minRuns, budgetRuns));
  return Math.max(2, Math.min(MAX_INFERENCE_STRIDE, Math.ceil(sampleCount / targetRuns)));
}

function showFrameResult(frameResult, { correction = null, error = null } = {}) {
  if (error) {
    resultOutput.textContent = `We couldn’t analyze this frame. ${error.message || error}`;
    technicalOutput.textContent = error.stack || String(error);
    return;
  }

  const laneCount = frameResult?.candidates?.length ?? 0;
  const ballCount = frameResult?.balls?.length ?? 0;
  const ballText = ballCount === 1 ? "1 ball" : `${ballCount} balls`;
  if (correction) {
    resultOutput.textContent = `Lane reference saved for the video. Matching detected lanes will follow camera movement; this outline is the fallback. ${ballText} detected.`;
  } else if (laneCount > 0) {
    const needsReview = frameResult.candidates.some((candidate) => candidate.geometrySource === "detection-box");
    resultOutput.textContent = `We found ${laneCount === 1 ? "a lane" : `${laneCount} possible lanes`}${needsReview ? "; at least one outline is a rough starting box" : ""} and ${ballText}. Check the orange outline; drag its corners if it needs adjusting.`;
  } else {
    const detectionHint = frameResult?.health?.lanePredictions > 0
      ? ` The model saw ${frameResult.health.lanePredictions} lane region${frameResult.health.lanePredictions === 1 ? "" : "s"}, but could not turn the mask into a usable outline.`
      : "";
    resultOutput.textContent = `We couldn’t find the lane automatically${detectionHint}${ballCount ? `, but found ${ballText}` : ""}. Tap “Set lane corners,” then drag the orange dots to outline the lane.`;
  }
  technicalOutput.textContent = JSON.stringify({ detections: frameResult, correction }, null, 2);
}

function drawCorners() {
  overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (!laneCorners) return;

  overlayContext.lineWidth = Math.max(3, overlayCanvas.width / 350);
  overlayContext.strokeStyle = "#e79f40";
  overlayContext.fillStyle = "#d06c01";
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

function persistSelectedFrame() {
  if (selectedVideoFrame >= 0 && videoFrames[selectedVideoFrame]) {
    videoFrames[selectedVideoFrame].corners = laneCorners?.map(({ x, y }) => ({ x, y })) ?? null;
  }
}

function updateSharedLaneCorners(corners) {
  const normalized = corners.map(({ x, y }) => ({ x, y }));
  sharedLaneOverride = normalized.map(({ x, y }) => ({ x, y }));
  laneCorners = normalized;
  lockedLane = { ...(lockedLane ?? { confidence: 1, geometrySource: "manual" }), corners: normalized };
  videoFrames.forEach((frame) => {
    frame.corners = normalized.map(({ x, y }) => ({ x, y }));
    frame.laneOverride = true;
    frame.laneSource = "manual-fallback";
  });
}

function selectCandidate(index) {
  const candidate = result?.candidates[index];
  if (candidate && selectedVideoFrame >= 0) updateSharedLaneCorners(candidate.corners);
  else laneCorners = candidate ? candidate.corners.map(({ x, y }) => ({ x, y })) : null;
  correctButton.disabled = !laneCorners;
  persistSelectedFrame();
  if (selectedVideoFrame >= 0 && laneCorners) videoFrames[selectedVideoFrame].laneOverride = true;
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
  if (selectedVideoFrame >= 0) updateSharedLaneCorners(laneCorners);
  persistSelectedFrame();
  if (selectedVideoFrame >= 0) videoFrames[selectedVideoFrame].laneOverride = true;
  drawCorners();
});

function finishDrag() {
  draggedCorner = -1;
}
overlayCanvas.addEventListener("pointerup", finishDrag);
overlayCanvas.addEventListener("pointercancel", finishDrag);

function clearVideoFrames() {
  videoFrames.forEach((frame) => URL.revokeObjectURL(frame.imageUrl));
  videoFrames = [];
  selectedVideoFrame = -1;
  lockedLane = null;
  sharedLaneOverride = null;
  laneAnchorFrame = -1;
  ballReprocessPending = false;
  frameList.replaceChildren();
  videoFrameReview.hidden = true;
}

function resizeFrame(width, height) {
  const scale = Math.min(1, 1920 / Math.max(width, height));
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  frameCanvas.width = overlayCanvas.width = scaledWidth;
  frameCanvas.height = overlayCanvas.height = scaledHeight;
  inferenceCanvas.width = scaledWidth;
  inferenceCanvas.height = scaledHeight;
  frameDimensions = { width: scaledWidth, height: scaledHeight };
}

function renderFrameList() {
  const scrollTop = frameList.scrollTop;
  videoFrames.forEach((frame, index) => {
    let button = frameList.children[index];
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "frame-choice";
      button.setAttribute("role", "listitem");
      const image = document.createElement("img");
      image.alt = "";
      const caption = document.createElement("span");
      button.append(image, caption);
      button.addEventListener("click", () => showVideoFrame(Number(button.dataset.frameIndex)));
      frameList.append(button);
    }
    button.dataset.frameIndex = String(index);
    button.setAttribute("aria-pressed", String(index === selectedVideoFrame));
    button.classList.toggle("is-selected", index === selectedVideoFrame);
    const image = button.querySelector("img");
    image.src = frame.imageUrl;
    const caption = button.querySelector("span");
    caption.textContent = `${frame.label}${frame.tracked ? " · tracked" : frame.result?.candidates.length ? ` · ${frame.result.candidates.length} lane${frame.result.candidates.length === 1 ? "" : "s"}` : " · no lane"}`;
  });
  while (frameList.children.length > videoFrames.length) frameList.lastElementChild.remove();
  frameList.scrollTop = scrollTop;
}

function showVideoFrame(index) {
  persistSelectedFrame();
  const item = videoFrames[index];
  if (!item) return;
  const selectionVersion = ++frameSelectionVersion;
  selectedVideoFrame = index;
  frameDimensions = { width: item.width, height: item.height };
  result = item.result;
  laneCorners = (item.laneSource === "inferred-overlap" ? item.corners : null)?.map(({ x, y }) => ({ x, y }))
    ?? sharedLaneOverride?.map(({ x, y }) => ({ x, y }))
    ?? item.corners?.map(({ x, y }) => ({ x, y }))
    ?? result?.candidates[0]?.corners.map(({ x, y }) => ({ x, y }))
    ?? null;
  frameCanvas.width = overlayCanvas.width = item.width;
  frameCanvas.height = overlayCanvas.height = item.height;
  const image = new Image();
  image.onload = () => {
    if (selectionVersion !== frameSelectionVersion) return;
    frameContext.clearRect(0, 0, item.width, item.height);
    frameContext.drawImage(image, 0, 0, item.width, item.height);
    preview.hidden = false;
    candidateSelect.replaceChildren();
    if (result?.candidates.length) {
      result.candidates.forEach((candidate, candidateIndex) => {
        const sourceLabel = candidate.geometrySource === "detection-box" ? ", rough box" : "";
        candidateSelect.add(new Option(`Lane ${candidateIndex + 1} (${candidate.confidence.toFixed(2)}${sourceLabel})`, String(candidateIndex)));
      });
      candidateSelect.value = "0";
    } else {
      candidateSelect.add(new Option("No detected lane", ""));
    }
    candidateSelect.disabled = !result?.candidates.length;
    correctButton.disabled = !laneCorners;
    // Manual lane geometry does not need ONNX. Keep correction available when
    // automatic model initialization or detection fails.
    manualButton.disabled = !frameDimensions;
    analyzeButton.disabled = true;
    drawCorners();
    frameReviewStatus.textContent = `Frame ${index + 1} of ${videoFrames.length} · ${item.label}`;
    showFrameResult(result, { correction: item.correction });
    setStatus(`Frame ${index + 1} of ${videoFrames.length} is selected. Review the outline or adjust it below.`);
    renderFrameList();
  };
  image.src = item.imageUrl;
}

function refreshSelectedFrameLane() {
  const item = videoFrames[selectedVideoFrame];
  if (!item) return;
  result = item.result;
  if (!item.laneOverride) {
    laneCorners = (item.laneSource === "inferred-overlap" ? item.corners : null)?.map(({ x, y }) => ({ x, y }))
      ?? sharedLaneOverride?.map(({ x, y }) => ({ x, y }))
      ?? item.corners?.map(({ x, y }) => ({ x, y }))
      ?? result?.candidates[0]?.corners.map(({ x, y }) => ({ x, y }))
      ?? null;
  }
  candidateSelect.replaceChildren();
  if (result?.candidates.length) {
    result.candidates.forEach((candidate, index) => {
      candidateSelect.add(new Option(`Lane ${index + 1} (${candidate.confidence.toFixed(2)})`, String(index)));
    });
    candidateSelect.value = "0";
  } else {
    candidateSelect.add(new Option("No detected lane", ""));
  }
  candidateSelect.disabled = !result?.candidates.length;
  correctButton.disabled = !laneCorners;
  drawCorners();
  showFrameResult(result, { correction: item.correction });
}

function fileFromCanvas(canvas, type = "image/jpeg", quality = 0.88) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode video frame.")), type, quality));
}

async function writeFrameToCache(canvas) {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const path = `ciclopes-frame-${Date.now()}.jpg`;
  await Filesystem.writeFile({ path, data, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return { path, uri };
}

async function runFrameInference({ detectLane = true, canvas = frameCanvas, width = frameDimensions.width, height = frameDimensions.height } = {}) {
  if (!canRunInference) throw new Error("ONNX inference is not available in this environment.");
  if (!useAndroidPlugin) return analyzeCanvas(canvas, { detectLane });
  const cached = await writeFrameToCache(canvas);
  try {
    return await CiclopesLaneAnalysis.analyzeFrame({
      frameUri: cached.uri,
      width,
      height,
      rotation: 0,
      detectLane,
    });
  } finally {
    await Filesystem.deleteFile({ path: cached.path, directory: Directory.Cache }).catch(() => {});
  }
}

function pointInLane(point, corners) {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const a = corners[i];
    const b = corners[j];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonArea(points) {
  return Math.abs(points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function polygonIntersectionArea(subjectPoints, clipPoints) {
  const signedClipArea = clipPoints.reduce((area, point, index) => {
    const next = clipPoints[(index + 1) % clipPoints.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  const orientation = Math.sign(signedClipArea);
  let output = subjectPoints.map(({ x, y }) => ({ x, y }));
  const cross = (a, b) => a.x * b.y - a.y * b.x;

  for (let edgeIndex = 0; edgeIndex < clipPoints.length && output.length; edgeIndex += 1) {
    const edgeStart = clipPoints[edgeIndex];
    const edgeEnd = clipPoints[(edgeIndex + 1) % clipPoints.length];
    const edge = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
    const input = output;
    output = [];
    const inside = (point) => orientation * cross(edge, {
      x: point.x - edgeStart.x,
      y: point.y - edgeStart.y,
    }) >= -1e-9;
    const intersection = (start, end) => {
      const direction = { x: end.x - start.x, y: end.y - start.y };
      const denominator = cross(edge, direction);
      if (Math.abs(denominator) < 1e-12) return { ...end };
      const fromStart = { x: edgeStart.x - start.x, y: edgeStart.y - start.y };
      const amount = cross(edge, fromStart) / denominator;
      return {
        x: start.x + amount * direction.x,
        y: start.y + amount * direction.y,
      };
    };

    let previous = input.at(-1);
    for (const current of input) {
      const previousInside = inside(previous);
      const currentInside = inside(current);
      if (currentInside) {
        if (!previousInside) output.push(intersection(previous, current));
        output.push(current);
      } else if (previousInside) {
        output.push(intersection(previous, current));
      }
      previous = current;
    }
  }
  return output.length >= 3 ? polygonArea(output) : 0;
}

function laneOverlapRatio(referenceCorners, candidateCorners) {
  if (!referenceCorners || !candidateCorners || referenceCorners.length !== 4 || candidateCorners.length !== 4) return 0;
  const referenceArea = polygonArea(referenceCorners);
  if (referenceArea <= 1e-9) return 0;
  return polygonIntersectionArea(referenceCorners, candidateCorners) / referenceArea;
}

function selectLaneOverlappingReference(candidates, referenceCorners) {
  const best = (candidates ?? [])
    .map((candidate) => ({ candidate, overlap: laneOverlapRatio(referenceCorners, candidate.corners) }))
    .sort((a, b) => b.overlap - a.overlap)[0];
  // Require a meaningful intersection with the user-selected lane to avoid
  // attaching a neighbouring lane on a tiny edge overlap.
  return best?.overlap >= 0.15 ? best.candidate : null;
}

function manualLaneCandidate(corners) {
  return { confidence: 1, corners: corners.map(({ x, y }) => ({ x, y })), geometrySource: "manual-fallback" };
}

function keepBallsInsideLane(frameResult, corners) {
  frameResult.balls = (frameResult.balls ?? []).filter((ball) => {
    const [x1, y1, x2, y2] = ball.box;
    return pointInLane({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, corners);
  });
  frameResult.health.ballCount = frameResult.balls.length;
  return frameResult;
}

function cropCanvasToLane(source, corners) {
  if (!corners || corners.length !== 4 || corners.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return null;
  let sign = 0;
  for (let i = 0; i < corners.length; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const c = corners[(i + 2) % corners.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-8 || (sign && Math.sign(cross) !== sign)) return null;
    sign = Math.sign(cross);
  }

  const xs = corners.map(({ x }) => x * source.width);
  const ys = corners.map(({ y }) => y * source.height);
  const padX = Math.max(2, (Math.max(...xs) - Math.min(...xs)) * 0.02);
  const padY = Math.max(2, (Math.max(...ys) - Math.min(...ys)) * 0.02);
  const left = Math.max(0, Math.floor(Math.min(...xs) - padX));
  const top = Math.max(0, Math.floor(Math.min(...ys) - padY));
  const right = Math.min(source.width, Math.ceil(Math.max(...xs) + padX));
  const bottom = Math.min(source.height, Math.ceil(Math.max(...ys) + padY));
  const width = right - left;
  const height = bottom - top;
  if (width < 2 || height < 2) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, width, height);
  context.beginPath();
  corners.forEach((corner, index) => {
    const x = corner.x * source.width - left;
    const y = corner.y * source.height - top;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.clip();
  context.drawImage(source, -left, -top);
  return { canvas, left, top, width, height, sourceWidth: source.width, sourceHeight: source.height, corners };
}

function mapCroppedBallResultToFrame(frameResult, crop) {
  if (!crop) return frameResult;
  frameResult.balls = frameResult.balls
    .map((ball) => {
      const [x1, y1, x2, y2] = ball.box;
      return {
        ...ball,
        box: [
          (crop.left + x1 * crop.width) / crop.sourceWidth,
          (crop.top + y1 * crop.height) / crop.sourceHeight,
          (crop.left + x2 * crop.width) / crop.sourceWidth,
          (crop.top + y2 * crop.height) / crop.sourceHeight,
        ],
      };
    })
    .filter((ball) => {
      const [x1, y1, x2, y2] = ball.box;
      return pointInLane({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, crop.corners);
    });
  frameResult.health.ballCount = frameResult.balls.length;
  return frameResult;
}

async function canvasFromVideoFrame(item) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(`Could not reload sampled frame ${item.label}.`));
    image.src = item.imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = item.width;
  canvas.height = item.height;
  canvas.getContext("2d").drawImage(image, 0, 0, item.width, item.height);
  return canvas;
}

async function reprocessBallsInsideCorrectedLane() {
  if (!sharedLaneOverride || !videoFrames.length) return;
  const ballHistory = [];
  const maxPredictionSamples = Math.max(4, activeInferenceStride - 1);
  const inferenceFrames = videoFrames.filter((frame) => frame.inferenceRan && !frame.error);
  let completed = 0;
  let activeLane = sharedLaneOverride.map(({ x, y }) => ({ x, y }));
  for (let index = 0; index < videoFrames.length; index += 1) {
    const frame = videoFrames[index];
    frame.result ??= { candidates: [], balls: [], health: { inferenceMs: 0, laneCount: 0, ballCount: 0 } };
    if (frame.inferenceRan && !frame.error) {
      frameProcessingStatus.textContent = `Rechecking lane and ball detections (${++completed} of ${inferenceFrames.length})…`;
      const sourceCanvas = await canvasFromVideoFrame(frame);
      // Recheck the full frame so camera motion can be reflected by a lane
      // candidate. Only accept candidates substantially overlapping the
      // user's reference; otherwise retain that reference for this frame.
      const result = await runFrameInference({ detectLane: true, canvas: sourceCanvas, width: frame.width, height: frame.height });
      const matchedLane = selectLaneOverlappingReference(result.candidates, sharedLaneOverride);
      const selectedLane = matchedLane ?? manualLaneCandidate(sharedLaneOverride);
      activeLane = selectedLane.corners.map(({ x, y }) => ({ x, y }));
      frame.corners = activeLane.map(({ x, y }) => ({ x, y }));
      frame.laneSource = matchedLane ? "inferred-overlap" : "manual-fallback";
      frame.laneOverride = true;
      frame.result = keepBallsInsideLane(result, activeLane);
      frame.result.candidates = [selectedLane];
      frame.result.balls = frame.result.balls.map((ball) => ({ ...ball, source: "detected" }));
      const observation = [...frame.result.balls].sort((a, b) => b.confidence - a.confidence)[0];
      if (observation) {
        ballHistory.push({ sampleIndex: index, timeSeconds: frame.timeSeconds, ball: observation });
        if (ballHistory.length > 2) ballHistory.shift();
      }
    } else {
      frame.corners = activeLane.map(({ x, y }) => ({ x, y }));
      frame.laneSource = "manual-fallback";
      frame.laneOverride = true;
      frame.result.candidates = [manualLaneCandidate(activeLane)];
      const trackedBall = predictBall(ballHistory, index, frame.timeSeconds, maxPredictionSamples);
      frame.result.balls = trackedBall ? [trackedBall] : [];
      frame.tracked = Boolean(trackedBall);
      frame.result.health.trackingSource = trackedBall ? "constant-velocity estimate" : "no recent ball detection";
    }
    frame.result.health.ballCount = frame.result.balls.length;
    if (selectedVideoFrame === index) refreshSelectedFrameLane();
    renderFrameList();
  }
  frameProcessingStatus.textContent = `Ball detections were rechecked inside the corrected lane across ${videoFrames.length} samples.`;
}

function waitForVideoEvent(video, eventName) {
  return new Promise((resolve, reject) => {
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The video could not be decoded on this device.")); };
    const cleanup = () => {
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function detectVideoFrames(file) {
  videoProcessingInProgress = true;
  clearVideoFrames();
  laneCorners = null;
  result = null;
  preview.hidden = true;
  correctButton.disabled = true;
  frameList.replaceChildren();
  videoFrameReview.hidden = false;
  frameReviewStatus.textContent = "No frame selected yet.";
  frameProcessingStatus.textContent = "Opening video…";
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const objectUrl = URL.createObjectURL(file);
  if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = objectUrl;
  videoPreview.src = objectUrl;
  videoPreview.hidden = false;
  video.src = objectUrl;
  await waitForVideoEvent(video, "loadedmetadata");
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("This video has no readable duration.");

  // Sample up to 12 fps, cap long clips at 60 frames, and adapt ONNX cadence
  // from measured device inference time. Once a lane is found, inference uses
  // only a masked crop of that lane.
  const maxSamples = 60;
  const samplesPerSecond = 12;
  let inferenceStride = 2;
  const laneSearchStride = 4;
  let maxPredictionSamples = 4;
  activeInferenceStride = inferenceStride;
  const ballHistory = [];
  const benchmarkInferenceMs = [];
  let successfulInferenceCount = 0;
  let adaptiveInferenceMs = null;
  let activeVideoLaneCorners = sharedLaneOverride?.map(({ x, y }) => ({ x, y })) ?? null;
  let activeVideoLaneSource = activeVideoLaneCorners ? "manual-fallback" : null;
  let lastManualReference = sharedLaneOverride;
  const processingStartedAt = performance.now();
  const count = Math.min(maxSamples, Math.max(2, Math.ceil(video.duration * samplesPerSecond)));
  const start = Math.min(0.15, video.duration / 10);
  const end = Math.max(start, video.duration - Math.min(0.08, video.duration / 20));
  const times = Array.from({ length: count }, (_, index) => count === 1 ? start : start + ((end - start) * index) / (count - 1));

  for (let index = 0; index < times.length; index += 1) {
    const timeSeconds = times[index];
    frameProcessingStatus.textContent = `Processing sample ${index + 1} of ${times.length}…`;
    if (Math.abs(video.currentTime - timeSeconds) > 0.01) {
      const seeked = waitForVideoEvent(video, "seeked");
      video.currentTime = timeSeconds;
      await seeked;
    }

    const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    const sampleWidth = Math.max(1, Math.round(video.videoWidth * scale));
    const sampleHeight = Math.max(1, Math.round(video.videoHeight * scale));
    if (inferenceCanvas.width !== sampleWidth || inferenceCanvas.height !== sampleHeight) {
      inferenceCanvas.width = sampleWidth;
      inferenceCanvas.height = sampleHeight;
    }
    inferenceContext.drawImage(video, 0, 0, sampleWidth, sampleHeight);
    const blob = await fileFromCanvas(inferenceCanvas);
    const imageUrl = URL.createObjectURL(blob);
    const frameItem = {
      imageUrl,
      width: sampleWidth,
      height: sampleHeight,
      timeSeconds,
      label: `${timeSeconds.toFixed(2)} s`,
      result: { candidates: [], balls: [], health: { inferenceMs: 0, laneCount: 0, ballCount: 0 } },
      corners: activeVideoLaneCorners?.map(({ x, y }) => ({ x, y })) ?? null,
      correction: null,
      laneOverride: Boolean(sharedLaneOverride),
      laneSource: activeVideoLaneSource,
    };
    videoFrames.push(frameItem);
    renderFrameList();
    const shouldInfer = forceLegacy60Benchmark || index % inferenceStride === 0;
    if (sharedLaneOverride && sharedLaneOverride !== lastManualReference) {
      activeVideoLaneCorners = sharedLaneOverride.map(({ x, y }) => ({ x, y }));
      activeVideoLaneSource = "manual-fallback";
      lastManualReference = sharedLaneOverride;
    }
    const shouldTrackMovingLane = Boolean(sharedLaneOverride);
    const shouldSearchLane = forceLegacy60Benchmark
      ? true
      : shouldTrackMovingLane
      ? shouldInfer
      : !lockedLane && index % laneSearchStride === 0;
    if (shouldInfer) {
      try {
        const inferenceStartedAt = performance.now();
        const laneForBall = sharedLaneOverride ?? lockedLane?.corners;
        // With a user reference lane, infer on the full frame so camera motion
        // can move the matching lane candidate beyond the old crop.
        const crop = laneForBall && !shouldTrackMovingLane && !forceLegacy60Benchmark ? cropCanvasToLane(inferenceCanvas, laneForBall) : null;
        const inferenceSource = crop?.canvas ?? inferenceCanvas;
        frameItem.result = await runFrameInference({
          detectLane: shouldSearchLane,
          canvas: inferenceSource,
          width: inferenceSource.width,
          height: inferenceSource.height,
        });
        if (crop) frameItem.result = mapCroppedBallResultToFrame(frameItem.result, crop);
        if (shouldTrackMovingLane) {
          const matchedLane = selectLaneOverlappingReference(frameItem.result.candidates, sharedLaneOverride);
          const selectedLane = matchedLane ?? manualLaneCandidate(sharedLaneOverride);
          activeVideoLaneCorners = selectedLane.corners.map(({ x, y }) => ({ x, y }));
          activeVideoLaneSource = matchedLane ? "inferred-overlap" : "manual-fallback";
          frameItem.corners = activeVideoLaneCorners.map(({ x, y }) => ({ x, y }));
          frameItem.laneSource = activeVideoLaneSource;
          frameItem.laneOverride = true;
          frameItem.result.candidates = [selectedLane];
          frameItem.result = keepBallsInsideLane(frameItem.result, activeVideoLaneCorners);
        }
        frameItem.result.balls = frameItem.result.balls.map((ball) => ({ ...ball, source: "detected" }));
        frameItem.inferenceRan = true;
        successfulInferenceCount += 1;
        const reportedInferenceMs = Number(frameItem.result.health?.inferenceMs);
        const observedInferenceMs = reportedInferenceMs > 0
          ? reportedInferenceMs
          : performance.now() - inferenceStartedAt;
        if (successfulInferenceCount > 1 && Number.isFinite(observedInferenceMs) && observedInferenceMs > 0) {
          benchmarkInferenceMs.push(observedInferenceMs);
        }
        if (!forceLegacy60Benchmark && successfulInferenceCount === 3 && benchmarkInferenceMs.length) {
          adaptiveInferenceMs = median(benchmarkInferenceMs);
          inferenceStride = chooseInferenceStride(benchmarkInferenceMs, times.length, video.duration);
          activeInferenceStride = inferenceStride;
          maxPredictionSamples = Math.max(4, inferenceStride - 1);
        }
        if (!lockedLane && !sharedLaneOverride && frameItem.result.candidates.length) {
          const bestLane = [...frameItem.result.candidates].sort((a, b) => b.confidence - a.confidence)[0];
          lockedLane = { ...bestLane, corners: bestLane.corners.map(({ x, y }) => ({ x, y })) };
          laneAnchorFrame = index;
          videoFrames.forEach((frame) => { frame.result.candidates = [lockedLane]; });
          frameItem.result.candidates = [lockedLane];
          refreshSelectedFrameLane();
        }
      } catch (error) {
        frameItem.error = error.message;
      }
    }

    frameItem.result ??= { candidates: [], balls: [], health: { inferenceMs: 0, laneCount: 0, ballCount: 0 } };
    if (!frameItem.inferenceRan) {
      const trackedBall = predictBall(ballHistory, index, timeSeconds, maxPredictionSamples);
      frameItem.result.balls = trackedBall ? [trackedBall] : [];
      frameItem.tracked = Boolean(trackedBall);
      frameItem.result.health.trackingSource = trackedBall ? "constant-velocity estimate" : "no recent ball detection";
    } else {
      const observation = [...frameItem.result.balls].sort((a, b) => b.confidence - a.confidence)[0];
      if (observation) {
        ballHistory.push({ sampleIndex: index, timeSeconds, ball: observation });
        if (ballHistory.length > 2) ballHistory.shift();
      }
    }
    if (sharedLaneOverride && !shouldInfer) {
      lockedLane = { ...(lockedLane ?? { confidence: 1, geometrySource: "manual" }), corners: sharedLaneOverride };
      frameItem.corners = activeVideoLaneCorners?.map(({ x, y }) => ({ x, y }))
        ?? sharedLaneOverride.map(({ x, y }) => ({ x, y }));
      frameItem.laneSource = activeVideoLaneSource ?? "manual-fallback";
      frameItem.laneOverride = true;
    }
    if (lockedLane && !sharedLaneOverride) {
      frameItem.result.candidates = [lockedLane];
      frameItem.corners ??= lockedLane.corners.map(({ x, y }) => ({ x, y }));
      frameItem.laneSource ??= "locked-detection";
    }
    frameItem.result.health.laneCount = frameItem.result.candidates.length;
    frameItem.result.health.ballCount = frameItem.result.balls.length;
    if (selectedVideoFrame === index) refreshSelectedFrameLane();
    renderFrameList();
  }

  videoProcessingInProgress = false;
  if (ballReprocessPending && sharedLaneOverride) {
    ballReprocessPending = false;
    await reprocessBallsInsideCorrectedLane();
  }

  renderFrameList();
  let bestLaneFrame = laneAnchorFrame;
  let bestLaneScore = -Infinity;
  if (bestLaneFrame < 0) {
    videoFrames.forEach((frame, index) => {
      const candidates = frame.result?.candidates ?? [];
      if (!candidates.length) return;
      const topConfidence = Math.max(...candidates.map((candidate) => Number(candidate.confidence) || 0));
      const score = topConfidence + Math.min(candidates.length, 5) * 0.001;
      if (score > bestLaneScore) {
        bestLaneScore = score;
        bestLaneFrame = index;
      }
    });
  }
  if (videoFrames.length && selectedVideoFrame < 0) showVideoFrame(bestLaneFrame >= 0 ? bestLaneFrame : 0);
  const successful = videoFrames.filter((frame) => !frame.error).length;
  const inferredCount = videoFrames.filter((frame) => frame.inferenceRan).length;
  const elapsedSeconds = (performance.now() - processingStartedAt) / 1000;
  const inferenceTimes = videoFrames
    .filter((frame) => frame.inferenceRan && Number.isFinite(Number(frame.result?.health?.inferenceMs)))
    .map((frame) => Number(frame.result.health.inferenceMs));
  const averageInferenceMs = inferenceTimes.length
    ? Math.round(inferenceTimes.reduce((sum, value) => sum + value, 0) / inferenceTimes.length)
    : null;
  const timingSummary = `Processed ${videoFrames.length} samples (${inferredCount} ONNX runs) in ${elapsedSeconds.toFixed(1)} s` +
    (averageInferenceMs === null ? "." : `; average ONNX time ${averageInferenceMs} ms per run.`);
  const cadenceSummary = forceLegacy60Benchmark
    ? " Legacy 60-frame baseline: full-frame ONNX ran on every sample."
    : adaptiveInferenceMs === null
      ? ` Using the default cadence of every ${inferenceStride} samples.`
      : ` Device-adaptive cadence: every ${inferenceStride} samples after a ${Math.round(adaptiveInferenceMs)} ms median benchmark.`;
  frameProcessingStatus.textContent = bestLaneFrame >= 0
    ? `${timingSummary}${cadenceSummary} The lane is locked from frame ${bestLaneFrame + 1}; positions between detections are estimates.`
    : `${timingSummary}${cadenceSummary} No lane was detected; set the lane corners manually if needed.`;
  if (!canRunInference) frameProcessingStatus.textContent = "Video is ready, but local ONNX frame detection is unavailable.";
}

function predictBall(history, sampleIndex, timeSeconds, maxGap) {
  const latest = history.at(-1);
  if (!latest) return null;
  const gap = sampleIndex - latest.sampleIndex;
  if (gap <= 0 || gap > maxGap) return null;
  const [x1, y1, x2, y2] = latest.ball.box;
  let centerX = (x1 + x2) / 2;
  let centerY = (y1 + y2) / 2;
  const previous = history.length > 1 ? history[0] : null;
  if (previous && latest.timeSeconds > previous.timeSeconds) {
    const [px1, py1, px2, py2] = previous.ball.box;
    const previousX = (px1 + px2) / 2;
    const previousY = (py1 + py2) / 2;
    const elapsed = timeSeconds - latest.timeSeconds;
    const observedDuration = latest.timeSeconds - previous.timeSeconds;
    centerX += ((centerX - previousX) / observedDuration) * elapsed;
    centerY += ((centerY - previousY) / observedDuration) * elapsed;
  }
  const halfWidth = (x2 - x1) / 2;
  const halfHeight = (y2 - y1) / 2;
  const box = [centerX - halfWidth, centerY - halfHeight, centerX + halfWidth, centerY + halfHeight];
  if (box.some((coordinate) => coordinate < 0 || coordinate > 1)) return null;
  return {
    source: "predicted",
    confidence: Math.max(0.05, latest.ball.confidence * Math.pow(0.82, gap)),
    box,
  };
}

async function uploadVideo(file) {
  const apiBase = ciclopesApiBaseInput.value.trim().replace(/\/$/, "");
  if (!apiBase) {
    uploadStatus.textContent = "Video is ready for local frame detection. Enter the Ciclopes API URL to upload it and send results.";
    return null;
  }

  uploadStatus.textContent = `Sending ${file.name} to Ciclopes for storage… Keep the app open until it finishes.`;
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(`${apiBase}/videos/upload?folder=videos`, {
    method: "POST",
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.message || `Upload failed (HTTP ${response.status}).`);
  if (!body.video_key) throw new Error("The upload completed, but Ciclopes did not return a video key.");
  uploadResult.textContent = JSON.stringify({ file: file.name, videoKey: body.video_key }, null, 2);
  uploadStatus.textContent = "Video stored by Ciclopes. Sampled frames are being analyzed on this device.";
  return body.video_key;
}

async function submitFrameResults(videoKey) {
  const apiBase = ciclopesApiBaseInput.value.trim().replace(/\/$/, "");
  if (!apiBase) return null;

  const sampledFrames = videoFrames
    .map((frame, frameIndex) => !frame.error && frame.result ? ({
      frame_index: frameIndex,
      timestamp_s: frame.timeSeconds,
      inference_ran: Boolean(frame.inferenceRan),
      frame_width: frame.width,
      frame_height: frame.height,
      lanes: (frame.corners ? [{
        confidence: frame.laneSource === "manual-fallback" ? 1 : (frame.result.candidates[0]?.confidence ?? 0.5),
        corners: frame.corners,
      }] : frame.result.candidates.map(({ confidence, corners }) => ({ confidence, corners }))),
      balls: frame.result.balls,
      inference_ms: frame.result.health?.inferenceMs,
    }) : null)
    .filter(Boolean);
  if (!sampledFrames.length) throw new Error("No successfully analyzed frames are available to send.");

  const response = await fetch(`${apiBase}/laneballs/frame-results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_key: videoKey,
      fps: 30,
      frames: sampledFrames,
      // Per-frame lane geometry carries the accepted moving-camera lane. The
      // global correction is omitted so the API can use each frame's lane.
      corrected_lane_corners: null,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || `Ciclopes request failed (HTTP ${response.status}).`);
  }
  return body;
}

async function processVideo(file) {
  if (!file.type.startsWith("video/")) {
    uploadStatus.textContent = "Choose a video file.";
    return;
  }
  videoName.textContent = file.name;
  uploadedVideoKey = null;
  sendCiclopesAnalysisButton.disabled = true;
  analysisResult.hidden = true;
  exportShowcaseButton.disabled = true;
  showcaseStatus.textContent = "";
  analysisSummary.replaceChildren();
  uploadResult.textContent = "";
  videoInput.disabled = true;
  recordStartButton.disabled = true;
  recordStopButton.disabled = true;

  const uploadPromise = uploadVideo(file).catch((error) => {
    uploadStatus.textContent = `Upload failed: ${error.message}. Local frame detection will continue.`;
    return null;
  });
  try {
    await detectVideoFrames(file);
    const videoKey = await uploadPromise;
    if (videoKey) {
      uploadedVideoKey = videoKey;
      uploadResult.textContent = JSON.stringify({ file: file.name, videoKey, sampledFrames: videoFrames.length }, null, 2);
      uploadResult.hidden = false;
      sendCiclopesAnalysisButton.disabled = !ciclopesApiBaseInput.value.trim()
        || !videoFrames.some((frame) => !frame.error && frame.result);
      if (ciclopesApiBaseInput.value.trim()) {
        uploadStatus.textContent = "Video stored and frames detected. Review or correct a lane, then send the results to Ciclopes.";
      } else {
        uploadStatus.textContent = "Video stored and frames detected. Enter a reachable Ciclopes API URL to enable Ciclopes analysis.";
      }
    }
  } catch (error) {
    await uploadPromise;
    frameProcessingStatus.textContent = `Could not analyze this video: ${error.message}`;
  } finally {
    videoProcessingInProgress = false;
    if (ballReprocessPending && sharedLaneOverride) {
      ballReprocessPending = false;
      await reprocessBallsInsideCorrectedLane().catch((error) => {
        frameProcessingStatus.textContent = `Could not recheck balls in the corrected lane: ${error.message}`;
      });
    }
    videoInput.disabled = false;
    recordStartButton.disabled = false;
  }
}

sendCiclopesAnalysisButton.addEventListener("click", async () => {
  if (!uploadedVideoKey) return;
  sendCiclopesAnalysisButton.disabled = true;
  sendCiclopesAnalysisButton.textContent = "Sending frame results…";
  uploadStatus.textContent = "Sending sampled detections and any lane correction to Ciclopes…";
  try {
    const analysis = await submitFrameResults(uploadedVideoKey);
    renderAnalysisSummary(analysis, videoFrames.filter((frame) => !frame.error && frame.result).length);
    uploadResult.textContent = JSON.stringify({
      videoKey: uploadedVideoKey,
      sampledFrames: videoFrames.length,
      ciclopesAnalysis: analysis,
    }, null, 2);
    analysisResult.hidden = false;
    exportShowcaseButton.disabled = false;
    uploadStatus.textContent = `Ciclopes analyzed ${analysis.ball_points.length} ball positions from the submitted frames.`;
  } catch (error) {
    uploadStatus.textContent = `Ciclopes could not analyze these frames: ${error.message}`;
  } finally {
    sendCiclopesAnalysisButton.textContent = "Analyze reviewed frames with Ciclopes";
    sendCiclopesAnalysisButton.disabled = !uploadedVideoKey || !ciclopesApiBaseInput.value.trim();
  }
});

exportShowcaseButton.addEventListener("click", async () => {
  exportShowcaseButton.disabled = true;
  showcaseStatus.textContent = "Building a short showcase video from the reviewed frames…";
  try {
    const blob = await renderShowcaseVideo();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "ciclopes-shot-showcase.webm";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    showcaseStatus.textContent = "Showcase video downloaded. It includes up to 12 reviewed frames and a summary end card.";
  } catch (error) {
    showcaseStatus.textContent = error.message;
  } finally {
    exportShowcaseButton.disabled = false;
  }
});

ciclopesApiBaseInput.addEventListener("input", () => {
  sendCiclopesAnalysisButton.disabled = !uploadedVideoKey || !ciclopesApiBaseInput.value.trim();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  imageName.textContent = file.name;
  selectedVideoFrame = -1;
  clearVideoFrames();
  try {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
    await image.decode();
    resizeFrame(image.naturalWidth, image.naturalHeight);
    frameContext.drawImage(image, 0, 0, frameDimensions.width, frameDimensions.height);
    URL.revokeObjectURL(objectUrl);
    laneCorners = null;
    result = null;
    candidateSelect.replaceChildren(new Option("No detected lane", ""));
    candidateSelect.disabled = true;
    correctButton.disabled = true;
    manualButton.disabled = !frameDimensions;
    analyzeButton.disabled = !canRunInference;
    preview.hidden = false;
    drawCorners();
    resultOutput.textContent = "Image ready. Tap “Run ONNX detection” to check for the lane.";
    technicalOutput.textContent = `${file.name} (${frameDimensions.width} × ${frameDimensions.height})`;
    setStatus("Ready to check this image on this device.");
  } catch (error) {
    setStatus(`Could not read image: ${error.message}`);
  }
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files?.[0];
  if (file) processVideo(file);
});

recordStartButton.addEventListener("click", async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("This device does not support in-app video recording in the current build.");
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.hidden = false;
    await cameraPreview.play();
    recordingChunks = [];
    const mimeType = ["video/mp4;codecs=avc1", "video/webm;codecs=vp8", "video/webm"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    recorder = mimeType ? new MediaRecorder(cameraStream, { mimeType }) : new MediaRecorder(cameraStream);
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) recordingChunks.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      const type = recorder.mimeType || "video/webm";
      const extension = type.includes("mp4") ? "mp4" : "webm";
      const shot = new File([new Blob(recordingChunks, { type })], `revmetrix-shot-${Date.now()}.${extension}`, { type });
      cameraStream?.getTracks().forEach((track) => track.stop());
      cameraStream = null;
      cameraPreview.srcObject = null;
      cameraPreview.hidden = true;
      recordStatus.textContent = "Recording saved. Uploading and analyzing sampled frames…";
      processVideo(shot).finally(() => { recordStatus.textContent = "Recording complete."; });
    }, { once: true });
    recorder.start(250);
    recordStartButton.disabled = true;
    recordStopButton.disabled = false;
    recordStatus.textContent = "Recording. Frame the lane, then tap Stop and analyze.";
  } catch (error) {
    recordStatus.textContent = `Could not start camera: ${error.message}`;
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
});

recordStopButton.addEventListener("click", () => {
  if (recorder?.state === "recording") {
    recordStopButton.disabled = true;
    recordStatus.textContent = "Finishing recording…";
    recorder.stop();
  }
});

analyzeButton.addEventListener("click", async () => {
  if (!frameDimensions || !canRunInference) return;
  analyzeButton.disabled = true;
  setStatus("Running ONNX Runtime on this device…");
  try {
    result = await runFrameInference();
    candidateSelect.replaceChildren();
    result.candidates.forEach((candidate, index) => {
      const sourceLabel = candidate.geometrySource === "detection-box" ? ", rough box" : "";
      candidateSelect.add(new Option(`Lane ${index + 1} (${candidate.confidence.toFixed(2)}${sourceLabel})`, String(index)));
    });
    candidateSelect.disabled = result.candidates.length === 0;
    laneCorners = result.candidates[0]?.corners.map(({ x, y }) => ({ x, y })) ?? null;
    correctButton.disabled = !laneCorners;
    drawCorners();
    showFrameResult(result);
    setStatus(`Frame checked in ${result.health.inferenceMs} ms.`);
  } catch (error) {
    showFrameResult(null, { error });
    setStatus(`Inference failed: ${error.message}`);
  } finally {
    analyzeButton.disabled = !frameDimensions || !canRunInference;
  }
});

candidateSelect.addEventListener("change", () => {
  if (candidateSelect.value !== "") selectCandidate(Number(candidateSelect.value));
});

manualButton.addEventListener("click", () => {
  const manualCorners = [
    { x: 0.3, y: 0.25 },
    { x: 0.7, y: 0.25 },
    { x: 0.95, y: 0.98 },
    { x: 0.05, y: 0.98 },
  ];
  if (selectedVideoFrame >= 0) updateSharedLaneCorners(manualCorners);
  else laneCorners = manualCorners;
  correctButton.disabled = false;
  persistSelectedFrame();
  drawCorners();
  setStatus("Drag the four points to match the lane, then apply the correction.");
});

correctButton.addEventListener("click", async () => {
  if (!laneCorners || !frameDimensions) return;
  correctButton.disabled = true;
  try {
    const correction = useAndroidPlugin
      ? await CiclopesLaneAnalysis.applyLaneCorrection({
        corners: laneCorners,
        coordinateSpace: "normalized_frame",
        frameWidth: frameDimensions.width,
        frameHeight: frameDimensions.height,
      })
      : applyWebLaneCorrection(laneCorners, frameDimensions.width, frameDimensions.height);
    if (selectedVideoFrame >= 0) {
      updateSharedLaneCorners(laneCorners);
      exportShowcaseButton.disabled = true;
      showcaseStatus.textContent = "Lane changed. Run Ciclopes analysis again before exporting an updated showcase.";
      videoFrames[selectedVideoFrame].correction = correction;
      videoFrames[selectedVideoFrame].corners = laneCorners.map(({ x, y }) => ({ x, y }));
      videoFrames[selectedVideoFrame].laneOverride = true;
      if (videoProcessingInProgress) ballReprocessPending = true;
      else await reprocessBallsInsideCorrectedLane();
    }
    showFrameResult(result, { correction });
    setStatus(selectedVideoFrame >= 0
      ? "Lane outline applied to the clip; ball detections were checked inside it."
      : "Lane outline adjusted.");
  } catch (error) {
    setStatus(`Correction rejected: ${error.message}`);
  } finally {
    correctButton.disabled = !laneCorners;
  }
});

async function initialize() {
  try {
    useAndroidPlugin = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
    if (useAndroidPlugin) {
      const availability = await CiclopesLaneAnalysis.isAvailable();
      canRunInference = availability.available;
      setStatus(availability.available ? "ONNX model is ready on this Android device." : `Model unavailable: ${availability.reason ?? "unknown reason"}`);
      technicalOutput.textContent = "Android ONNX Runtime native plugin.";
    } else {
      setStatus("Loading ONNX model for browser inference…");
      await initializeWebInference();
      canRunInference = true;
      setStatus("ONNX model is ready. Browser inference uses WebAssembly on this device.");
      technicalOutput.textContent = "ONNX Runtime Web with the WebAssembly CPU provider.";
    }
    analyzeButton.disabled = !canRunInference || !frameDimensions;
    manualButton.disabled = !frameDimensions;
  } catch (error) {
    canRunInference = false;
    analyzeButton.disabled = true;
    manualButton.disabled = true;
    setStatus(`Could not initialize ONNX inference: ${error.message}`);
  }
}

initialize();
