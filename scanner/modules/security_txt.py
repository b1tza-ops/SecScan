import httpx
from datetime import datetime, timezone

OWASP_CATEGORY = "A05:2021 Security Misconfiguration"


def parse_security_txt(content: str) -> dict:
    fields = {}
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if ':' in line:
            key, _, value = line.partition(':')
            key = key.strip().lower()
            value = value.strip()
            if key not in fields:
                fields[key] = []
            fields[key].append(value)
    return fields


async def scan_security_txt(domain: str) -> dict:
    findings = []
    raw_data = {}

    paths = ["/.well-known/security.txt", "/security.txt"]
    content = None
    found_at = None

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8) as client:
            for path in paths:
                try:
                    resp = await client.get(f"https://{domain}{path}")
                    if resp.status_code == 200 and len(resp.text) > 10:
                        content = resp.text
                        found_at = path
                        break
                except Exception:
                    continue

        if not content:
            findings.append({
                "title": "Missing security.txt",
                "description": (
                    "No security.txt file found at /.well-known/security.txt or /security.txt. "
                    "security.txt (RFC 9116) provides a standard way for security researchers to "
                    "report vulnerabilities to you."
                ),
                "severity": "low",
                "fix_recommendation": "Create a security.txt file at /.well-known/security.txt with at least a Contact and Expires field.",
                "fix_example": (
                    "# /.well-known/security.txt\n"
                    "Contact: mailto:security@yourdomain.com\n"
                    "Expires: 2026-12-31T23:59:00.000Z\n"
                    "Preferred-Languages: en"
                ),
                "owasp_category": OWASP_CATEGORY,
            })
            return {
                "module": "security_txt",
                "status": "issues_found",
                "score": 80,
                "findings": findings,
                "raw_data": raw_data,
            }

        raw_data["found_at"] = found_at
        raw_data["content"] = content[:2000]

        fields = parse_security_txt(content)
        raw_data["fields"] = {k: v for k, v in fields.items()}

        # Check required: Contact
        if "contact" not in fields:
            findings.append({
                "title": "security.txt Missing Contact Field",
                "description": "security.txt exists but has no Contact field. RFC 9116 requires at least one Contact entry.",
                "severity": "low",
                "fix_recommendation": "Add a Contact field to security.txt.",
                "fix_example": "Contact: mailto:security@yourdomain.com",
                "owasp_category": OWASP_CATEGORY,
            })

        # Check required: Expires
        if "expires" not in fields:
            findings.append({
                "title": "security.txt Missing Expires Field",
                "description": "security.txt exists but has no Expires field. RFC 9116 requires an Expires date.",
                "severity": "low",
                "fix_recommendation": "Add an Expires field to security.txt.",
                "fix_example": "Expires: 2026-12-31T23:59:00.000Z",
                "owasp_category": OWASP_CATEGORY,
            })
        else:
            # Check if expired
            try:
                expires_str = fields["expires"][0]
                # Handle both date and datetime formats
                expires_str = expires_str.replace('Z', '+00:00')
                if 'T' in expires_str:
                    expires_dt = datetime.fromisoformat(expires_str)
                else:
                    expires_dt = datetime.strptime(expires_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)

                now = datetime.now(timezone.utc)
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)

                if expires_dt < now:
                    days_expired = (now - expires_dt).days
                    findings.append({
                        "title": f"security.txt Has Expired ({days_expired} days ago)",
                        "description": f"security.txt expired on {expires_dt.date()}. An expired security.txt may be ignored by security researchers.",
                        "severity": "medium",
                        "fix_recommendation": "Update the Expires field in security.txt to a future date.",
                        "fix_example": f"Expires: 2026-12-31T23:59:00.000Z",
                        "owasp_category": OWASP_CATEGORY,
                    })
                else:
                    days_left = (expires_dt - now).days
                    raw_data["expires_in_days"] = days_left
                    if days_left < 30:
                        findings.append({
                            "title": f"security.txt Expiring Soon ({days_left} days)",
                            "description": "security.txt will expire soon. Update it before it expires.",
                            "severity": "low",
                            "fix_recommendation": "Update the Expires field in security.txt.",
                            "fix_example": "Expires: 2026-12-31T23:59:00.000Z",
                            "owasp_category": OWASP_CATEGORY,
                        })
            except Exception:
                raw_data["expires_parse_error"] = True

        # Good — if no issues found, report it as a positive info finding
        if not findings:
            findings.append({
                "title": "security.txt Present and Valid",
                "description": f"security.txt found at {found_at} with Contact and Expires fields. Follows RFC 9116.",
                "severity": "info",
                "fix_recommendation": "Keep security.txt up to date and renew before it expires.",
                "fix_example": None,
                "owasp_category": OWASP_CATEGORY,
            })

    except Exception as e:
        raw_data["error"] = str(e)

    score = max(0, 100 - sum(
        {"medium": 10, "low": 5}.get(f["severity"], 0) for f in findings
    ))

    return {
        "module": "security_txt",
        "status": "ok" if all(f["severity"] == "info" for f in findings) else "issues_found",
        "score": score,
        "findings": findings,
        "raw_data": raw_data,
    }
