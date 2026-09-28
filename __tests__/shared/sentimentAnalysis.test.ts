import { describe, it, expect } from 'vitest';
import { analyzeLeadIntent } from '../../amplify/functions/shared/sentimentAnalysis';

describe('analyzeLeadIntent', () => {
  it('classifies pure email address as CONVERSATION and POSITIVE (never STOP/DND)', async () => {
    const result = await analyzeLeadIntent('Ccavallone1@gmail.com');
    expect(result.intent).toBe('CONVERSATION');
    expect(result.sentiment).toBe('POSITIVE');
  });

  it('classifies wrong email / landlord / tenant responses as WRONG_INFO', async () => {
    const tenantReply = 'This is not Tony email , he was my land lord about 6 years';
    const result = await analyzeLeadIntent(tenantReply);
    expect(result.intent).toBe('WRONG_INFO');
  });

  it('classifies explicit wrong email as WRONG_INFO', async () => {
    const wrongEmail = 'You have the wrong email address';
    const result = await analyzeLeadIntent(wrongEmail);
    expect(result.intent).toBe('WRONG_INFO');
  });

  it('classifies wrong person/number as WRONG_INFO', async () => {
    const result = await analyzeLeadIntent('Wrong number, please remove');
    expect(result.intent).toBe('WRONG_INFO');
  });

  it('classifies legal opt-outs as STOP', async () => {
    const result = await analyzeLeadIntent('STOP');
    expect(result.intent).toBe('STOP');
    expect(result.sentiment).toBe('DISENGAGING');
  });
});
