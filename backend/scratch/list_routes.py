from app.main import app
import app.routers.management as mgmt
print(f"Management module file: {mgmt.__file__}")

for route in app.routes:
    # Check if it has path and methods (APIRoute)
    path = getattr(route, 'path', None)
    methods = getattr(route, 'methods', None)
    if path:
        print(f"{path} [{','.join(methods) if methods else ''}]")
