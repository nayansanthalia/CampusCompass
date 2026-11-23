"""Build the self-contained helpdesk from its CSS, data, and JavaScript sources."""

import base64
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def load(path):
    return json.loads(read(path))


def script_hash(content):
    digest = hashlib.sha256(content.encode("utf-8")).digest()
    return "'sha256-" + base64.b64encode(digest).decode("ascii") + "'"


def build():
    release = load("package.json")["version"]
    runs = load("evidence/model_evaluation.json")
    summary = load("evidence/component_results.json")["summary"]
    summary.pop("generated_at", None)
    data = {
        "release": release,
        "corpus": load("data/corpus.json"),
        "prompts": load("data/prompts.json"),
        "tests": load("data/tests.json"),
        "components": {"summary": summary},
        "modelCases": load("data/model_cases.json"),
        "modelSummary": load("evidence/model_summary.json"),
        "modelRuns": [
            {key: row[key] for key in ("case", "version", "raw_output", "seconds", "usage", "contract_pass")}
            for row in runs
        ],
    }
    data_script = "const DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + ";"
    engine_script = read("source/engine.js")
    app_script = read("app/app.js")
    photo = base64.b64encode((ROOT / "app/assets/campus.webp").read_bytes()).decode("ascii")
    css = read("app/style.css").replace("/*HERO_IMAGE*/", "data:image/webp;base64," + photo)
    csp = " ".join([
        "default-src 'none';",
        "script-src " + " ".join(map(script_hash, (data_script, engine_script, app_script))) + ";",
        "style-src " + script_hash(css) + ";",
        "img-src data:;",
        "connect-src 'self';",
        "base-uri 'none';",
        "form-action 'none';",
    ])
    parts = {"CSP": csp, "STYLE": css, "DATA": data_script, "ENGINE": engine_script, "APP": app_script}
    html = re.sub(r"/\*(CSP|STYLE|DATA|ENGINE|APP)\*/", lambda match: parts[match[1]], read("app/index.template.html"))
    (ROOT / "CampusCompass.html").write_text(html, encoding="utf-8", newline="\n")
    (ROOT / "dist").mkdir(exist_ok=True)
    (ROOT / "dist/index.html").write_text(html, encoding="utf-8", newline="\n")
    print("CampusCompass offline build completed (" + str(len(html.encode("utf-8"))) + " bytes).")


if __name__ == "__main__":
    build()
