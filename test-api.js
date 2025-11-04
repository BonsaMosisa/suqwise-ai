// test-api.js
const OPENROUTER_API_KEY =
  "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"; // Paste your key directly for testing

async function testAPI() {
  console.log("Testing OpenRouter API key...");

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            {
              role: "user",
              content: 'Say "SUQWise AI is working!" in a creative way',
            },
          ],
          max_tokens: 100,
        }),
      }
    );

    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("AI Response:", data.choices[0].message.content);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testAPI();
