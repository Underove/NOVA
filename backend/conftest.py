import sys
from pathlib import Path

# Ensure the backend directory is on sys.path so `import app.*` works
sys.path.insert(0, str(Path(__file__).parent))
