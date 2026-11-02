from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel

from core.VideoUtil.SpacesApiClient import authorize, upload_video

logger = logging.getLogger("ciclopes.video_upload")
router = APIRouter(prefix="/videos", tags=["Videos"])

# Keep uploads bounded while streaming them to disk, rather than buffering the
# entire clip in memory. This is ample for a short bowling shot.
MAX_UPLOAD_BYTES = 500 * 1024 * 1024
ALLOWED_VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".webm", ".3gp", ".avi"}


class VideoUploadOutput(BaseModel):
    video_key: str
    filename: str


@router.post("/upload", response_model=VideoUploadOutput)
def upload_video_for_analysis(
    request: Request,
    file: UploadFile = File(...),
    folder: str = Query("videos", max_length=128),
) -> VideoUploadOutput:
    """Store a phone video using Ciclopes' server-side RevMetrix credentials."""
    settings = getattr(request.app.state, "settings", None)
    if settings is None:
        raise HTTPException(status_code=503, detail="Application settings are not initialized")
    if not settings.username or not settings.password:
        raise HTTPException(status_code=500, detail="Ciclopes video storage credentials are not configured")

    filename = Path(file.filename or "bowling-video.mp4").name
    if Path(filename).suffix.lower() not in ALLOWED_VIDEO_SUFFIXES:
        raise HTTPException(status_code=415, detail="Use an MP4, MOV, M4V, WebM, 3GP, or AVI video")
    if not folder or len(folder) > 128 or ".." in folder:
        raise HTTPException(status_code=422, detail="Invalid storage folder")

    try:
        with tempfile.TemporaryDirectory(prefix="ciclopes-upload-") as temp_dir:
            temp_path = Path(temp_dir) / filename
            total_bytes = 0
            with temp_path.open("wb") as output:
                while chunk := file.file.read(1024 * 1024):
                    total_bytes += len(chunk)
                    if total_bytes > MAX_UPLOAD_BYTES:
                        raise HTTPException(status_code=413, detail="Video exceeds the 500 MB upload limit")
                    output.write(chunk)

            if total_bytes == 0:
                raise HTTPException(status_code=400, detail="The uploaded video is empty")

            token = authorize(
                base=settings.api_base,
                verify=settings.verify_api,
                username=settings.username,
                password=settings.password,
            )
            key = upload_video(
                base=settings.api_base,
                verify=settings.verify_api,
                token=token,
                file_path=temp_path,
                folder=folder,
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not upload video %s to RevMetrix storage", filename)
        raise HTTPException(status_code=502, detail=f"Video storage upload failed: {exc}") from exc
    finally:
        file.file.close()

    return VideoUploadOutput(video_key=key, filename=filename)
