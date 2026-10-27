from __future__ import annotations

import logging
import sys
import traceback

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Request
from core.SensorData.sensor_parser import compute_ball_contact_frame
from core.VideoUtil.FrameSplit import split_video_into_frames
from core.VideoUtil.SpacesApiClient import query_json_via_api, query_video_via_api_to_temp_file

from core.LaneBalls.Kinematics import compute_kinematics_per_quarter
from core.LaneBalls.models import BallPos
from core.MockDB.mock_db_reader import load_named_runs, load_shots
from core.MockDB.mock_db_writer import default_run_name, save_named_run_section
from src.modules.LaneBalls.models import (
    BallPoint,
    KinematicsRow,
    LaneBallHealthInfo,
    LaneBallQueryInput,
    LaneBallQueryOutput,
    LaneBallRunInput,
    LaneBallRunOutput,
    LaneFrameResultsInput,
)

logger = logging.getLogger("ciclopes.laneballs_routes")

router = APIRouter(
    prefix="/laneballs",
    tags=["LaneBalls"],
)


def _empty_output(fps: float = 30.0) -> LaneBallRunOutput:
    return LaneBallRunOutput(
        fps=fps,
        ball_points=[],
        kinematics_table=[],
        is_trapezoid=False,
        homography_frame=None,
        health=LaneBallHealthInfo(),
    )


def _get_engine(request: Request):
    engine = getattr(request.app.state, "inference_engine", None)
    if engine is None:
        raise HTTPException(status_code=503, detail="InferenceEngine is not initialized")
    return engine


def _get_settings(request: Request):
    settings = getattr(request.app.state, "settings", None)
    if settings is None:
        raise HTTPException(status_code=503, detail="Application settings are not initialized")
    return settings


def _model_to_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _normalized_points(points) -> np.ndarray:
    return np.asarray([[point.x, point.y] for point in points], dtype=np.float32)


def _analyze_client_frame_results(payload: LaneFrameResultsInput) -> LaneBallRunOutput:
    """Map client ball boxes to lane meters using the best or corrected lane quad."""
    frames = sorted(payload.frames, key=lambda frame: frame.frame_index)
    dimensions = {(frame.frame_width, frame.frame_height) for frame in frames}
    if len(dimensions) != 1:
        raise HTTPException(status_code=422, detail="All submitted frames must use the same upright dimensions")
    if len({frame.frame_index for frame in frames}) != len(frames):
        raise HTTPException(status_code=422, detail="Submitted frame_index values must be unique")
    if any(current.timestamp_s <= previous.timestamp_s for previous, current in zip(frames, frames[1:])):
        raise HTTPException(status_code=422, detail="Frame timestamps must increase with frame_index")

    width, height = next(iter(dimensions))
    for frame in frames:
        for detection in frame.balls:
            x1, y1, x2, y2 = detection.box
            if not (0.0 <= x1 < x2 <= 1.0 and 0.0 <= y1 < y2 <= 1.0):
                raise HTTPException(status_code=422, detail="Ball boxes must be normalized [left, top, right, bottom] coordinates")

    if payload.corrected_lane_corners is not None:
        lane_points = _normalized_points(payload.corrected_lane_corners)
        lane_frame_index = None
    else:
        candidates = [
            (lane.confidence, frame.frame_index, lane.corners)
            for frame in frames
            for lane in frame.lanes
        ]
        if not candidates:
            raise HTTPException(status_code=422, detail="No lane detection was submitted; provide corrected_lane_corners")
        _, lane_frame_index, corners = max(candidates, key=lambda candidate: candidate[0])
        lane_points = _normalized_points(corners)

    src = lane_points * np.asarray([width, height], dtype=np.float32)
    dst = np.asarray(
        [[0.0, 18.288], [1.0541, 18.288], [1.0541, 0.0], [0.0, 0.0]],
        dtype=np.float32,
    )
    if not cv2.isContourConvex(src.reshape((-1, 1, 2))):
        raise HTTPException(status_code=422, detail="Lane corners must form a convex quadrilateral")
    homography = cv2.getPerspectiveTransform(src, dst)
    if not np.isfinite(homography).all() or abs(float(np.linalg.det(homography))) < 1e-12:
        raise HTTPException(status_code=422, detail="Lane corners do not define a stable mapping")

    positions: list[BallPos] = []
    frames_with_lane = sum(bool(frame.lanes) for frame in frames)
    frames_with_ball = 0
    for frame in frames:
        if not frame.balls:
            continue
        detection = max(frame.balls, key=lambda ball: ball.confidence)
        x1, y1, x2, y2 = detection.box
        center = np.asarray([[[((x1 + x2) * 0.5) * width, ((y1 + y2) * 0.5) * height]]], dtype=np.float32)
        projected = cv2.perspectiveTransform(center, homography)[0, 0]
        if not np.isfinite(projected).all():
            continue
        positions.append(BallPos(
            frame_index=frame.frame_index,
            timestamp_s=frame.timestamp_s,
            x_m=float(projected[0]),
            y_m=float(projected[1]),
        ))
        frames_with_ball += 1

    kinematics = compute_kinematics_per_quarter(positions)
    determinant = float(np.linalg.det(homography))
    condition = float(np.linalg.cond(homography))
    reported_inference_ms = [frame.inference_ms for frame in frames if frame.inference_ms is not None]
    health = LaneBallHealthInfo(
        frames_scanned_for_h=len(frames),
        frames_with_lane=frames_with_lane,
        frames_with_ball=frames_with_ball,
        lane_polygon_count_at_h=sum(len(frame.lanes) for frame in frames),
        homography_determinant=determinant,
        homography_condition_number=condition if np.isfinite(condition) else 0.0,
        mean_lane_coverage_ratio=0.0,
        inference_ms=float(np.mean(reported_inference_ms)) if reported_inference_ms else 0.0,
        postprocess_ms=0.0,
    )
    return LaneBallRunOutput(
        fps=payload.fps,
        ball_points=[BallPoint(x=position.x_m, y=position.y_m) for position in positions],
        kinematics_table=[
            KinematicsRow(
                quarter=row.quarter,
                start_m=row.start_m,
                end_m=row.end_m,
                mean_speed_mps=row.mean_speed_mps,
                mean_acceleration_mps2=row.mean_acceleration_mps2,
                sample_count=row.sample_count,
            )
            for row in kinematics.quarters
        ],
        is_trapezoid=False,
        homography_frame=lane_frame_index,
        health=health,
    )


@router.post("/run", response_model=LaneBallRunOutput)
async def run_lane_ball_pipeline(request: Request, payload: LaneBallRunInput):
    """
    Run the lane-ball detection + kinematics pipeline on a video

    This endpoint runs asynchronously, it does not block SAM3D Body or other concurrent requests because the GPU work is dispatched to a thread-pool executor inside InferenceEngine
    """
    fps = 30.0

    try:
        return await _run_lane_ball_pipeline_inner(request, payload)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "UNHANDLED EXCEPTION in /laneballs/run:\n%s",
            traceback.format_exc(),
        )
        sys.stdout.flush()
        return _empty_output(fps=fps)


async def _run_lane_ball_pipeline_inner(request: Request, payload: LaneBallRunInput) -> LaneBallRunOutput:
    engine = _get_engine(request)
    settings = _get_settings(request)

    if not settings.username or not settings.password:
        raise HTTPException(
            status_code=500,
            detail="Missing API credentials. Set username/password in Ciclopes-API/.env or environment.",
        )

    logger.info("Running /laneballs/run for video_key=%s", payload.video_key)

    try:
        temp_ctx = query_video_via_api_to_temp_file(
            base=settings.api_base,
            verify_api=settings.verify_api,
            username=settings.username,
            password=settings.password,
            key=payload.video_key,
            ttl_seconds=settings.presign_ttl_seconds,
            verify_presigned=settings.verify_presigned,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Video query failed: {exc}")

    with temp_ctx as temp_path:
        split_video = split_video_into_frames(
            str(temp_path),
            max_frames=settings.max_video_frames,
            max_dimension=settings.lane_ball_max_video_dimension,
        )

    if not split_video.frames:
        logger.warning("No frames extracted for video_key=%s", payload.video_key)
        return _empty_output()

    fps = float(split_video.fps) if split_video.fps > 0 else 30.0
    rgb_frames = []
    for vf in split_video.frames:
        rgb_frames.append(cv2.cvtColor(vf.image, cv2.COLOR_BGR2RGB))
        vf.image = None

    split_video.frames.clear()
    del split_video

    # ── Determine start frame from sensor data (or use default) ───────────
    lb_start_frame = settings.lane_ball_start_frame
    if payload.sd_key != "key" and not settings.force_lane_ball_start_frame:
        logger.info("Fetching sensor JSON from bucket: sd_key=%s", payload.sd_key)
        try:
            sensor_data = query_json_via_api(
                base=settings.api_base,
                verify_api=settings.verify_api,
                username=settings.username,
                password=settings.password,
                key=payload.sd_key,
                ttl_seconds=settings.presign_ttl_seconds,
                verify_presigned=settings.verify_presigned,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Sensor JSON query failed: {exc}")

        sensor_info = compute_ball_contact_frame(sensor_data, fps)
        if sensor_info is not None:
            lb_start_frame = sensor_info.ball_contact_frame
            logger.info("Sensor-derived laneball start_frame=%d", lb_start_frame)
        else:
            logger.warning("Could not parse sensor data; falling back to default start_frame")

    try:
        lane_ball_output = await engine.forward_lane_ball(
            frames_rgb=rgb_frames,
            fps=fps,
            start_frame=lb_start_frame,
            batch_size=settings.lane_ball_batch_size,
        )
    except Exception as exc:
        logger.exception("/laneballs/run pipeline failed")
        return _empty_output(fps=fps)
    finally:
        rgb_frames.clear()
        del rgb_frames

    # ── Parse results ─────────────────────────────────────────────────────
    health_raw = lane_ball_output.get("health", {})

    positions = lane_ball_output.get("positions", [])
    quarters = lane_ball_output.get("kinematics", {}).get("quarters", [])

    ball_points = [
        BallPoint(x=float(p.get("x_m", 0.0)), y=float(p.get("y_m", 0.0)))
        for p in positions
    ]

    kinematics_table = [
        KinematicsRow(
            quarter=int(row.get("quarter", 0)),
            start_m=float(row.get("start_m", 0.0)),
            end_m=float(row.get("end_m", 0.0)),
            mean_speed_mps=float(row.get("mean_speed_mps", 0.0)),
            mean_acceleration_mps2=float(row.get("mean_acceleration_mps2", 0.0)),
            sample_count=int(row.get("sample_count", 0)),
        )
        for row in quarters
    ]

    health = LaneBallHealthInfo(
        frames_scanned_for_h=health_raw.get("frames_scanned_for_h", 0),
        frames_with_lane=health_raw.get("frames_with_lane", 0),
        frames_with_ball=health_raw.get("frames_with_ball", 0),
        lane_polygon_count_at_h=health_raw.get("lane_polygon_count_at_h", 0),
        homography_determinant=health_raw.get("homography_determinant", 0.0),
        homography_condition_number=health_raw.get("homography_condition_number", 0.0),
        mean_lane_coverage_ratio=health_raw.get("mean_lane_coverage_ratio", 0.0),
        inference_ms=health_raw.get("inference_ms", 0.0),
        postprocess_ms=health_raw.get("postprocess_ms", 0.0),
    )

    output = LaneBallRunOutput(
        fps=fps,
        ball_points=ball_points,
        kinematics_table=kinematics_table,
        is_trapezoid=lane_ball_output.get("is_trapezoid", False),
        homography_frame=lane_ball_output.get("homography_frame"),
        health=health,
    )
    run_name = payload.save_name or default_run_name(payload.video_key)
    try:
        save_named_run_section(
            name=run_name,
            section="laneballs",
            response=_model_to_dict(output),
            video_key=payload.video_key,
            sd_key=payload.sd_key,
        )
    except Exception:
        logger.exception("Failed to save laneballs run name=%s", run_name)
    return output


@router.post("/frame-results", response_model=LaneBallRunOutput)
async def analyze_client_frame_results(payload: LaneFrameResultsInput):
    """Analyze frame detections produced by a client without rerunning YOLO."""
    output = _analyze_client_frame_results(payload)
    if payload.save_name:
        try:
            save_named_run_section(
                name=payload.save_name,
                section="laneballs",
                response=_model_to_dict(output),
                video_key=payload.video_key,
                sd_key="client-frame-results",
            )
        except Exception:
            logger.exception("Failed to save client frame-results run name=%s", payload.save_name)
    return output


@router.post("/query", response_model=LaneBallQueryOutput)
async def query_lane_ball_shots(payload: LaneBallQueryInput):
    """
    Return saved lane-ball data for one or more shot numbers from the mock DB.
    Missing shot numbers are silently omitted from the response.
    """
    records = load_shots("laneballs", payload.shot_numbers)

    shots: dict[int, LaneBallRunOutput] = {}
    for shot_number, rec in records.items():
        fps = rec.get("fps", 30.0)
        raw_positions = rec.get("ball_positions", [])

        ball_points = [BallPoint(x=p["x"], y=p["y"]) for p in raw_positions]

        ball_pos_objs = [
            BallPos(frame_index=i, timestamp_s=i / fps, x_m=p["x"], y_m=p["y"])
            for i, p in enumerate(raw_positions)
        ]
        kinematics = compute_kinematics_per_quarter(ball_pos_objs)
        kinematics_table = [
            KinematicsRow(
                quarter=q.quarter,
                start_m=q.start_m,
                end_m=q.end_m,
                mean_speed_mps=q.mean_speed_mps,
                mean_acceleration_mps2=q.mean_acceleration_mps2,
                sample_count=q.sample_count,
            )
            for q in kinematics.quarters
        ]

        shots[shot_number] = LaneBallRunOutput(
            fps=fps,
            ball_points=ball_points,
            kinematics_table=kinematics_table,
            health=LaneBallHealthInfo(),
        )

    runs: dict[str, LaneBallRunOutput] = {}
    for name, rec in load_named_runs(payload.names).items():
        section = rec.get("sections", {}).get("laneballs")
        if not section:
            continue
        try:
            runs[name] = LaneBallRunOutput(**section)
        except Exception:
            logger.exception("Failed to parse saved laneballs section for name=%s", name)

    return LaneBallQueryOutput(shots=shots, runs=runs)
