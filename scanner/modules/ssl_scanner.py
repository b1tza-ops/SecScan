import ssl
import socket
from datetime import datetime, timezone
import httpx

def scan_ssl(domain: str) -> dict:
    findings = []
    raw_data = {}

    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                cipher = ssock.cipher()
                version = ssock.version()

                raw_data["tls_version"] = version
                raw_data["cipher"] = cipher[0] if cipher else None
                raw_data["subject"] = dict(x[0] for x in cert.get("subject", []))
                raw_data["issuer"] = dict(x[0] for x in cert.get("issuer", []))

                # Check expiry
                not_after = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                days_left = (not_after - datetime.now(timezone.utc)).days
                raw_data["expires_in_days"] = days_left
                raw_data["not_after"] = cert["notAfter"]

                if days_left <= 0:
                    findings.append({
                        "title": "SSL Certificate Expired",
                        "description": "The SSL certificate has expired. Browsers will show security warnings.",
                        "severity": "critical",
                        "fix_recommendation": "Renew your SSL certificate immediately.",
                        "fix_example": "sudo certbot renew"
                    })
                elif days_left <= 14:
                    findings.append({
                        "title": f"SSL Certificate Expires Soon ({days_left} days)",
                        "description": "Certificate is expiring very soon, which can cause downtime.",
                        "severity": "high",
                        "fix_recommendation": "Renew your SSL certificate before it expires.",
                        "fix_example": "sudo certbot renew"
                    })
                elif days_left <= 30:
                    findings.append({
                        "title": f"SSL Certificate Expires in {days_left} Days",
                        "description": "Consider renewing your certificate soon.",
                        "severity": "medium",
                        "fix_recommendation": "Schedule certificate renewal.",
                        "fix_example": "sudo certbot renew"
                    })

                # Check TLS version
                if version in ("TLSv1", "TLSv1.1", "SSLv3", "SSLv2"):
                    findings.append({
                        "title": f"Outdated TLS Version: {version}",
                        "description": f"{version} is deprecated and considered insecure.",
                        "severity": "high",
                        "fix_recommendation": "Disable TLS 1.0 and 1.1. Enable TLS 1.2 and TLS 1.3 only.",
                        "fix_example": "ssl_protocols TLSv1.2 TLSv1.3;  # nginx"
                    })

    except ssl.SSLError as e:
        findings.append({
            "title": "SSL/TLS Error",
            "description": str(e),
            "severity": "critical",
            "fix_recommendation": "Ensure your SSL certificate is valid and properly configured.",
            "fix_example": "sudo certbot --nginx -d yourdomain.com"
        })
        raw_data["ssl_error"] = str(e)
    except (socket.timeout, ConnectionRefusedError, OSError):
        findings.append({
            "title": "HTTPS Not Available",
            "description": "Could not establish an HTTPS connection on port 443.",
            "severity": "critical",
            "fix_recommendation": "Install an SSL certificate and enable HTTPS.",
            "fix_example": "sudo certbot --nginx -d yourdomain.com"
        })

    return {
        "module": "ssl",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len(findings) * 20),
        "findings": findings,
        "raw_data": raw_data
    }
