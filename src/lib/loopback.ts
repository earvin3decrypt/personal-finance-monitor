const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Hostname from a Host header, without the port. */
export function hostnameFromHostHeader(hostHeader: string): string {
  const host = hostHeader.trim().toLowerCase();
  if (!host) return "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(0, end + 1);
  }
  const colon = host.lastIndexOf(":");
  if (colon > 0 && /^\d+$/.test(host.slice(colon + 1))) {
    return host.slice(0, colon);
  }
  return host;
}

export function isLoopbackHostHeader(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  return LOOPBACK_HOSTS.has(hostnameFromHostHeader(hostHeader));
}

/** True for a loopback address, including IPv4-mapped IPv6. */
export function isLoopbackAddress(value: string): boolean {
  const trimmed = value.trim().toLowerCase().replace(/^::ffff:/, "");
  if (LOOPBACK_HOSTS.has(trimmed)) return true;
  return LOOPBACK_HOSTS.has(hostnameFromHostHeader(trimmed));
}

/**
 * The app is single-user with no auth, so public API routes only accept
 * requests that look like they came from this machine.
 */
export function isLocalRequest(request: {
  headers: { get(name: string): string | null };
}): boolean {
  if (!isLoopbackHostHeader(request.headers.get("host"))) return false;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (
    forwardedHost &&
    !isLoopbackHostHeader(forwardedHost.split(",")[0] ?? "")
  ) {
    return false;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && !isLoopbackAddress(forwarded.split(",")[0] ?? "")) {
    return false;
  }
  return true;
}
