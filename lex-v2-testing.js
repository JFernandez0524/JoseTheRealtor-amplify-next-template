/**
 * A/B Test Lex V2 vs OpenAI responses
 * Usage: Go to any contact in GHL, use browser console:
 * 
 * // Test OpenAI (current)
 * fetch('/api/v1/test-ai-response', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     contactId: 'ghl-contact-id',
 *     message: 'I want to sell my house'
 *   })
 * }).then(r => r.json()).then(console.log)
 * 
 * // Test Lex V2 (new)
 * fetch('/api/test-lex-v2', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     contactId: 'ghl-contact-id',
 *     message: 'I want to sell my house',
 *     testMode: true
 *   })
 * }).then(r => r.json()).then(console.log)
 */

console.log('🤖 Lex V2 A/B Testing Ready!');
console.log('1. Test current OpenAI: /api/v1/test-ai-response');
console.log('2. Test new Lex V2: /api/test-lex-v2');
console.log('3. Compare responses and choose the better one!');
