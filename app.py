# static_server.py
import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_fastapi_instrumentator.metrics import Info
from prometheus_client import Counter, Histogram

from chat.routes import router as chat_router

app = FastAPI()

# Create custom metrics
file_requests = Counter('static_file_requests_total', 'Total static file requests', ['file_path', 'status'])
file_duration = Histogram('static_file_duration_seconds', 'Static file request duration', ['file_path'])

def track_file_metrics(info: Info):
    """Custom metric function that gets called for each request"""
    path = info.request.url.path
    status = info.response.status_code
    duration = info.modified_duration

    file_requests.labels(file_path=path, status=status).inc()
    file_duration.labels(file_path=path).observe(duration)

# Set up Prometheus metrics instrumentator with custom metrics
instrumentator = Instrumentator()
instrumentator.add(track_file_metrics)
instrumentator.instrument(app).expose(app)

# Include chat router
app.include_router(chat_router)

# Handle all requests including root
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    print(f"Catch-all triggered for: '{full_path}'")
    
    # Handle root directory case
    if full_path == "":
        if os.path.exists('index.html'):
            return FileResponse('index.html')
        raise HTTPException(status_code=404, detail="Not found")
    
    # Check if it's a directory
    if os.path.isdir(full_path):
        # Look for index.html in that directory
        index_path = os.path.join(full_path, 'index.html')
        if os.path.exists(index_path):
            return FileResponse(index_path)
        # If no index.html in directory, return 404
        raise HTTPException(status_code=404, detail="Not found")
    
    # Check if it's a file
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return FileResponse(full_path)
    
    # If path doesn't exist, return 404
    raise HTTPException(status_code=404, detail="Not found")

