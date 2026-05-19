import io
import numpy as np
import torch
from PIL import Image
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

_MODEL_NAMES = {1: "RealESRGAN_x4plus", 2: "RealESRGAN_x2plus", 4: "RealESRGAN_x4plus"}
_NETSCALE = {1: 4, 2: 2, 4: 4}
_NUM_BLOCK = {1: 23, 2: 23, 4: 23}
_MODEL_PATHS = {
    1: "weights/RealESRGAN_x4plus.pth",
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
    img = Image.open(io.BytesIO(data))

    has_alpha = img.mode in ("RGBA", "P", "LA")
    if has_alpha:
        img = img.convert("RGBA")
        alpha = img.split()[-1]
        # RealESRGAN doesn't understand transparency: it processes RGB values
        # including those of fully-transparent pixels, whose arbitrary colors
        # bleed into semi-transparent edges during convolution. Composite onto
        # white first so the network sees a clean background instead of garbage.
        white = Image.new("RGBA", img.size, (255, 255, 255, 255))
        white.alpha_composite(img)
        img_rgb = white.convert("RGB")
    else:
        alpha = None
        img_rgb = img.convert("RGB")

    img_np = np.array(img_rgb, dtype=np.uint8)
    img_bgr = np.ascontiguousarray(img_np[:, :, ::-1])  # RGB→BGR (RealESRGAN expects BGR)
    upsampler = _get_upsampler(scale)
    output_bgr, _ = upsampler.enhance(img_bgr, outscale=scale)
    result_img = Image.fromarray(np.ascontiguousarray(output_bgr[:, :, ::-1]))  # BGR→RGB

    if alpha is not None:
        alpha_upscaled = alpha.resize(result_img.size, Image.LANCZOS)
        if output_format == "jpeg":
            result_img = result_img  # already on white background
        else:
            result_img = result_img.convert("RGBA")
            result_img.putalpha(alpha_upscaled)
    elif output_format == "jpeg" and img.mode != "RGB":
        result_img = result_img.convert("RGB")

    buf = io.BytesIO()
    fmt_map = {"webp": "WEBP", "jpeg": "JPEG", "png": "PNG"}
    save_kwargs: dict = {"format": fmt_map[output_format]}
    if output_format in ("webp", "jpeg"):
        save_kwargs["quality"] = 95
    result_img.save(buf, **save_kwargs)
    return buf.getvalue()
