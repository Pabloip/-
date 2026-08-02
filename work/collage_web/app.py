from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from work.collage_web.service import (
    get_border_size_options,
    get_paper_style_options,
    get_template_options,
    render_uploaded_files,
)


STATIC_DIR = Path(__file__).resolve().parent / "static"
MOCK_HTML_PATH = STATIC_DIR / "editorial-desk-mock.html"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ASSET_VERSION = "20260802-02"
ROOT_STYLESHEET_PATH = f"/static/styles.css?v={ASSET_VERSION}"
ROOT_SCRIPT_PATH = f"/static/app.js?v={ASSET_VERSION}"


def render_root_page() -> str:
    return (
        MOCK_HTML_PATH.read_text(encoding="utf-8")
        .replace("./editorial-desk-mock.css", ROOT_STYLESHEET_PATH)
        .replace("./mock-assets/brand-logo.png", "/static/mock-assets/brand-logo.png")
        .replace("./mock-assets/editorial-hero-tools.png", "/static/mock-assets/editorial-hero-tools.png")
        .replace("./mock-assets/upload-icon.svg", "/static/mock-assets/upload-icon.svg")
        .replace("./editorial-desk-mock.js", ROOT_SCRIPT_PATH)
    )


def build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/templates")
    def get_templates() -> dict[str, object]:
        return {
            "templates": get_template_options(),
            "border_sizes": get_border_size_options(),
            "paper_styles": get_paper_style_options(),
        }

    @app.get("/api/health")
    def get_health() -> dict[str, str]:
        return {
            "service": "collage-web",
            "service_root": str(PROJECT_ROOT),
            "asset_version": ASSET_VERSION,
        }

    @app.post("/api/render")
    async def post_render(
        template: str = Form(...),
        border_size: str | None = Form(None),
        paper_style: str | None = Form(None),
        files: list[UploadFile] = File(...),
    ) -> JSONResponse:
        payload = render_uploaded_files(
            [(upload.filename or "upload.png", await upload.read()) for upload in files],
            template,
            border_size,
            paper_style,
        )
        return JSONResponse(payload)

    @app.get("/")
    def get_index() -> HTMLResponse:
        return HTMLResponse(render_root_page())

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    return app


app = build_app()
