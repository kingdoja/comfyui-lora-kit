import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes import resolve_download_path


class RouteHelperTests(unittest.TestCase):
    def test_resolve_download_path_allows_existing_safetensors(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "model.safetensors"
            path.write_bytes(b"model")

            self.assertEqual(resolve_download_path(str(path)), path.resolve())

    def test_resolve_download_path_rejects_missing_file(self):
        with self.assertRaises(FileNotFoundError):
            resolve_download_path("C:/missing/model.safetensors")

    def test_resolve_download_path_rejects_non_safetensors(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "model.txt"
            path.write_text("no", encoding="utf-8")

            with self.assertRaises(ValueError):
                resolve_download_path(str(path))


if __name__ == "__main__":
    unittest.main()
