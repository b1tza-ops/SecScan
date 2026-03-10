import asyncio
from modules.ssl_scanner import scan_ssl
from modules.headers_scanner import scan_headers
from modules.dns_scanner import scan_dns
from modules.cms_detector import detect_cms
from modules.js_library_checker import check_js_libraries
from modules.port_scanner_safe import scan_ports_safe
from modules.cookie_security_checker import check_cookies
from modules.robots_scanner import scan_robots
from modules.https_redirect import check_https_redirect

SEVERITY_WEIGHTS = {"critical": 15, "high": 10, "medium": 5, "low": 2, "info": 0}

async def run_scan(domain: str, scan_id: str) -> dict:
    modules = [
        ("ssl", scan_ssl),
        ("headers", scan_headers),
        ("dns", scan_dns),
        ("cms", detect_cms),
        ("js_libraries", check_js_libraries),
        ("ports", scan_ports_safe),
        ("cookies", check_cookies),
        ("robots", scan_robots),
        ("https_redirect", check_https_redirect),
    ]

    results = await asyncio.gather(*[run_module(name, fn, domain) for name, fn in modules], return_exceptions=True)

    module_results = []
    total_deduction = 0
    critical_count = 0
    warning_count = 0
    info_count = 0

    for i, result in enumerate(results):
        module_name = modules[i][0]
        if isinstance(result, Exception):
            module_results.append({
                "module": module_name,
                "status": "error",
                "score": 0,
                "findings": [{"title": "Module error", "description": str(result), "severity": "info"}],
                "raw_data": {}
            })
            continue

        module_results.append(result)
        for finding in result.get("findings", []):
            sev = finding.get("severity", "info")
            total_deduction += SEVERITY_WEIGHTS.get(sev, 0)
            if sev in ("critical", "high"):
                critical_count += 1
            elif sev == "medium":
                warning_count += 1
            else:
                info_count += 1

    security_score = max(0, 100 - total_deduction)

    return {
        "scan_id": scan_id,
        "domain": domain,
        "security_score": security_score,
        "critical_count": critical_count,
        "warning_count": warning_count,
        "info_count": info_count,
        "modules": module_results,
    }

async def run_module(name: str, fn, domain: str) -> dict:
    try:
        if asyncio.iscoroutinefunction(fn):
            return await fn(domain)
        else:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, fn, domain)
    except Exception as e:
        return {
            "module": name,
            "status": "error",
            "score": 0,
            "findings": [],
            "raw_data": {"error": str(e)}
        }
