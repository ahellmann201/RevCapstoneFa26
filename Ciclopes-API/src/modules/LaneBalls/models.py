from __future__ import annotations

from pydantic import BaseModel, Field


class LaneBallRunInput(BaseModel):
    video_key: str = Field(..., description="Object key for input video in bucket")
    sd_key: str = Field("key", description="Sensor data key in bucket; 'key' = test mode (use hardcoded start frame)")
    save_name: str | None = Field(None, description="Optional local name for saving this run for later query")


class NormalizedPoint(BaseModel):
    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)


class ClientLaneCandidate(BaseModel):
    confidence: float = Field(..., ge=0.0, le=1.0)
    # Order: top-left, top-right, bottom-right, bottom-left.
    corners: list[NormalizedPoint] = Field(..., min_length=4, max_length=4)


class ClientBallCandidate(BaseModel):
    confidence: float = Field(..., ge=0.0, le=1.0)
    # Normalized [left, top, right, bottom] coordinates.
    box: list[float] = Field(..., min_length=4, max_length=4)


class ClientFrameResult(BaseModel):
    frame_index: int = Field(..., ge=0)
    timestamp_s: float = Field(..., ge=0.0)
    frame_width: int = Field(..., gt=0, le=16384)
    frame_height: int = Field(..., gt=0, le=16384)
    lanes: list[ClientLaneCandidate] = Field(default_factory=list, max_length=32)
    balls: list[ClientBallCandidate] = Field(default_factory=list, max_length=64)
    inference_ms: float | None = Field(None, ge=0.0, le=60000.0)


class LaneFrameResultsInput(BaseModel):
    """Compact detections produced by the phone/frontend for sampled video frames."""

    video_key: str = Field(..., min_length=1, max_length=1024)
    fps: float = Field(..., gt=0.0, le=240.0)
    frames: list[ClientFrameResult] = Field(..., min_length=1, max_length=600)
    # Optional user correction in normalized upright-frame coordinates.
    corrected_lane_corners: list[NormalizedPoint] | None = Field(None, min_length=4, max_length=4)
    save_name: str | None = Field(None, max_length=256)


class BallPoint(BaseModel):
    x: float
    y: float


class KinematicsRow(BaseModel):
    quarter: int
    start_m: float
    end_m: float
    mean_speed_mps: float
    mean_acceleration_mps2: float
    sample_count: int


class LaneBallHealthInfo(BaseModel):
    frames_scanned_for_h: int = 0
    frames_with_lane: int = 0
    frames_with_ball: int = 0
    lane_polygon_count_at_h: int = 0
    homography_determinant: float = 0.0
    homography_condition_number: float = 0.0
    mean_lane_coverage_ratio: float = 0.0
    inference_ms: float = 0.0
    postprocess_ms: float = 0.0


class LaneBallRunOutput(BaseModel):
    fps: float = Field(..., description="Source video frame rate — use for playback speed on the frontend")
    ball_points: list[BallPoint]
    kinematics_table: list[KinematicsRow]
    is_trapezoid: bool = False
    homography_frame: int | None = None
    health: LaneBallHealthInfo


class LaneBallQueryInput(BaseModel):
    shot_numbers: list[int] = Field(default_factory=list, description="Legacy shot numbers to retrieve from the mock DB")
    names: list[str] = Field(default_factory=list, description="Saved run names to retrieve from the local mock DB")


class LaneBallQueryOutput(BaseModel):
    shots: dict[int, LaneBallRunOutput] = Field(default_factory=dict)
    runs: dict[str, LaneBallRunOutput] = Field(default_factory=dict)
