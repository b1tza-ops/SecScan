import httpx

SECURITY_HEADERS = {
    "strict-transport-security": {
        "title": "Missing HSTS Header",
        "description": "HTTP Strict Transport Security is not set. Browsers may allow insecure HTTP connections.",
        "severity": "high",
        "fix_recommendation": "Add the HSTS header with a long max-age.",
        "fix_example": 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";',
        "owasp_category": "A02:2021 Cryptographic Failures",
    },
    "content-security-policy": {
        "title": "Missing Content Security Policy",
        "description": "No CSP header found. Attackers may inject malicious scripts (XSS).",
        "severity": "high",
        "fix_recommendation": "Define a Content-Security-Policy header.",
        "fix_example": "add_header Content-Security-Policy \"default-src 'self';\";",
        "owasp_category": "A03:2021 Injection",
    },
    "x-content-type-options": {
        "title": "Missing X-Content-Type-Options Header",
        "description": "Browser may MIME-sniff responses, potentially enabling XSS.",
        "severity": "medium",
        "fix_recommendation": "Set X-Content-Type-Options to nosniff.",
        "fix_example": "add_header X-Content-Type-Options nosniff;",
        "owasp_category": "A05:2021 Security Misconfiguration",
    },
    "x-frame-options": {
        "title": "Missing X-Frame-Options Header",
        "description": "Site may be vulnerable to clickjacking attacks.",
        "severity": "medium",
        "fix_recommendation": "Set X-Frame-Options to DENY or SAMEORIGIN.",
        "fix_example": "add_header X-Frame-Options SAMEORIGIN;",
        "owasp_category": "A04:2021 Insecure Design",
    },
    "referrer-policy": {
        "title": "Missing Referrer-Policy Header",
        "description": "Sensitive URL data may be leaked to third parties.",
        "severity": "low",
        "fix_recommendation": "Set a Referrer-Policy header.",
        "fix_example": "add_header Referrer-Policy \"strict-origin-when-cross-origin\";",
        "owasp_category": "A05:2021 Security Misconfiguration",
    },
    "permissions-policy": {
        "title": "Missing Permissions-Policy Header",
        "description": "Browser features are not restricted, increasing attack surface.",
        "severity": "low",
        "fix_recommendation": "Add a Permissions-Policy header.",
        "fix_example": "add_header Permissions-Policy \"geolocation=(), microphone=(), camera=()\";",
        "owasp_category": "A05:2021 Security Misconfiguration",
    },
    "cross-origin-opener-policy": {
        "title": "Missing Cross-Origin-Opener-Policy Header",
        "description": "Without COOP, cross-origin pages may access your window object, enabling Spectre-like attacks.",
        "severity": "low",
        "fix_recommendation": "Set Cross-Origin-Opener-Policy to same-origin.",
        "fix_example": "add_header Cross-Origin-Opener-Policy same-origin;",
        "owasp_category": "A05:2021 Security Misconfiguration",
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
                        "owasp_category": meta["owasp_category"],
                    })
                else:
                    # Quality checks for present headers
                    value = headers[header_name]
                    if header_name == "content-security-policy":
                        raw_data["csp_value"] = value
                        if "'unsafe-inline'" in value:
                            findings.append({
                                "title": "CSP Allows unsafe-inline",
                                "description": "Content-Security-Policy contains 'unsafe-inline', which allows inline scripts and styles. This undermines XSS protection.",
                                "severity": "medium",
                                "fix_recommendation": "Remove 'unsafe-inline' from CSP. Use nonces or hashes instead.",
                                "fix_example": "add_header Content-Security-Policy \"script-src 'self' 'nonce-{random}'\";",
                                "owasp_category": "A03:2021 Injection",
                            })
                        if "'unsafe-eval'" in value:
                            findings.append({
                                "title": "CSP Allows unsafe-eval",
                                "description": "Content-Security-Policy contains 'unsafe-eval', which allows dynamic code execution (eval, Function()). High XSS risk.",
                                "severity": "medium",
                                "fix_recommendation": "Remove 'unsafe-eval' from CSP. Refactor code to avoid eval().",
                                "fix_example": "add_header Content-Security-Policy \"script-src 'self'\";",
                                "owasp_category": "A03:2021 Injection",
                            })
                        if " * " in value or value.strip().endswith("*") or "src *" in value or "src: *" in value:
                            findings.append({
                                "title": "CSP Contains Wildcard Source",
                                "description": "Content-Security-Policy uses a wildcard (*) source, allowing resources from any origin.",
                                "severity": "medium",
                                "fix_recommendation": "Replace wildcard sources with specific trusted origins.",
                                "fix_example": "add_header Content-Security-Policy \"default-src 'self' cdn.yourdomain.com\";",
                                "owasp_category": "A03:2021 Injection",
                            })
                        if "default-src" not in value and "script-src" not in value:
                            findings.append({
                                "title": "CSP Missing default-src Directive",
                                "description": "CSP has neither default-src nor script-src. Script sources are unrestricted.",
                                "severity": "low",
                                "fix_recommendation": "Add a default-src directive as a catch-all fallback.",
                                "fix_example": "add_header Content-Security-Policy \"default-src 'self'\";",
                                "owasp_category": "A03:2021 Injection",
                            })

                    elif header_name == "strict-transport-security":
                        raw_data["hsts_value"] = value
                        try:
                            max_age = int(next(
                                (p.split("=")[1] for p in value.split(";") if "max-age" in p.lower()),
                                "0"
                            ))
                            if max_age < 31536000:
                                findings.append({
                                    "title": f"HSTS max-age Too Short ({max_age}s)",
                                    "description": f"HSTS max-age is {max_age} seconds (< 1 year). Browsers may not cache the HSTS policy long enough.",
                                    "severity": "low",
                                    "fix_recommendation": "Set HSTS max-age to at least 31536000 (1 year).",
                                    "fix_example": 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";',
                                    "owasp_category": "A02:2021 Cryptographic Failures",
                                })
                        except (ValueError, StopIteration):
                            pass
                        if "includesubdomains" not in value.lower():
                            findings.append({
                                "title": "HSTS Missing includeSubDomains",
                                "description": "HSTS does not include 'includeSubDomains'. Subdomains are not protected from downgrade attacks.",
                                "severity": "low",
                                "fix_recommendation": "Add includeSubDomains to your HSTS header.",
                                "fix_example": 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";',
                                "owasp_category": "A02:2021 Cryptographic Failures",
                            })

            # Check for server header leaking info
            if "server" in headers:
                raw_data["server_header"] = headers["server"]
                findings.append({
                    "title": "Server Header Information Disclosure",
                    "description": f"Server header reveals: {headers['server']}. Attackers can fingerprint your stack.",
                    "severity": "low",
                    "fix_recommendation": "Remove or obscure the Server header.",
                    "fix_example": "server_tokens off;  # nginx",
                    "owasp_category": "A05:2021 Security Misconfiguration",
                })

            # Check X-Powered-By
            if "x-powered-by" in headers:
                findings.append({
                    "title": "X-Powered-By Header Exposed",
                    "description": f"X-Powered-By: {headers['x-powered-by']} reveals technology stack.",
                    "severity": "low",
                    "fix_recommendation": "Remove the X-Powered-By header.",
                    "fix_example": "app.disable('x-powered-by');  # Express.js",
                    "owasp_category": "A05:2021 Security Misconfiguration",
                })

    except httpx.RequestError as e:
        findings.append({
            "title": "Could not fetch headers",
            "description": str(e),
            "severity": "info",
            "fix_recommendation": "Ensure the site is accessible over HTTPS.",
            "fix_example": None,
            "owasp_category": "A05:2021 Security Misconfiguration",
        })

    return {
        "module": "headers",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len(findings) * 10),
        "findings": findings,
        "raw_data": raw_data
    }
