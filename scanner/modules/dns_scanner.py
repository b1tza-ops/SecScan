import dns.resolver
import dns.exception

OWASP_CATEGORY = "A07:2021 Identification and Authentication Failures"

def scan_dns(domain: str) -> dict:
    findings = []
    raw_data = {}

    # SPF
    try:
        answers = dns.resolver.resolve(domain, 'TXT', lifetime=10)
        txt_records = [r.to_text().strip('"') for r in answers]
        raw_data["txt_records"] = txt_records
        spf = [r for r in txt_records if r.startswith("v=spf1")]
        if not spf:
            findings.append({
                "title": "Missing SPF Record",
                "description": "No SPF record found. Attackers can send emails impersonating your domain.",
                "severity": "high",
                "fix_recommendation": "Add an SPF TXT record to your DNS.",
                "fix_example": 'TXT @ "v=spf1 include:_spf.google.com ~all"',
                "owasp_category": OWASP_CATEGORY,
            })
        else:
            raw_data["spf"] = spf[0]
            if "-all" not in spf[0] and "~all" not in spf[0]:
                findings.append({
                    "title": "Weak SPF Policy",
                    "description": "SPF record doesn't specify a reject/softfail policy.",
                    "severity": "medium",
                    "fix_recommendation": "Use -all or ~all at the end of your SPF record.",
                    "fix_example": 'TXT @ "v=spf1 include:_spf.yourmailprovider.com -all"',
                    "owasp_category": OWASP_CATEGORY,
                })
    except dns.exception.DNSException:
        findings.append({
            "title": "DNS TXT Lookup Failed",
            "description": "Could not query TXT records.",
            "severity": "info",
            "fix_recommendation": "Ensure DNS is properly configured.",
            "fix_example": None,
            "owasp_category": OWASP_CATEGORY,
        })

    # DMARC
    try:
        answers = dns.resolver.resolve(f"_dmarc.{domain}", 'TXT', lifetime=10)
        dmarc_records = [r.to_text().strip('"') for r in answers]
        dmarc = [r for r in dmarc_records if r.startswith("v=DMARC1")]
        raw_data["dmarc"] = dmarc[0] if dmarc else None
        if not dmarc:
            findings.append({
                "title": "Missing DMARC Record",
                "description": "No DMARC record found. Email spoofing attacks are possible.",
                "severity": "high",
                "fix_recommendation": "Add a DMARC TXT record at _dmarc.yourdomain.com.",
                "fix_example": 'TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"',
                "owasp_category": OWASP_CATEGORY,
            })
        else:
            if "p=none" in dmarc[0]:
                findings.append({
                    "title": "DMARC Policy Set to None",
                    "description": "DMARC is monitoring only (p=none). Spoofed emails are not blocked.",
                    "severity": "medium",
                    "fix_recommendation": "Upgrade DMARC policy to p=quarantine or p=reject.",
                    "fix_example": 'TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"',
                    "owasp_category": OWASP_CATEGORY,
                })
    except dns.exception.NXDOMAIN:
        findings.append({
            "title": "Missing DMARC Record",
            "description": "No DMARC record found at _dmarc subdomain.",
            "severity": "high",
            "fix_recommendation": "Add a DMARC TXT record.",
            "fix_example": 'TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"',
            "owasp_category": OWASP_CATEGORY,
        })
    except dns.exception.DNSException:
        pass

    # DNSSEC
    try:
        dns.resolver.resolve(domain, 'DNSKEY', lifetime=10)
        raw_data["dnssec"] = True
    except Exception:
        raw_data["dnssec"] = False
        findings.append({
            "title": "DNSSEC Not Enabled",
            "description": "DNSSEC is not configured. DNS responses could be spoofed (DNS cache poisoning).",
            "severity": "medium",
            "fix_recommendation": "Enable DNSSEC with your domain registrar.",
            "fix_example": "Enable DNSSEC in your domain registrar's control panel.",
            "owasp_category": OWASP_CATEGORY,
        })

    return {
        "module": "dns",
        "status": "ok" if not findings else "issues_found",
        "score": max(0, 100 - len(findings) * 15),
        "findings": findings,
        "raw_data": raw_data
    }
