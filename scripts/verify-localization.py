import argparse, base64, copy, hashlib, json, pathlib, sys, zipfile
import cv2, httpx, numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("--reference", default="http://127.0.0.1:8104")
parser.add_argument("--candidate", default="http://127.0.0.1:8105")
parser.add_argument("--output", required=True)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
out = pathlib.Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
sample = root / "backend/examples/lena.png"
assert sample.is_file()
clients = [
    httpx.Client(base_url=u, timeout=120) for u in [args.reference, args.candidate]
]
for c in clients:
    c.get("/api/health").raise_for_status()
metadata = [c.get("/api/nodes").json() for c in clients]
assert metadata[0] == metadata[1]
records = []


def request(client, path, payload):
    r = client.post(path, json=payload)
    r.raise_for_status()
    return r.json()


def prepare(file):
    w = json.loads(file.read_text(encoding="utf8"))
    g = w["graph"]
    for n in g["nodes"]:
        if n["type"] == "load_image":
            n["params"] = {"path": str(sample)}
    return {
        "graph": g,
        "seed": w.get("seed", 0),
        "sample_count": 1,
        "cache": False,
        "allow_custom_code": True,
    }


def hashes(result):
    return {
        f"{s['sample_index']}:{n}:{p}": hashlib.sha256(
            cv2.imdecode(
                np.frombuffer(base64.b64decode(b), np.uint8), cv2.IMREAD_UNCHANGED
            ).tobytes()
            if isinstance(b, str)
            else json.dumps(b, sort_keys=True).encode()
        ).hexdigest()
        for s in result["samples"]
        for n, ports in s["previews"].items()
        for p, b in ports.items()
    }


for file in sorted((root / "frontend/public/examples").glob("*.json")):
    payload = prepare(file)
    results = [request(c, "/api/execute", payload) for c in clients]
    assert results[0] == results[1], file.name
    codes = [
        request(
            c, "/api/codegen", {"graph": payload["graph"], "seed": payload["seed"]}
        )["code"]
        for c in clients
    ]
    assert codes[0] == codes[1]
    execution = []
    for code in codes:
        namespace = {"__name__": "localization_verification"}
        exec(compile(code, file.name + ".py", "exec"), namespace)
        try:
            namespace["run"]()
            execution.append({"status": "success"})
        except (AttributeError, TypeError, NameError) as error:
            execution.append(
                {"status": "error", "type": type(error).__name__, "message": str(error)}
            )
    assert execution[0] == execution[1], (file.name, execution)
    records.append(
        {
            "template": file.name,
            "comparison": "identical",
            "pixels": hashes(results[1]),
            "code_sha256": hashlib.sha256(codes[1].encode()).hexdigest(),
            "generated_python": execution[1],
        }
    )
    print("PASS", file.name, flush=True)
# A real single-image source also verifies standalone generated Python execution.
standalone = {
    "graph": {
        "nodes": [
            {
                "id": "blank-1",
                "type": "blank_image",
                "params": {"width": 64, "height": 48, "channels": "bgr", "fill": 127},
            },
            {
                "id": "blur-1",
                "type": "gaussian_blur",
                "params": {"ksize": 5, "sigma": 0},
            },
            {
                "id": "canny-1",
                "type": "canny",
                "params": {"threshold1": 80, "threshold2": 160},
            },
        ],
        "edges": [
            {"id": "s1", "source": "blank-1", "target": "blur-1"},
            {"id": "s2", "source": "blur-1", "target": "canny-1"},
        ],
    },
    "seed": 0,
    "sample_count": 1,
    "cache": False,
}
results = [request(c, "/api/execute", standalone) for c in clients]
assert results[0] == results[1]
codes = [
    request(c, "/api/codegen", {"graph": standalone["graph"], "seed": 0})["code"]
    for c in clients
]
assert codes[0] == codes[1]
namespace = {"__name__": "localization_verification"}
exec(compile(codes[1], "standalone.py", "exec"), namespace)
captured = {}


def profile(frame, event, arg):
    if frame.f_code is namespace["run"].__code__ and event == "return":
        captured.update(frame.f_locals)


sys.setprofile(profile)
try:
    namespace["run"]()
finally:
    sys.setprofile(None)
for node, ports in results[1]["samples"][0]["previews"].items():
    for port, b64 in ports.items():
        decoded = cv2.imdecode(
            np.frombuffer(base64.b64decode(b64), np.uint8), cv2.IMREAD_UNCHANGED
        )
        assert np.array_equal(decoded, captured[node.replace("-", "_") + "_" + port])
records.append(
    {
        "standalone_python": "success",
        "comparison": "pixels identical",
        "pixels": hashes(results[1]),
    }
)
base = prepare(root / "frontend/public/examples/blur_canny.json")
# Validate actual saved files and ZIP entries against the computed Canny image.
expected = cv2.imdecode(
    np.frombuffer(
        base64.b64decode(
            request(clients[1], "/api/execute", base)["samples"][0]["previews"][
                "canny-1"
            ]["image"]
        ),
        np.uint8,
    ),
    cv2.IMREAD_UNCHANGED,
)
for mode in ["bare", "zip"]:
    p = copy.deepcopy(base)
    directory = out / ("saved-" + mode)
    p["graph"]["nodes"].append(
        {
            "id": "save-1",
            "type": "save_image",
            "params": {
                "filename": "verified.png",
                "output_dir": str(directory),
                "packaging": mode,
            },
        }
    )
    p["graph"]["edges"].append(
        {
            "id": "save-edge",
            "source": "canny-1",
            "source_port": "image",
            "target": "save-1",
            "target_port": "image",
        }
    )
    request(clients[1], "/api/execute", p)
    if mode == "bare":
        saved = list(directory.glob("*.png"))
        assert len(saved) == 1
        image = cv2.imread(str(saved[0]), cv2.IMREAD_UNCHANGED)
    else:
        archives = list(directory.glob("*.zip"))
        assert len(archives) == 1
        with zipfile.ZipFile(archives[0]) as z:
            names = z.namelist()
            assert len(names) == 1
            image = cv2.imdecode(
                np.frombuffer(z.read(names[0]), np.uint8), cv2.IMREAD_UNCHANGED
            )
    assert np.array_equal(expected, image)
    records.append({"save": mode, "comparison": "pixels identical"})
invalid = []
for title, mutate in [
    (
        "cycle",
        lambda p: p["graph"]["edges"].append(
            {"id": "cycle", "source": "canny-1", "target": "load-1"}
        ),
    ),
    (
        "unknown node",
        lambda p: p["graph"]["nodes"][1].update(type="unknown-localization-test"),
    ),
    ("invalid parameter", lambda p: p["graph"]["nodes"][1]["params"].update(ksize=-1)),
    (
        "missing file",
        lambda p: p["graph"]["nodes"][0]["params"].update(
            path=str(out / "missing.png")
        ),
    ),
]:
    p = copy.deepcopy(base)
    mutate(p)
    responses = [c.post("/api/execute", json=p) for c in clients]
    assert all(r.status_code == 400 for r in responses)
    assert responses[0].json() == responses[1].json()
    invalid.append(
        {"case": title, "status": 400, "detail": responses[1].json()["detail"]}
    )
p = prepare(root / "frontend/public/examples/custom_python_sepia.json")
p["allow_custom_code"] = False
responses = [c.post("/api/execute", json=p) for c in clients]
assert all(r.status_code == 400 for r in responses)
assert responses[0].json() == responses[1].json()
invalid.append(
    {"case": "untrusted code", "status": 400, "detail": responses[1].json()["detail"]}
)
report = {
    "reference": args.reference,
    "candidate": args.candidate,
    "builtin_nodes": len(metadata[1]),
    "workflows": records,
    "invalid_inputs": invalid,
}
(out / "backend-verification.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8"
)
print("All real-backend comparisons passed.", flush=True)
