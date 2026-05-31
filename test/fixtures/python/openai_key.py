# Test fixture: file with an OpenAI API key
import openai

api_key = "sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx"
openai_client = openai.OpenAI(api_key=api_key)

# Another pattern: direct assignment
OPENAI_API_KEY = "sk-svcacct-zyx987wvu654tsr321qpo098nml765kji432hgf"

# Not a real key: too short
short_string = "sk-short"

# Not a key: variable name doesn't suggest a secret
name = "sk-this-is-just-a-name-not-a-real-key"
