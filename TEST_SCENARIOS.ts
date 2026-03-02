/**
 * TEST SCENARIOS FOR AI MESSAGE INTERPRETATION FIX
 * 
 * Run these tests to verify:
 * 1. Communication preference detection works
 * 2. Trust questions only trigger on actual questions
 * 3. Conversation history provides context
 */

// Test Scenario A: Communication Preference
const testCommunicationPreference = {
  name: "Communication Preference Detection",
  cases: [
    {
      message: "Please text me",
      expected: "Should acknowledge texting preference and continue conversation"
    },
    {
      message: "Text me",
      expected: "Should acknowledge texting preference and continue conversation"
    },
    {
      message: "Can you text me instead?",
      expected: "Should acknowledge texting preference and continue conversation"
    },
    {
      message: "Send me a text",
      expected: "Should acknowledge texting preference and continue conversation"
    }
  ]
};

// Test Scenario B: Trust Questions (should still work)
const testTrustQuestions = {
  name: "Trust Question Detection",
  cases: [
    {
      message: "Where did you get my info?",
      expected: "Should respond with county records explanation"
    },
    {
      message: "How did you find me?",
      expected: "Should respond with county records explanation"
    },
    {
      message: "Who gave you my number?",
      expected: "Should respond with county records explanation"
    },
    {
      message: "What notice?",
      expected: "Should respond with county records explanation"
    }
  ]
};

// Test Scenario C: Multi-turn with History
const testConversationHistory = {
  name: "Conversation History Context",
  cases: [
    {
      history: [
        { role: "assistant", content: "Hi John, this is Jose with RE/MAX. I'm reaching out about a property on Main Street..." },
        { role: "user", content: "What property?" }
      ],
      message: "Why are you contacting me?",
      expected: "Should reference the property mentioned in previous message"
    },
    {
      history: [
        { role: "assistant", content: "Hi Sarah, this is Jose with RE/MAX. I'm reaching out about a property on Oak Avenue..." },
        { role: "user", content: "I'm interested" },
        { role: "assistant", content: "Great! Would you prefer a cash offer or listing for top dollar?" }
      ],
      message: "What's the difference?",
      expected: "Should explain difference between cash offer and listing (contextual to previous question)"
    },
    {
      history: [
        { role: "assistant", content: "Hi Mike, this is Jose with RE/MAX..." },
        { role: "user", content: "Not interested" }
      ],
      message: "Stop texting me",
      expected: "Should end conversation gracefully"
    }
  ]
};

// Test Scenario D: False Positive Prevention
const testFalsePositives = {
  name: "False Positive Prevention",
  cases: [
    {
      message: "Please text me",
      expected: "Should NOT trigger trust question response"
    },
    {
      message: "Can you call me?",
      expected: "Should NOT trigger trust question response"
    },
    {
      message: "Email me the details",
      expected: "Should NOT trigger trust question response"
    }
  ]
};

console.log("=== AI MESSAGE INTERPRETATION TEST SCENARIOS ===\n");
console.log("Test Scenario A:", JSON.stringify(testCommunicationPreference, null, 2));
console.log("\nTest Scenario B:", JSON.stringify(testTrustQuestions, null, 2));
console.log("\nTest Scenario C:", JSON.stringify(testConversationHistory, null, 2));
console.log("\nTest Scenario D:", JSON.stringify(testFalsePositives, null, 2));

console.log("\n=== HOW TO TEST ===");
console.log("1. Deploy changes: npx ampx sandbox");
console.log("2. Use test endpoint: POST /api/v1/test-ai-response");
console.log("3. Send test messages with different scenarios");
console.log("4. Verify AI responses match expected behavior");
console.log("\nExample test request:");
console.log(`
curl -X POST https://your-domain.com/api/v1/test-ai-response \\
  -H "Content-Type: application/json" \\
  -d '{
    "contactId": "GHL_CONTACT_ID",
    "message": "Please text me",
    "conversationHistory": []
  }'
`);
