// Test fixture: clean JavaScript file with no secrets
const apiKey = process.env.OPENAI_API_KEY;

const message = "Hello, world!";
const modelName = "sk-learn-model-v1";

const config = {
  endpoint: "https://api.openai.com/v1",
  timeout: 30000
};
