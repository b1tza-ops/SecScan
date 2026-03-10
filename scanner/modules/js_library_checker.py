import httpx
import re
from packaging.version import Version, InvalidVersion

KNOWN_VULNERABLE = {
    "jquery": [
        {"below": "3.5.0", "severity": "high", "cve": "CVE-2020-11022", "description": "XSS vulnerability in jQuery < 3.5.0"},
        {"below": "1.12.0", "severity": "critical", "cve": "CVE-2015-9251", "description": "XSS via cross-domain AJAX requests"},
    ],
    "bootstrap": [
        {"below": "3.4.1", "severity": "medium", "cve": "CVE-2019-8331", "description": "XSS in tooltip/popover data-template"},
        {"below": "4.3.1", "severity": "medium", "cve": "CVE-2019-8331", "description": "XSS in tooltip/popover data-template"},
    ],
    "angular": [
        {"below": "1.8.0", "severity": "high", "cve": "CVE-2020-7676", "description": "XSS in AngularJS < 1.8.0"},
    ],
    "lodash": [
        {"below": "4.17.21", "severity": "high", "cve": "CVE-2021-23337", "description": "Command injection via template"},
    ],
}

VERSION_PATTERNS = {
    "jquery": [
        r'jquery[.-](\d+\.\d+\.?\d*)',
        r"jQuery JavaScript Library v(\d+\.\d+\.?\d*)",
        r'jquery/(\d+\.\d+\.?\d*)',
    ],
    "bootstrap": [
        r'bootstrap[.-](\d+\.\d+\.?\d*)',
        r'Bootstrap v(\d+\.\d+\.?\d*)',
    ],
    "angular": [
        r'angular[.-](\d+\.\d+\.?\d*)',
        r'AngularJS v(\d+\.\d+\.?\d*)',
    ],
    "lodash": [
        r'lodash[.-](\d+\.\d+\.?\d*)',
        r'lodash@(\d+\.\d+\.?\d*)',
    ],
}

async def check_js_libraries(domain: str) -> dict:
    findings = []
    raw_data = {"libraries": {}}

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(f"https://{domain}")
            html = resp.text

            for lib, patterns in VERSION_PATTERNS.items():
                for pattern in patterns:
                    m = re.search(pattern, html, re.IGNORECASE)
                    if m:
                        version_str = m.group(1)
                        raw_data["libraries"][lib] = version_str
                        try:
                            detected_ver = Version(version_str)
                            for vuln in KNOWN_VULNERABLE.get(lib, []):
                                if detected_ver < Version(vuln["below"]):
                                    findings.append({
                                        "title": f"Vulnerable {lib.title()} v{version_str} ({vuln['cve']})",
                                        "description": vuln["description"],
                                        "severity": vuln["severity"],
                                        "fix_recommendation": f"Upgrade {lib} to version {vuln['below']} or later.",
                                        "fix_example": f'<script src="https://cdn.jsdelivr.net/npm/{lib}@latest/dist/{lib}.min.js"></script>'
                                    })
                        except InvalidVersion:
                            pass
                        break

    except httpx.RequestError:
        pass

    return {
        "module": "js_libraries",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len(findings) * 20),
        "findings": findings,
        "raw_data": raw_data
    }
