"""Compare public UI semantics against the pinned, untouched main revision."""
from pathlib import Path
from html.parser import HTMLParser
import json
import subprocess

BASE = "8aaaedcfdd512f2b33e97d894b48e57396ab3dc2"
PAGES = [Path("public") / (name + ".html") for name in ("index", "faq", "privacy", "terms", "account-deletion")]
PAGES += sorted(Path("public/tools").glob("*.html"))


class Semantics(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.text = []
        self.controls = []
        self.ids = []
        self.original_scripts = []
        self.images = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag in ("svg", "script", "style"):
            self.skip += 1
        if tag == "script" and attrs.get("src") and "/public-icon" not in attrs["src"] and "public-icon-surfaces" not in attrs["src"]:
            self.original_scripts.append(attrs)
        if tag == "img":
            self.images.append(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag in ("a", "button", "input", "form", "select", "textarea", "details", "summary"):
            attrs.pop("data-cloud-action-icon", None)
            self.controls.append((tag, attrs))

    def handle_startendtag(self, tag, attributes):
        self.handle_starttag(tag, attributes)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in ("svg", "script", "style"):
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data)


checked = []
for path in PAGES:
    original = subprocess.check_output(["git", "show", BASE + ":" + path.as_posix()]).decode("utf-8")
    current = path.read_text(encoding="utf-8")
    before, after = Semantics(), Semantics()
    before.feed(original)
    after.feed(current)
    assert " ".join(" ".join(before.text).split()) == " ".join(" ".join(after.text).split()), f"Visible text changed: {path}"
    assert before.ids == after.ids, f"IDs changed: {path}"
    assert before.original_scripts == after.original_scripts, f"Existing script URLs/order changed: {path}"
    assert before.images == after.images, f"Existing image/brand attributes changed: {path}"
    assert len(before.controls) == len(after.controls), f"Interactive controls added/removed: {path}"
    for (old_tag, old), (new_tag, new) in zip(before.controls, after.controls):
        assert old_tag == new_tag
        for key, value in old.items():
            if key == "class":
                assert set((value or "").split()).issubset(set((new.get(key) or "").split())), f"Control class removed: {path}"
            else:
                assert new.get(key) == value, f"Control attribute changed: {path} {key}"
    checked.append({"path": path.as_posix(), "existingControls": len(before.controls), "ids": len(before.ids)})

changed = subprocess.check_output(["git", "diff", "--diff-filter=MDRT", "--name-only", BASE]).decode().splitlines()
assert all(path in {p.as_posix() for p in PAGES} for path in changed), "An existing non-public-HTML file was changed"
report = {"base": BASE, "publicPages": len(checked), "unchanged": ["visible content", "all existing control attributes and destinations", "forms and inputs", "IDs", "existing scripts and clients", "image/brand attributes", "backend/auth/API files"], "pages": checked}
Path("tools/public-icons/qa-results/preservation-validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"publicPages": len(checked), "controls": sum(page["existingControls"] for page in checked), "ids": sum(page["ids"] for page in checked), "result": "All original behavior-facing semantics preserved"}))
