from __future__ import annotations

from typing import Callable
from urllib.parse import urlparse

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options


class SubdomainMiddleware:
    """
    Extracts any subdomain from request.get_host() relative to the `system.url-prefix` option, and attaches it to
    the request object under request.subdomain.

    If no subdomain is extracted, then request.subdomain is None.
    """

    def __init__(self, get_response: Callable[[Request], Response]):
        self.url_prefix = options.get("system.url-prefix")
        self.netloc = ""

        if self.url_prefix:
            self.url_prefix = self.url_prefix.rstrip("/")

            parsed_url_prefix = urlparse(self.url_prefix)
            self.netloc = parsed_url_prefix.netloc.lower()

        self.get_response = get_response

    def __call__(self, request: Request) -> Response:
        setattr(request, "subdomain", None)

        netloc = self.netloc
        if not self.url_prefix or not netloc:
            return self.get_response(request)

        host = request.get_host().lower()

        if not host.endswith(f".{netloc}"):
            return self.get_response(request)

        subdomain = host[: -len(netloc)].rstrip(".")

        if len(subdomain) == 0:
            subdomain = None

        setattr(request, "subdomain", subdomain)
        return self.get_response(request)
