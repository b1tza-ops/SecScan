import socket
import asyncio

# Only scan a small set of common, safe ports
SAFE_PORTS = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    80: "HTTP",
    443: "HTTPS",
    3306: "MySQL",
    5432: "PostgreSQL",
    6379: "Redis",
    8080: "HTTP-Alt",
    8443: "HTTPS-Alt",
    27017: "MongoDB",
}

RISKY_PORTS = {
    21: ("FTP Port Open", "FTP transmits credentials in plaintext.", "high", "Disable FTP. Use SFTP instead."),
    23: ("Telnet Port Open", "Telnet is unencrypted. Credentials sent in plaintext.", "critical", "Disable Telnet immediately. Use SSH instead."),
    3306: ("MySQL Exposed to Internet", "Database port accessible publicly.", "critical", "Bind MySQL to 127.0.0.1 only. Use firewall rules."),
    5432: ("PostgreSQL Exposed to Internet", "Database port accessible publicly.", "critical", "Bind PostgreSQL to localhost only."),
    6379: ("Redis Exposed to Internet", "Redis has no authentication by default.", "critical", "Bind Redis to localhost. Enable requirepass."),
    27017: ("MongoDB Exposed to Internet", "MongoDB may be accessible without authentication.", "critical", "Bind MongoDB to localhost. Enable auth."),
}

async def check_port(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False

async def scan_ports_safe(domain: str) -> dict:
    findings = []
    raw_data = {"open_ports": []}

    try:
        ip = socket.gethostbyname(domain)
        raw_data["ip"] = ip
    except socket.gaierror:
        raw_data["error"] = "DNS resolution failed"
        return {"module": "ports", "status": "error", "score": 50, "findings": [], "raw_data": raw_data}

    tasks = {port: check_port(ip, port) for port in SAFE_PORTS}
    results = await asyncio.gather(*tasks.values())

    for port, is_open in zip(tasks.keys(), results):
        if is_open:
            raw_data["open_ports"].append({"port": port, "service": SAFE_PORTS[port]})
            if port in RISKY_PORTS:
                title, desc, severity, fix = RISKY_PORTS[port]
                findings.append({
                    "title": title,
                    "description": desc,
                    "severity": severity,
                    "fix_recommendation": fix,
                    "fix_example": f"ufw deny {port}  # or block in your firewall"
                })

    return {
        "module": "ports",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len(findings) * 25),
        "findings": findings,
        "raw_data": raw_data
    }
