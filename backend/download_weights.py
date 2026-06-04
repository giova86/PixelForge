import os
import urllib.request
from pathlib import Path

WEIGHTS_DIR = Path(__file__).parent / "weights"
WEIGHTS_DIR.mkdir(exist_ok=True)

MODELS = {
    "RealESRGAN_x4plus.pth": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
    "RealESRGAN_x2plus.pth": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
}


def download_if_missing():
    for filename, url in MODELS.items():
        dest = WEIGHTS_DIR / filename
        if dest.exists():
            print(f"[weights] {filename} already present, skipping.")
            continue
        print(f"[weights] Downloading {filename} ...")
        urllib.request.urlretrieve(url, dest)
        print(f"[weights] {filename} downloaded ({dest.stat().st_size // 1_000_000} MB).")


if __name__ == "__main__":
    download_if_missing()
