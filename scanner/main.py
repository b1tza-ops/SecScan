from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio
from scanner import run_scan

app = FastAPI(title="SecurityScan Scanner Engine")

class ScanRequest(BaseModel):
    scan_id: str
    domain: str

@app.post("/scan")
async def scan(req: ScanRequest):
    try:
        result = await run_scan(req.domain, req.scan_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}
