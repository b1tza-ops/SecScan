import httpx
import re
from packaging.version import Version, InvalidVersion

OWASP_CATEGORY = "A06:2021 Vulnerable and Outdated Components"

KNOWN_VULNERABLE = {
    "jquery": [
        {"below": "3.5.0", "severity": "high", "cve": "CVE-2020-11022", "description": "XSS vulnerability in jQuery < 3.5.0 via HTML manipulation methods."},
        {"below": "1.12.0", "severity": "critical", "cve": "CVE-2015-9251", "description": "XSS via cross-domain AJAX requests in jQuery < 1.12.0."},
    ],
    "bootstrap": [
        {"below": "3.4.1", "severity": "medium", "cve": "CVE-2019-8331", "description": "XSS in Bootstrap tooltip/popover data-template attribute."},
        {"below": "4.3.1", "severity": "medium", "cve": "CVE-2019-8331", "description": "XSS in Bootstrap tooltip/popover data-template attribute."},
    ],
    "angular": [
        {"below": "1.8.0", "severity": "high", "cve": "CVE-2020-7676", "description": "XSS in AngularJS < 1.8.0 via jqLite HTML parsing."},
    ],
    "lodash": [
        {"below": "4.17.21", "severity": "high", "cve": "CVE-2021-23337", "description": "Command injection via template in lodash < 4.17.21."},
        {"below": "4.17.19", "severity": "high", "cve": "CVE-2020-8203", "description": "Prototype pollution via _.zipObjectDeep in lodash."},
    ],
    "moment": [
        {"below": "2.29.4", "severity": "high", "cve": "CVE-2022-24785", "description": "Path traversal in moment.js locale loading."},
        {"below": "2.29.2", "severity": "high", "cve": "CVE-2022-31129", "description": "Inefficient regular expression in moment.js (ReDoS)."},
    ],
    "handlebars": [
        {"below": "4.7.7", "severity": "high", "cve": "CVE-2021-23369", "description": "Remote code execution via prototype pollution in Handlebars."},
        {"below": "4.5.3", "severity": "critical", "cve": "CVE-2019-19919", "description": "Prototype pollution allowing RCE in Handlebars < 4.5.3."},
    ],
    "vue": [
        {"below": "2.7.0", "severity": "medium", "cve": "CVE-2021-22918", "description": "XSS via v-html directive in Vue.js."},
    ],
    "axios": [
        {"below": "1.6.0", "severity": "medium", "cve": "CVE-2023-45857", "description": "Credential exposure via XSRF-TOKEN header in axios < 1.6.0."},
        {"below": "0.21.1", "severity": "high", "cve": "CVE-2020-28168", "description": "SSRF via URL validation bypass in axios."},
    ],
    "highlight.js": [
        {"below": "9.18.2", "severity": "high", "cve": "CVE-2020-26237", "description": "Prototype pollution in highlight.js < 9.18.2."},
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
    "moment": [
        r'moment[.-](\d+\.\d+\.?\d*)',
        r'Moment\.js v(\d+\.\d+\.?\d*)',
        r'moment/(\d+\.\d+\.?\d*)',
    ],
    "handlebars": [
        r'handlebars[.-](\d+\.\d+\.?\d*)',
        r'Handlebars v(\d+\.\d+\.?\d*)',
        r'handlebars/(\d+\.\d+\.?\d*)',
    ],
    "vue": [
        r'vue[.-](\d+\.\d+\.?\d*)',
        r'Vue\.js v(\d+\.\d+\.?\d*)',
        r'"vue":"(\d+\.\d+\.?\d*)',
    ],
    "axios": [
        r'axios[/@](\d+\.\d+\.?\d*)',
        r'axios/(\d+\.\d+\.?\d*)',
    ],
    "highlight.js": [
        r'highlight\.js v(\d+\.\d+\.?\d*)',
        r'highlight[.-](\d+\.\d+\.?\d*)',
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
                                        "fix_example": f'<script src="https://cdn.jsdelivr.net/npm/{lib}@latest/dist/{lib}.min.js"></script>',
                                        "owasp_category": OWASP_CATEGORY,
                                        "cve": vuln["cve"],
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
