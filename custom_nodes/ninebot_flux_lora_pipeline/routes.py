from __future__ import annotations

import uuid
from pathlib import Path


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
_ROUTES_REGISTERED = False


def _clean_filename(name: str) -> str:
    cleaned = [c if c.isalnum() or c in "._-" else "_" for c in str(name).strip()]
    return "".join(cleaned).strip("._") or "upload.png"


def resolve_download_path(path_value: str) -> Path:
    path = Path(path_value).expanduser().resolve()
    if path.suffix.lower() != ".safetensors":
        raise ValueError("只能下载 .safetensors LoRA 文件")
    if not path.is_file():
        raise FileNotFoundError("LoRA 文件不存在，请先完成训练或检查输出路径")
    return path


def resolve_preview_path(path_value: str) -> Path:
    path = Path(path_value).expanduser().resolve()
    if path.suffix.lower() not in IMAGE_EXTENSIONS:
        raise ValueError("只能预览图片文件")
    if not path.is_file():
        raise FileNotFoundError("图片文件不存在")
    return path


def register_routes():
    global _ROUTES_REGISTERED
    if _ROUTES_REGISTERED:
        return

    try:
        from aiohttp import web
        import folder_paths
        from server import PromptServer
    except Exception:
        return

    prompt_server = getattr(PromptServer, "instance", None)
    if prompt_server is None:
        return

    routes = prompt_server.routes

    @routes.post("/ninebot_flux_lora_pipeline/upload")
    async def upload_images(request):
        reader = await request.multipart()
        upload_root = Path(folder_paths.get_temp_directory()) / "ninebot_flux_lora_pipeline" / "uploads" / uuid.uuid4().hex[:12]
        upload_root.mkdir(parents=True, exist_ok=True)

        image_paths = []
        index = 1
        while True:
            field = await reader.next()
            if field is None:
                break
            if not field.filename:
                continue
            name = _clean_filename(field.filename)
            suffix = Path(name).suffix.lower()
            if suffix not in IMAGE_EXTENSIONS:
                continue
            target = upload_root / f"{index:03d}_{name}"
            target.write_bytes(await field.read(decode=False))
            image_paths.append(str(target))
            index += 1

        if not image_paths:
            return web.json_response({"error": "请上传 png/jpg/jpeg/webp 图片"}, status=400)
        return web.json_response({"image_paths": image_paths, "count": len(image_paths)})

    @routes.get("/ninebot_flux_lora_pipeline/preview")
    async def preview_image(request):
        try:
            path = resolve_preview_path(request.query.get("path", ""))
        except FileNotFoundError as exc:
            return web.json_response({"error": str(exc)}, status=404)
        except ValueError as exc:
            return web.json_response({"error": str(exc)}, status=400)
        return web.FileResponse(path)

    @routes.get("/ninebot_flux_lora_pipeline/download")
    async def download_lora(request):
        try:
            path = resolve_download_path(request.query.get("path", ""))
        except FileNotFoundError as exc:
            return web.json_response({"error": str(exc)}, status=404)
        except ValueError as exc:
            return web.json_response({"error": str(exc)}, status=400)
        return web.FileResponse(path, headers={"Content-Disposition": f'attachment; filename="{path.name}"'})

    _ROUTES_REGISTERED = True
