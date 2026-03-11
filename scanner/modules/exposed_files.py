import asyncio
import httpx

EXPOSED_PATHS = [
    ("/.env", "critical", "Environment file exposed — may contain DB credentials, API keys, JWT secrets."),
    ("/.env.local", "critical", "Local environment file exposed — may contain sensitive credentials."),
    ("/.env.production", "critical", "Production environment file exposed — contains live credentials."),
    ("/.git/HEAD", "critical", "Git repository exposed — source code and history accessible to attackers."),
    ("/.git/config", "critical", "Git config exposed — reveals remote URL, branches, and repository info."),
    ("/backup.zip", "critical", "Backup archive exposed — may contain full site source or database dump."),
    ("/backup.sql", "critical", "SQL backup exposed — database contents may be downloadable."),
    ("/db.sql", "critical", "SQL dump exposed — full database may be accessible."),
    ("/database.sql", "critical", "SQL dump exposed — full database may be accessible."),
    ("/dump.sql", "critical", "SQL dump exposed — full database may be accessible."),
    ("/wp-config.php.bak", "critical", "WordPress config backup exposed — contains database credentials."),
    ("/config.php.bak", "critical", "Config backup exposed — may contain database or app credentials."),
    ("/phpinfo.php", "high", "phpinfo() page exposed — reveals PHP version, server config, and loaded modules."),
    ("/info.php", "high", "phpinfo() page exposed — reveals PHP configuration details."),
    ("/api/swagger.json", "high", "Swagger/OpenAPI spec exposed — reveals all API endpoints and parameters."),
    ("/swagger.json", "high", "Swagger/OpenAPI spec exposed — reveals all API endpoints and parameters."),
    ("/openapi.json", "high", "OpenAPI spec exposed — reveals all API endpoints and parameters."),
    ("/api-docs", "high", "API documentation exposed — reveals internal API structure."),
    ("/api/docs", "high", "API documentation exposed — reveals internal API structure."),
    ("/actuator", "high", "Spring Boot Actuator exposed — reveals application metrics and config."),
    ("/actuator/env", "high", "Spring Boot Actuator /env exposed — may leak environment variables."),
    ("/actuator/health", "low", "Spring Boot Actuator /health exposed — reveals application health status."),
    ("/.htaccess", "medium", ".htaccess file exposed — reveals server configuration and rewrite rules."),
    ("/.DS_Store", "medium", ".DS_Store file exposed — reveals directory structure on macOS-hosted sites."),
    ("/server-status", "medium", "Apache server-status exposed — reveals server load, request details."),
    ("/server-info", "medium", "Apache server-info exposed — reveals server configuration and modules."),
    ("/config.yml", "high", "YAML config file exposed — may contain credentials or secrets."),
    ("/config.yaml", "high", "YAML config file exposed — may contain credentials or secrets."),
    ("/.npmrc", "high", ".npmrc exposed — may contain npm auth tokens."),
    ("/composer.json", "low", "composer.json exposed — reveals PHP dependencies (acceptable but not ideal)."),
    ("/package.json", "low", "package.json exposed — reveals Node.js dependencies and scripts."),
]

FIX_EXAMPLES = {
    "critical": {
        "/.env": "location ~ /\\.env { deny all; }  # nginx",
        "/.git/HEAD": "location ~ /\\.git { deny all; }  # nginx",
        "/backup.zip": "rm -f /var/www/html/backup.zip  # Remove backup files from web root",
    },
    "default": "location ~ /\\.(env|git|htaccess|bak|sql|config) { deny all; }  # nginx"
}

OWASP_CATEGORY = "A01:2021 Broken Access Control"

async def check_path(client: httpx.AsyncClient, domain: str, path: str) -> tuple[bool, int]:
    try:
        resp = await asyncio.wait_for(
            client.get(f"https://{domain}{path}"),
            timeout=6
        )
        # Only flag if actually returning content (not redirect to login page)
        if resp.status_code == 200 and len(resp.content) > 0:
            # Avoid false positives from generic 200 pages (login redirects etc)
            if path in ("/.git/HEAD",):
                return "ref:" in resp.text or "HEAD" in resp.text, resp.status_code
            return True, resp.status_code
        return False, resp.status_code
    except Exception:
        return False, 0

async def scan_exposed_files(domain: str) -> dict:
    findings = []
    raw_data = {"exposed": []}

    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=8) as client:
            tasks = [(path, sev, desc) for path, sev, desc in EXPOSED_PATHS]
            results = await asyncio.gather(
                *[check_path(client, domain, p) for p, _, _ in tasks],
                return_exceptions=True
            )

            for (path, severity, description), result in zip(tasks, results):
                if isinstance(result, Exception):
                    continue
                is_exposed, status_code = result
                if is_exposed:
                    raw_data["exposed"].append({"path": path, "status": status_code})
                    fix_ex = FIX_EXAMPLES.get("critical", {}).get(path, FIX_EXAMPLES["default"])
                    findings.append({
                        "title": f"Exposed File: {path}",
                        "description": description,
                        "severity": severity,
                        "fix_recommendation": f"Restrict access to {path} via your web server configuration or remove the file from the web root.",
                        "fix_example": fix_ex,
                        "owasp_category": OWASP_CATEGORY,
                    })

    except Exception as e:
        raw_data["error"] = str(e)

    critical_count = sum(1 for f in findings if f["severity"] == "critical")
    high_count = sum(1 for f in findings if f["severity"] == "high")
    score = max(0, 100 - critical_count * 30 - high_count * 15 - len([f for f in findings if f["severity"] == "medium"]) * 5)

    return {
        "module": "exposed_files",
        "status": "ok" if not findings else "issues_found",
        "score": score,
        "findings": findings,
        "raw_data": raw_data,
    }
