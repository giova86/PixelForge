import io
import numpy as np
import torch
from PIL import Image
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

_MODEL_NAMES = {2: "RealESRGAN_x2plus", 4: "RealESRGAN_x4plus"}
_NETSCALE = {2: 2, 4: 4}
_NUM_BLOCK = {2: 23, 4: 23}
_MODEL_PATHS = {
    2: "weights/RealESRGAN_x2plus.pth",
    4: "weights/RealESRGAN_x4plus.pth",
}

_upsampler_cache: dict = {}

def _get_upsampler(scale: int) -> RealESRGANer:
    if scale not in _upsampler_cache:
        model = RRDBNet(
            num_in_ch=3, num_out_ch=3,
            num_feat=64, num_block=_NUM_BLOCK[scale],
            num_grow_ch=32, scale=_NETSCALE[scale],
        )
        gpu_id = 0 if torch.cuda.is_available() else None
        _upsampler_cache[scale] = RealESRGANer(
            scale=_NETSCALE[scale],
            model_path=_MODEL_PATHS[scale],
            model=model,
            tile=400,
            tile_pad=10,
            pre_pad=0,
            half=torch.cuda.is_available(),
            gpu_id=gpu_id,
        )
    return _upsampler_cache[scale]

def get_model_name(scale: int) -> str:
    return _MODEL_NAMES[scale]

def enhance_image(data: bytes, scale: int, output_format: str) -> bytes:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_np = np.array(img, dtype=np.uint8)
    upsampler = _get_upsampler(scale)
    output_np, _ = upsampler.enhance(img_np, outscale=scale)
    result_img = Image.fromarray(output_np)
    buf = io.BytesIO()
    fmt_map = {"webp": "WEBP", "jpeg": "JPEG", "png": "PNG"}
    result_img.save(buf, format=fmt_map[output_format], quality=95)
    return buf.getvalue()
