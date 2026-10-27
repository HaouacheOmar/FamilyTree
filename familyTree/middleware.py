import hmac

from django.conf import settings
from django.http import JsonResponse


class ApiTokenMiddleware:
    """Reject /api/ calls lacking the per-launch token Electron hands to the backend and the UI.

    Without it any website open in the user's browser could read or overwrite the tree on 127.0.0.1.
    No token configured (plain `runserver` in development) means no check.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = settings.API_TOKEN
        if token and request.path.startswith('/api/'):
            sent = request.headers.get('X-FamilyTree-Token', '')
            if not hmac.compare_digest(sent, token):
                return JsonResponse({'error': 'Invalid or missing API token'}, status=403)
        return self.get_response(request)
