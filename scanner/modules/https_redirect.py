import httpx

async def check_https_redirect(domain: str) -> dict:
    findings = []
    raw_data = {}

    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=10) as client:
            resp = await client.get(f"http://{domain}")
            raw_data["http_status"] = resp.status_code
            raw_data["redirect_location"] = resp.headers.get("location", None)

            if resp.status_code in (301, 302, 307, 308):
                location = resp.headers.get("location", "")
                raw_data["redirects_to_https"] = location.startswith("https://")
                if not location.startswith("https://"):
                    findings.append({
                        "title": "HTTP Does Not Redirect to HTTPS",
                        "description": "HTTP requests are redirected but not to HTTPS.",
                        "severity": "high",
                        "fix_recommendation": "Ensure all HTTP traffic is redirected to HTTPS.",
                        "fix_example": "server { listen 80; return 301 https://$host$request_uri; }  # nginx"
                    })
                if resp.status_code in (302, 307):
                    findings.append({
                        "title": "Temporary HTTP Redirect (Should Be Permanent)",
                        "description": f"HTTP uses a {resp.status_code} redirect instead of 301. Browsers won't cache this.",
                        "severity": "low",
                        "fix_recommendation": "Use a 301 permanent redirect from HTTP to HTTPS.",
                        "fix_example": "return 301 https://$host$request_uri;  # nginx"
                    })
            else:
                raw_data["redirects_to_https"] = False
                findings.append({
                    "title": "No HTTPS Redirect on HTTP",
                    "description": "The site does not redirect HTTP traffic to HTTPS. Data may be sent in plaintext.",
                    "severity": "high",
                    "fix_recommendation": "Configure a 301 redirect from HTTP to HTTPS.",
                    "fix_example": "server { listen 80; return 301 https://$host$request_uri; }  # nginx"
                })

    except httpx.RequestError as e:
        raw_data["error"] = str(e)

    return {
        "module": "https_redirect",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len(findings) * 20),
        "findings": findings,
        "raw_data": raw_data
    }
