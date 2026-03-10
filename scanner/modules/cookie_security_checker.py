import httpx

async def check_cookies(domain: str) -> dict:
    findings = []
    raw_data = {"cookies": []}

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(f"https://{domain}")
            cookies = resp.cookies

            for name, value in cookies.items():
                cookie_info = {"name": name}
                raw_data["cookies"].append(cookie_info)

            # Check Set-Cookie headers directly for flags
            set_cookie_headers = resp.headers.get_list("set-cookie") if hasattr(resp.headers, 'get_list') else []
            if not set_cookie_headers:
                sc = resp.headers.get("set-cookie", "")
                set_cookie_headers = [sc] if sc else []

            for header in set_cookie_headers:
                header_lower = header.lower()
                name = header.split("=")[0].strip()

                if "httponly" not in header_lower:
                    findings.append({
                        "title": f"Cookie '{name}' Missing HttpOnly Flag",
                        "description": "Cookie is accessible via JavaScript. XSS attacks can steal session tokens.",
                        "severity": "high",
                        "fix_recommendation": "Set HttpOnly flag on all session cookies.",
                        "fix_example": "Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Strict"
                    })
                if "secure" not in header_lower:
                    findings.append({
                        "title": f"Cookie '{name}' Missing Secure Flag",
                        "description": "Cookie may be transmitted over HTTP, exposing it to interception.",
                        "severity": "medium",
                        "fix_recommendation": "Set the Secure flag on all cookies.",
                        "fix_example": "Set-Cookie: session=abc; Secure; HttpOnly"
                    })
                if "samesite" not in header_lower:
                    findings.append({
                        "title": f"Cookie '{name}' Missing SameSite Attribute",
                        "description": "Cookie is vulnerable to CSRF attacks.",
                        "severity": "medium",
                        "fix_recommendation": "Set SameSite=Strict or SameSite=Lax.",
                        "fix_example": "Set-Cookie: session=abc; SameSite=Strict; Secure; HttpOnly"
                    })

    except httpx.RequestError as e:
        raw_data["error"] = str(e)

    return {
        "module": "cookies",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len(findings) * 10),
        "findings": findings,
        "raw_data": raw_data
    }
