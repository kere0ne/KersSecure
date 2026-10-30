# KersSecure on PythonAnywhere

This Flask adapter is a deployable preview for PythonAnywhere's standard WSGI hosting. It is not yet the complete script-hosting and whitelisting SaaS.

## Deploy
1. Clone or pull this repository in a PythonAnywhere Bash console.
2. Create a virtualenv: `python3.13 -m venv ~/.virtualenvs/kerssecure`.
3. Activate it and install: `pip install -r requirements.txt`.
4. Set the Web tab source code directory to this repository directory.
5. Set virtualenv path to `/home/kers0nez/.virtualenvs/kerssecure`.
6. Edit `/var/www/kers0nez_pythonanywhere_com_wsgi.py`:

```python
import sys
path = '/home/kers0nez/KersSecure'
if path not in sys.path:
    sys.path.insert(0, path)
from pythonanywhere_app import app as application
```

7. Reload the web app and visit `https://kers0nez.pythonanywhere.com/health`.

## Limitations
The adapter currently provides a landing page and health endpoint only. Discord OAuth, persistent users/projects, encrypted private script storage, license validation, admin tools, and audit logging still need implementation and configuration. Do not present this preview as a production whitelist or script delivery service.
