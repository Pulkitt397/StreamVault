import logging
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stream_proxy")

# Global client for connection pooling
http_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    # Limits: keep many connections open, longer timeouts for video streams
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=100)
    timeout = httpx.Timeout(30.0, connect=10.0)
    http_client = httpx.AsyncClient(limits=limits, timeout=timeout)
    yield
    await http_client.aclose()

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def landing_page(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})

@app.get("/app", response_class=HTMLResponse)
async def app_page(request: Request):
    return templates.TemplateResponse("app.html", {"request": request})

def resolve_stream_url(url: str, quality: str = "best", audio_only: bool = False):
    """
    Uses yt-dlp to extract the direct video URL and title.
    Returns (direct_url, filename, filesize).
    """
    # Build format string based on options
    if audio_only:
        format_str = 'bestaudio/best'
        ext = 'mp3'
    elif quality == "720p":
        format_str = 'bestvideo[height<=720]+bestaudio/best[height<=720]/best'
        ext = 'mp4'
    elif quality == "1080p":
        format_str = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
        ext = 'mp4'
    else:  # best
        format_str = 'bestvideo+bestaudio/best'
        ext = 'mp4'
    
    ydl_opts = {
        'format': format_str,
        'quiet': True,
        'noplaylist': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            direct_url = info.get('url')
            title = info.get('title', 'video')
            detected_ext = info.get('ext', ext)
            filesize = info.get('filesize') or info.get('filesize_approx') or 0
            filename = f"{title}.{detected_ext}"
            return direct_url, filename, filesize
    except Exception as e:
        logger.warning(f"yt-dlp failed for {url}: {e}")
        # Fallback: assume it's already a direct link
        return url, "video.mp4", 0

@app.get("/info")
async def get_video_info(url: str, quality: str = "best", audio_only: bool = False):
    """
    Get video metadata including file size for progress tracking.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL parameter")
    
    try:
        direct_url, filename, filesize = resolve_stream_url(url, quality, audio_only)
        return {
            "success": True,
            "title": filename,
            "filesize": filesize,
            "url": direct_url
        }
    except Exception as e:
        logger.error(f"Failed to get info for {url}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stream")
async def proxy_stream(url: str, request: Request, download: bool = False):
    """
    Proxies the video stream. Supports YouTube, Reddit, etc. via yt-dlp.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL parameter")

    # Resolve URL (handle YouTube/Reddit etc.)
    target_url, filename, _ = resolve_stream_url(url)
    
    headers = {}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header
    
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

    # Use the global client
    req = http_client.build_request("GET", target_url, headers=headers)
    
    try:
        r = await http_client.send(req, stream=True)
    except Exception as e:
        logger.error(f"Failed to connect to upstream: {e}")
        raise HTTPException(status_code=502, detail="Error connecting to video source")

    # Headers to forward
    response_headers = {}
    for key in ["content-type", "content-length", "content-range", "accept-ranges"]:
        if key in r.headers:
            response_headers[key] = r.headers[key]
    
    if download:
        # Sanitation for filename
        import re
        safe_filename = re.sub(r'[^\w\-_\. ]', '', filename)
        response_headers["Content-Disposition"] = f'attachment; filename="{safe_filename}"'

    async def content_generator():
        try:
            # 256KB chunks
            async for chunk in r.aiter_bytes(chunk_size=262144):
                yield chunk
        except Exception as e:
            logger.error(f"Connection error during stream: {e}")
        finally:
            await r.aclose()

    return StreamingResponse(
        content_generator(),
        status_code=r.status_code,
        headers=response_headers,
        media_type=r.headers.get("content-type", "video/mp4")
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

