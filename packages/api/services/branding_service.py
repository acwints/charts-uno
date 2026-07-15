import base64
from urllib.parse import urlparse

MAX_LOGO_BYTES = 500 * 1024
GOOGLE_FAVICON_HOST = "www.google.com"
GOOGLE_FAVICON_PATH = "/s2/favicons"


def is_legacy_google_favicon_url(url: str | None) -> bool:
    """Return whether a logo URL points at the legacy Google favicon service."""
    if not url:
        return False

    parsed = urlparse(url)
    return (
        parsed.scheme == "https"
        and parsed.hostname == GOOGLE_FAVICON_HOST
        and parsed.path == GOOGLE_FAVICON_PATH
    )


def image_bytes_to_data_url(content: bytes, content_type: str | None) -> str:
    """Convert validated image bytes into an export-safe data URL."""
    mime_type = (content_type or "").split(";", 1)[0].strip().lower()
    if not mime_type.startswith("image/"):
        raise ValueError("Logo response is not an image")
    if not content or len(content) > MAX_LOGO_BYTES:
        raise ValueError("Logo image must be between 1 byte and 500KB")

    encoded = base64.b64encode(content).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


async def materialize_browser_safe_logo_url(url: str | None) -> str | None:
    """Embed legacy favicon URLs so canvas export cannot be blocked by CORS.

    User-uploaded data URLs and other existing values are left untouched. Only
    the known Chartsuno-generated Google favicon URL is fetched server-side.
    """
    if not is_legacy_google_favicon_url(url):
        return url

    import httpx

    async with httpx.AsyncClient(follow_redirects=True, timeout=8.0) as client:
        response = await client.get(url)
        response.raise_for_status()

    return image_bytes_to_data_url(
        response.content,
        response.headers.get("content-type"),
    )
