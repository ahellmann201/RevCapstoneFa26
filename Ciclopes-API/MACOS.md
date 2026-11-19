# Running Ciclopes API on macOS

The CUDA Docker images are for NVIDIA hosts. On a Mac, run the API directly in a Python virtual environment. Apple Silicon uses PyTorch MPS when available; Intel Macs use CPU.

## Setup

Use Python 3.11 and install Apple's command line tools if needed:

```bash
xcode-select --install
cd Ciclopes-API
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements-macos.txt
cp -n .env.example .env
```

Edit `.env` and set `HF_TOKEN` to a Hugging Face token with access to `facebook/sam-3d-body-dinov3`. Fill in `API_USERNAME` and `API_PASSWORD` if you will call the RevMetrix `/run` endpoints. Set the Mac-friendly values:

```dotenv
INFERENCE_DEVICE=auto
LANE_BALL_BATCH_SIZE=4
SAM3D_BODY_BATCH_SIZE=1
MAX_VIDEO_FRAMES=180
MAX_VIDEO_DIMENSION=768
LANE_BALL_MAX_VIDEO_DIMENSION=960
```

Start the API from `Ciclopes-API`:

```bash
python main.py
```

Open <http://localhost:8000/docs>. Stop it with Ctrl+C. This native setup does not start the Cloudflare tunnel.

## Device selection and limitations

`INFERENCE_DEVICE=auto` selects CUDA, then Apple MPS, then CPU. Set it to `mps` or `cpu` to choose explicitly. If a model operation reports that MPS is unsupported, switch to `INFERENCE_DEVICE=cpu`; CPU inference is much slower. SAM 3D Body requires approved Hugging Face access and downloads large model files on first startup. This project has not been validated on every Mac/model combination, so begin with the small batch and frame limits above.

Docker Desktop on macOS does not provide the NVIDIA CUDA devices expected by the supplied Dockerfiles. Use the native steps above rather than `docker compose up` on a Mac.
