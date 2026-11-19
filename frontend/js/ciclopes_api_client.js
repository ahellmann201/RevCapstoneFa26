function normalizeBaseUrl(apiBaseUrl) {
  const value = String(apiBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!value) throw new Error("Enter the Ciclopes API URL.");
  return value;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

/** Upload the original video and return the key used by the Ciclopes API. */
export async function uploadVideoToCiclopes(file, apiBaseUrl) {
  const apiBase = normalizeBaseUrl(apiBaseUrl);
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(`${apiBase}/videos/upload?folder=videos`, {
    method: "POST",
    body: form,
  });
  const body = await readJson(response);
  if (!response.ok) throw new Error(body.detail || body.message || `Upload failed (HTTP ${response.status}).`);
  if (!body.video_key) throw new Error("The upload completed, but Ciclopes did not return a video key.");
  return body.video_key;
}

/** Convert reviewed frame results to the API contract and return the analysis. */
export async function submitFrameResultsToCiclopes({
  apiBaseUrl,
  videoKey,
  frames,
  fps = 30,
  saveName,
}) {
  const apiBase = normalizeBaseUrl(apiBaseUrl);
  if (!videoKey) throw new Error("A stored video key is required to analyze frame results.");
  const sampledFrames = (frames ?? [])
    .map((frame, frameIndex) => !frame.error && frame.result ? ({
      frame_index: frameIndex,
      timestamp_s: frame.timeSeconds,
      inference_ran: Boolean(frame.inferenceRan),
      frame_width: frame.width,
      frame_height: frame.height,
      lanes: frame.corners ? [{
        confidence: frame.laneSource === "manual-fallback" ? 1 : (frame.result.candidates?.[0]?.confidence ?? 0.5),
        corners: frame.corners,
      }] : (frame.result.candidates ?? []).map(({ confidence, corners }) => ({ confidence, corners })),
      balls: frame.result.balls ?? [],
      inference_ms: frame.result.health?.inferenceMs,
    }) : null)
    .filter(Boolean);
  if (!sampledFrames.length) throw new Error("No successfully analyzed frames are available to send.");

  const response = await fetch(`${apiBase}/laneballs/frame-results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_key: videoKey,
      fps,
      frames: sampledFrames,
      corrected_lane_corners: null,
      ...(saveName ? { save_name: saveName } : {}),
    }),
  });
  const body = await readJson(response);
  if (!response.ok) throw new Error(body.detail || `Ciclopes request failed (HTTP ${response.status}).`);
  return body;
}
