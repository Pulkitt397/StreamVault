import logging
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

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

# Add CORS middleware to allow requests from Netlify frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (or specify ["https://streamsvault.netlify.app"])
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



@app.get("/stream")
async def proxy_stream(url: str, request: Request, download: bool = False):
    """
    Proxies the video stream via a shared client pool for better performance.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL parameter")

    headers = {}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header
    
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

    # Use the global client
    req = http_client.build_request("GET", url, headers=headers)
    
    try:
        r = await http_client.send(req, stream=True)
    except Exception as e:
        logger.error(f"Failed to connect to upstream: {e}")
        # If the global client fails completely, we might try to recover or just error
        raise HTTPException(status_code=502, detail="Error connecting to video source")

    # Headers to forward
    response_headers = {}
    for key in ["content-type", "content-length", "content-range", "accept-ranges"]:
        if key in r.headers:
            response_headers[key] = r.headers[key]
    
    if download:
        # Try to guess filename from URL or default to video.mp4
        import os
        from urllib.parse import urlparse
        path = urlparse(url).path
        filename = os.path.basename(path)
        if not filename:
            filename = "video.mp4"
        response_headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    async def content_generator():
        try:
            # 256KB chunks to reduce overhead and improve buffering
            async for chunk in r.aiter_bytes(chunk_size=262144):
                yield chunk
        except Exception as e:
            logger.error(f"Connection error during stream: {e}")
        finally:
            await r.aclose()
            # Do NOT close the global client here!

    return StreamingResponse(
        content_generator(),
        status_code=r.status_code,
        headers=response_headers,
        media_type=r.headers.get("content-type", "video/mp4")
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
