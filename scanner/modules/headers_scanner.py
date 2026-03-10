import httpx

SECURITY_HEADERS = {
    "strict-transport-security": {
        "title": "Missing HSTS Header",
        "description": "HTTP Strict Transport Security is not set. Browsers may allow insecure HTTP connections.",
        "severity": "high",
        "fix_recommendation": "Add the HSTS header with a long max-age.",
        "fix_example": 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";'
    },
    "content-security-policy": {
        "title": "Missing Content Security Policy",
        "description": "No CSP header found. Attackers may inject malicious scripts (XSS).",
        "severity": "high",
        "fix_recommendation": "Define a Content-Security-Policy header.",
        "fix_example": "add_header Content-Security-Policy \"default-src 'self';\";",
    },
    "x-content-type-options": {
        "title": "Missing X-Content-Type-Options Header",
        "description": "Browser may MIME-sniff responses, potentially enabling XSS.",
        "severity": "medium",
        "fix_recommendation": "Set X-Content-Type-Options to nosniff.",
        "fix_example": "add_header X-Content-Type-Options nosniff;"
    },
    "x-frame-options": {
        "title": "Missing X-Frame-Options Header",
        "description": "Site may be vulnerable to clickjacking attacks.",
        "severity": "medium",
        "fix_recommendation": "Set X-Frame-Options to DENY or SAMEORIGIN.",
        "fix_example": "add_header X-Frame-Options SAMEORIGIN;"
    },
    "referrer-policy": {
        "title": "Missing Referrer-Policy Header",
        "description": "Sensitive URL data may be leaked to third parties.",
        "severity": "low",
        "fix_recommendation": "Set a Referrer-Policy header.",
        "fix_example": "add_header Referrer-Policy \"strict-origin-when-cross-origin\";"
    },
    "permissions-policy": {
        "title": "Missing Permissions-Policy Header",
        "description": "Browser features are not restricted, increasing attack surface.",
        "severity": "low",
        "fix_recommendation": "Add a Permissions-Policy header.",
        "fix_example": "add_header Permissions-Policy \"geolocation=(), microphone=()\";"
    },
}

async def scan_headers(domain: str) -> dict:
    findings = []
    raw_data = {}

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(f"https://{domain}")
            headers = {k.lower(): v for k, v in resp.headers.items()}
            raw_data["status_code"] = resp.status_code
            raw_data["headers_found"] = list(headers.keys())

            for header_name, meta in SECURITY_HEADERS.items():
                if header_name not in headers:
                    findings.append({
                        "title": meta["title"],
                        "description": meta["description"],
                        "severity": meta["severity"],
                        "fix_recommendation": meta["fix_recommendation"],
                        "fix_example": meta["fix_example"],
                    })

            # Check for server header leaking info
            if "server" in headers:
                raw_data["server_header"] = headers["server"]
                findings.append({
                    "title": "Server Header Information Disclosure",
                    "description": f"Server header reveals: {headers['server']}. Attackers can fingerprint your stack.",
                    "severity": "low",
                    "fix_recommendation": "Remove or obscure the Server header.",
                    "fix_example": "server_tokens off;  # nginx"
                })

            # Check X-Powered-By
            if "x-powered-by" in headers:
                findings.append({
                    "title": "X-Powered-By Header Exposed",
                    "description": f"X-Powered-By: {headers['x-powered-by']} reveals technology stack.",
                    "severity": "low",
                    "fix_recommendation": "Remove the X-Powered-By header.",
                    "fix_example": "app.disable('x-powered-by');  # Express.js"
                })

    except httpx.RequestError as e:
        findings.append({
            "title": "Could not fetch headers",
            "description": str(e),
            "severity": "info",
            "fix_recommendation": "Ensure the site is accessible over HTTPS.",
            "fix_example": None
        })

    return {
        "module": "headers",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len(findings) * 10),
        "findings": findings,
        "raw_data": raw_data
    }
