import httpx
import re

SENSITIVE_PATTERNS = [
    r"/admin",
    r"/wp-admin",
    r"/phpmyadmin",
    r"/config",
    r"/backup",
    r"/\.env",
    r"/api/",
    r"/secret",
    r"/private",
    r"/internal",
]

async def scan_robots(domain: str) -> dict:
    findings = []
    raw_data = {}

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(f"https://{domain}/robots.txt")
            if resp.status_code == 200:
                content = resp.text
                raw_data["robots_txt"] = content[:2000]

                disallowed = re.findall(r"Disallow:\s*(.+)", content, re.IGNORECASE)
                raw_data["disallowed_paths"] = disallowed

                sensitive_exposed = []
                for path in disallowed:
                    for pattern in SENSITIVE_PATTERNS:
                        if re.search(pattern, path, re.IGNORECASE):
                            sensitive_exposed.append(path.strip())
                            break

                if sensitive_exposed:
                    findings.append({
                        "title": "Sensitive Paths Revealed in robots.txt",
                        "description": f"robots.txt discloses sensitive paths: {', '.join(sensitive_exposed[:5])}. Attackers can use this to find targets.",
                        "severity": "medium",
                        "fix_recommendation": "Remove sensitive paths from robots.txt. Robots.txt is public — obscurity is not security.",
                        "fix_example": "# Only disallow paths that are truly public-facing\nDisallow: /search?"
                    })
            else:
                raw_data["robots_txt"] = None
                findings.append({
                    "title": "No robots.txt Found",
                    "description": "robots.txt is missing. While optional, it can help guide search engine crawlers.",
                    "severity": "info",
                    "fix_recommendation": "Create a robots.txt file.",
                    "fix_example": "User-agent: *\nDisallow: /private/\nSitemap: https://yourdomain.com/sitemap.xml"
                })
    except httpx.RequestError as e:
        raw_data["error"] = str(e)

    return {
        "module": "robots",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len([f for f in findings if f["severity"] != "info"]) * 15),
        "findings": findings,
        "raw_data": raw_data
    }
