import json
import logging
import sys
from flask import Flask, Response, request
from app import decide, _scorer

app = Flask(__name__)
logging.getLogger("werkzeug").disabled = True
app.logger.disabled = True

@app.get("/ping")
def ping():
    return Response("{}", status=200, mimetype="application/json")

@app.post("/invocations")
def invocations():
    try:
        if request.mimetype != "application/json":
            return Response('{"error":"CONTENT_TYPE_REQUIRED"}', status=415, mimetype="application/json")
        result = decide(request.get_json(force=False, silent=False), _scorer)
        return Response(json.dumps(result), status=200, mimetype="application/json")
    except (KeyError, TypeError, ValueError):
        return Response('{"error":"INVALID_REQUEST"}', status=400, mimetype="application/json")
    except Exception as error:
        name = type(error).__name__
        if not name.isidentifier() or len(name) > 80:
            name = "UnknownError"
        print("support_checker_error_class=" + name, file=sys.stderr, flush=True)
        return Response('{"error":"INFERENCE_FAILED"}', status=500, mimetype="application/json")

if __name__ == "__main__":
    # SageMaker BYOC may append "serve"; no request/content data is logged.
    app.run(host="0.0.0.0", port=8080, debug=False)
