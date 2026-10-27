import hmac

from django.conf import settings
from django.http import JsonResponse


class ApiTokenMiddleware:
    """Reject /api/ calls lacking the access token (Electron's per-launch token, or the one a host configures).

    Without it any website open in the user's browser could read or overwrite the tree on 127.0.0.1.
    Fails closed: with debug off and no token, the API refuses everything unless the deployment opts in to an
    open demo with FAMILYTREE_PUBLIC_DEMO=1 (see settings.REQUIRE_API_TOKEN). Plain `runserver` skips the check.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith('/api/'):
            return self.get_response(request)
        token = settings.API_TOKEN
        if not token:
            if settings.REQUIRE_API_TOKEN:
                return JsonResponse({'error': 'Server misconfigured: no API token set'}, status=503)
            return self.get_response(request)
        sent = request.headers.get('X-FamilyTree-Token', '')
        if not hmac.compare_digest(sent, token):
            return JsonResponse({'error': 'Invalid or missing API token'}, status=403)
        return self.get_response(request)
