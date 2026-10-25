import os
from pathlib import Path

from sarvamai import SarvamAI


if not os.environ.get("SARVAM_API_KEY"):
    env_file = Path(__file__).with_name(".env")
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            name, separator, value = line.partition("=")
            if separator and name.strip() == "SARVAM_API_KEY":
                value = value.strip().strip("\"'")
                if value:
                    os.environ["SARVAM_API_KEY"] = value
                break

api_key = os.environ.get("SARVAM_API_KEY")
if not api_key:
    raise SystemExit("Add SARVAM_API_KEY to this project's .env file, then run this script again.")

client = SarvamAI(api_subscription_key=api_key)
response = client.chat.completions(
    model="sarvam-105b-conversations",
    messages=[{"role": "user", "content": "Say hello in one short sentence."}],
)
print(response.choices[0].message.content)
