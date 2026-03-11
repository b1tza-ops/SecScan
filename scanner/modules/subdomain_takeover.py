import asyncio
import dns.resolver
import dns.exception
import httpx

# Subdomains to check for dangling CNAMEs
CHECK_SUBDOMAINS = [
    "www", "mail", "blog", "shop", "app", "api", "dev", "staging",
    "help", "support", "docs", "cdn", "assets", "media", "status",
    "beta", "old", "demo", "test",
]

# Cloud services that may be susceptible to subdomain takeover
VULNERABLE_SERVICES = {
    "github.io": "GitHub Pages",
    "herokuapp.com": "Heroku",
    "netlify.app": "Netlify",
    "vercel.app": "Vercel",
    "azurewebsites.net": "Azure Web Apps",
    "cloudapp.azure.com": "Azure Cloud",
    "azureedge.net": "Azure CDN",
    "cloudfront.net": "AWS CloudFront",
    "s3.amazonaws.com": "AWS S3",
    "s3-website": "AWS S3",
    "storage.googleapis.com": "Google Cloud Storage",
    "ghost.io": "Ghost",
    "zendesk.com": "Zendesk",
    "surge.sh": "Surge",
    "readme.io": "ReadMe",
    "helpscoutdocs.com": "HelpScout Docs",
    "freshdesk.com": "Freshdesk",
    "hubspot.net": "HubSpot",
    "webflow.io": "Webflow",
    "fastly.net": "Fastly",
    "pantheonsite.io": "Pantheon",
    "kinsta.cloud": "Kinsta",
}

# Error strings that indicate the cloud resource is unclaimed
TAKEOVER_INDICATORS = [
    "there is no app here",
    "there's nothing here yet",
    "no such app",
    "repository not found",
    "404 not found",
    "no such site",
    "doesn't exist",
    "not found on",
    "project not found",
    "this site can't be reached",
    "page not found",
    "no such bucket",
    "nosuchbucket",
    "this page does not exist",
    "incoming.telemetry.mozilla.org",
]

OWASP_CATEGORY = "A01:2021 Broken Access Control"


def get_cname(subdomain_fqdn: str) -> str | None:
    try:
        answers = dns.resolver.resolve(subdomain_fqdn, 'CNAME', lifetime=5)
        return str(answers[0].target).rstrip('.')
    except Exception:
        return None


async def check_takeover(client: httpx.AsyncClient, subdomain: str, cname: str, service: str) -> bool:
    try:
        resp = await asyncio.wait_for(
            client.get(f"https://{subdomain}", follow_redirects=True),
            timeout=6
        )
        body = resp.text.lower()
        return any(indicator in body for indicator in TAKEOVER_INDICATORS)
    except Exception:
        # Connection error can also indicate takeover (unclaimed resource)
        return False


async def scan_subdomain_takeover(domain: str) -> dict:
    findings = []
    raw_data = {
        "cnames_checked": 0,
        "potential_takeovers": [],
        "cloud_cnames": [],
    }

    loop = asyncio.get_event_loop()

    # Resolve CNAMEs for all subdomains concurrently
    async def resolve_cname(subdomain_label: str):
        fqdn = f"{subdomain_label}.{domain}"
        cname = await loop.run_in_executor(None, get_cname, fqdn)
        return subdomain_label, fqdn, cname

    cname_results = await asyncio.gather(
        *[resolve_cname(sub) for sub in CHECK_SUBDOMAINS],
        return_exceptions=True
    )

    # Filter to only subdomains with cloud CNAMEs
    cloud_targets = []
    for result in cname_results:
        if isinstance(result, Exception):
            continue
        label, fqdn, cname = result
        if not cname:
            continue
        raw_data["cnames_checked"] += 1
        for pattern, service_name in VULNERABLE_SERVICES.items():
            if pattern in cname:
                cloud_targets.append((label, fqdn, cname, service_name))
                raw_data["cloud_cnames"].append({"subdomain": fqdn, "cname": cname, "service": service_name})
                break

    if not cloud_targets:
        return {
            "module": "subdomain_takeover",
            "status": "ok",
            "score": 100,
            "findings": [],
            "raw_data": raw_data,
        }

    # Check potential takeovers
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=8,
            verify=False,
        ) as client:
            check_results = await asyncio.gather(
                *[check_takeover(client, fqdn, cname, service) for _, fqdn, cname, service in cloud_targets],
                return_exceptions=True
            )

        for (label, fqdn, cname, service), is_takeover in zip(cloud_targets, check_results):
            if isinstance(is_takeover, Exception):
                is_takeover = False

            if is_takeover:
                raw_data["potential_takeovers"].append(fqdn)
                findings.append({
                    "title": f"Potential Subdomain Takeover: {fqdn}",
                    "description": (
                        f"{fqdn} has a CNAME pointing to {cname} ({service}), "
                        f"but the resource appears unclaimed. An attacker may be able to claim this "
                        f"resource and serve malicious content under your domain."
                    ),
                    "severity": "high",
                    "fix_recommendation": (
                        f"Either delete the DNS CNAME record for {fqdn} or re-claim the {service} "
                        f"resource it points to."
                    ),
                    "fix_example": f"# Remove dangling CNAME:\n# DNS: Delete CNAME record for {label}.{domain}",
                    "owasp_category": OWASP_CATEGORY,
                })
            else:
                # Cloud CNAME exists but resource is claimed — just informational
                findings.append({
                    "title": f"Subdomain Hosted on {service}: {fqdn}",
                    "description": (
                        f"{fqdn} points to {service} via CNAME ({cname}). "
                        f"The resource appears claimed. Monitor this in case it becomes unclaimed."
                    ),
                    "severity": "info",
                    "fix_recommendation": "Ensure the cloud resource remains claimed. If you stop using it, delete the DNS record.",
                    "fix_example": f"# Keep {service} resource active, or remove: DNS CNAME {label}.{domain}",
                    "owasp_category": OWASP_CATEGORY,
                })
    except Exception as e:
        raw_data["error"] = str(e)

    takeover_count = len(raw_data["potential_takeovers"])
    score = max(0, 100 - takeover_count * 30)

    return {
        "module": "subdomain_takeover",
        "status": "ok" if takeover_count == 0 else "issues_found",
        "score": score,
        "findings": findings,
        "raw_data": raw_data,
    }
