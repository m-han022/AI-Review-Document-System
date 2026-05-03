from app.main import app

for route in app.routes:
    if "projects" in route.path:
        print(f"Path: {route.path}, Methods: {route.methods}")
