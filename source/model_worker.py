"""Local GGUF adapter. The Node service owns prompt assembly and validation."""

import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", help="Path to a local GGUF file")
    args = parser.parse_args()

    from llama_cpp import Llama

    model = Llama(model_path=args.model, n_ctx=4096, n_threads=4, verbose=False)
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        try:
            messages = json.loads(line)["messages"]
            result = model.create_chat_completion(
                messages=messages,
                temperature=0,
                top_p=1,
                max_tokens=160,
                repeat_penalty=1,
                seed=42,
            )
            response = {"output": result["choices"][0]["message"]["content"]}
        except Exception:
            response = {"error": "generation_failed"}
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
