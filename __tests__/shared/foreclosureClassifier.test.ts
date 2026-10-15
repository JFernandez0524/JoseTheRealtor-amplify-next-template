import { describe, it, expect } from 'vitest';
import {
  classifyForeclosure,
  type ForeclosureClassificationInput,
} from '../../amplify/functions/shared/foreclosureClassifier';

describe('classifyForeclosure', () => {
  it('detects explicit tax foreclosures from case number keyword Tax_Fore', () => {
    const input: ForeclosureClassificationInput = {
      caseNumber: 'F-10640-26 Tax_Fore',
      loanAmount: '$497.00',
      plaintiff: 'KHH Invest NJ LLC',
    };
    const res = classifyForeclosure(input);
    expect(res.category).toBe('TAX_FORECLOSURE');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.requiresManualReview).toBe(false);
  });

  it('detects tax foreclosure from known private tax lien buyer plaintiff', () => {
    const input: ForeclosureClassificationInput = {
      caseNumber: 'F-10652-26',
      loanAmount: '$4,049.00',
      plaintiff: 'LB Honey Badger SBMUNI',
    };
    const res = classifyForeclosure(input);
    expect(res.category).toBe('TAX_FORECLOSURE');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects HOA / Condominium lien foreclosure as OTHER_FORECLOSURE', () => {
    const input1: ForeclosureClassificationInput = {
      caseNumber: 'F-10659-26',
      plaintiff: 'Beachway Townhouse Condo Asso',
      loanAmount: '$8,500.00',
    };
    const res1 = classifyForeclosure(input1);
    expect(res1.category).toBe('OTHER_FORECLOSURE');
    expect(res1.confidence).toBeGreaterThanOrEqual(0.9);

    const input2: ForeclosureClassificationInput = {
      caseNumber: 'F-10660-26',
      plaintiff: 'Brittany Chase Condo Asso',
      loanAmount: '$5,200.00',
    };
    const res2 = classifyForeclosure(input2);
    expect(res2.category).toBe('OTHER_FORECLOSURE');
  });

  it('detects institutional mortgage lenders as MORTGAGE_FORECLOSURE', () => {
    const input1: ForeclosureClassificationInput = {
      caseNumber: 'F-10642-26',
      loanAmount: '$156,610.00',
      plaintiff: 'Midfirst Bank',
    };
    const res1 = classifyForeclosure(input1);
    expect(res1.category).toBe('MORTGAGE_FORECLOSURE');
    expect(res1.confidence).toBeGreaterThanOrEqual(0.9);

    const input2: ForeclosureClassificationInput = {
      caseNumber: 'F-10646-26',
      loanAmount: '$366,198.00',
      plaintiff: 'Lakeview Loan Servicing',
    };
    const res2 = classifyForeclosure(input2);
    expect(res2.category).toBe('MORTGAGE_FORECLOSURE');

    const input3: ForeclosureClassificationInput = {
      caseNumber: 'F-10650-26',
      loanAmount: '$286,324.00',
      plaintiff: 'Rocket Mortgage',
    };
    const res3 = classifyForeclosure(input3);
    expect(res3.category).toBe('MORTGAGE_FORECLOSURE');
  });

  it('flags ambiguous municipality plaintiffs without explicit tax keywords for review', () => {
    // If a municipality is plaintiff with a large / non-tax amount and no keywords
    const input: ForeclosureClassificationInput = {
      caseNumber: 'F-10999-26',
      plaintiff: 'City of Newark',
      loanAmount: '$150,000.00',
    };
    const res = classifyForeclosure(input);
    expect(res.category).toBe('UNKNOWN');
    expect(res.requiresManualReview).toBe(true);
  });

  it('classifies municipality with small lien debt as TAX_FORECLOSURE', () => {
    const input: ForeclosureClassificationInput = {
      caseNumber: 'F-10998-26',
      plaintiff: 'Township of Woodbridge',
      loanAmount: '$3,200.00',
    };
    const res = classifyForeclosure(input);
    expect(res.category).toBe('TAX_FORECLOSURE');
  });

  it('classifies standard chancery docket with residential loan amount as MORTGAGE_FORECLOSURE', () => {
    const input: ForeclosureClassificationInput = {
      caseNumber: 'F-10643-26',
      loanAmount: 161912,
      plaintiff: 'Private Investor Trust',
    };
    const res = classifyForeclosure(input);
    expect(res.category).toBe('MORTGAGE_FORECLOSURE');
  });

  it('falls back to UNKNOWN when evidence is empty or indeterminate', () => {
    const input: ForeclosureClassificationInput = {};
    const res = classifyForeclosure(input);
    expect(res.category).toBe('UNKNOWN');
    expect(res.requiresManualReview).toBe(true);
  });
});
