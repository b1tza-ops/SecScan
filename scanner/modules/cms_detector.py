import httpx
import re

CMS_SIGNATURES = {
    "WordPress": [
        r"/wp-content/",
        r"/wp-includes/",
        r'name="generator" content="WordPress',
    ],
    "Drupal": [
        r"/sites/default/files/",
        r'Drupal.settings',
        r'name="Generator" content="Drupal',
    ],
    "Joomla": [
        r'/media/jui/',
        r'name="generator" content="Joomla',
    ],
    "Shopify": [
        r'cdn.shopify.com',
        r'Shopify.theme',
    ],
    "Wix": [
        r'static.wixstatic.com',
        r'X-Wix-Published-Version',
    ],
    "Squarespace": [
        r'static1.squarespace.com',
        r'squarespace-cdn',
    ],
}

async def detect_cms(domain: str) -> dict:
    findings = []
    raw_data = {}
    detected = []

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(f"https://{domain}")
            body = resp.text

            for cms, patterns in CMS_SIGNATURES.items():
                for pattern in patterns:
                    if re.search(pattern, body, re.IGNORECASE):
                        detected.append(cms)
                        break

            raw_data["detected_cms"] = list(set(detected))

            for cms in set(detected):
                findings.append({
                    "title": f"{cms} CMS Detected",
                    "description": f"The site is running {cms}. Ensure it is kept up to date.",
                    "severity": "info",
                    "fix_recommendation": f"Keep {cms} core, plugins, and themes updated to the latest version.",
                    "fix_example": f"Check {cms} dashboard for available updates regularly."
                })

            # WordPress-specific: check for readme.html exposing version
            if "WordPress" in detected:
                try:
                    readme = await client.get(f"https://{domain}/readme.html", timeout=5)
                    if readme.status_code == 200:
                        findings.append({
                            "title": "WordPress readme.html Exposed",
                            "description": "readme.html reveals the WordPress version to attackers.",
                            "severity": "medium",
                            "fix_recommendation": "Delete or restrict access to readme.html.",
                            "fix_example": "location = /readme.html { deny all; }  # nginx"
                        })
                except Exception:
                    pass

    except httpx.RequestError:
        pass

    return {
        "module": "cms",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len([f for f in findings if f["severity"] not in ("info",)]) * 10),
        "findings": findings,
        "raw_data": raw_data
    }
