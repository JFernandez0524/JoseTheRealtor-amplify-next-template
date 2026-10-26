import { describe, it, expect } from 'vitest';
import {
  classifyOwnership,
  cleanCourtScrapedName,
  formatPersonalName,
  parseOwnershipName,
  type OwnershipClassification,
} from '../../amplify/functions/shared/ownershipClassifier';

describe('formatPersonalName', () => {
  it('formats personal names and preserves recognized suffixes', () => {
    expect(formatPersonalName('john smith')).toBe('John Smith');
    expect(formatPersonalName('JOHN ROBERT SMITH JR')).toBe('John Robert Smith JR');
    expect(formatPersonalName('jane doe iii')).toBe('Jane Doe III');
    expect(formatPersonalName('DR. ALICE JOHNSON ESQ.')).toBe('Dr. Alice Johnson ESQ');
  });
});

describe('classifyOwnership', () => {
  it('classifies single individuals accurately', () => {
    const res1 = classifyOwnership('Christopher Thompson');
    expect(res1.category).toBe('INDIVIDUAL');
    expect(res1.suggestedFirstName).toBe('Christopher');
    expect(res1.suggestedLastName).toBe('Thompson');
    expect(res1.confidence).toBeGreaterThanOrEqual(0.9);

    const res2 = classifyOwnership('Jon Gibson');
    expect(res2.category).toBe('INDIVIDUAL');
    expect(res2.suggestedFirstName).toBe('Jon');
    expect(res2.suggestedLastName).toBe('Gibson');

    const res3 = classifyOwnership('GIBSON, JON');
    expect(res3.category).toBe('INDIVIDUAL');
    expect(res3.suggestedFirstName).toBe('Jon');
    expect(res3.suggestedLastName).toBe('Gibson');
  });

  it('correctly handles token collision edge cases (Ryan Banks, Lincoln Williams, Stephen Tolpa)', () => {
    // Ryan Banks has surname Banks — must NOT be classified as Institutional/Bank!
    const banks = classifyOwnership('Ryan Banks');
    expect(banks.category).toBe('INDIVIDUAL');
    expect(banks.suggestedFirstName).toBe('Ryan');
    expect(banks.suggestedLastName).toBe('Banks');

    // Lincoln Williams has "inc" inside Lincoln — must NOT be classified as Corporation!
    const lincoln = classifyOwnership('Lincoln Williams');
    expect(lincoln.category).toBe('INDIVIDUAL');
    expect(lincoln.suggestedFirstName).toBe('Lincoln');
    expect(lincoln.suggestedLastName).toBe('Williams');

    // Stephen Tolpa has "lp" inside Tolpa — must NOT be classified as LP/LLC!
    const tolpa = classifyOwnership('Stephen Tolpa');
    expect(tolpa.category).toBe('INDIVIDUAL');
    expect(tolpa.suggestedFirstName).toBe('Stephen');
    expect(tolpa.suggestedLastName).toBe('Tolpa');
  });

  it('classifies multiple individuals joined by &, AND, or deed notation', () => {
    const res1 = classifyOwnership('John & Mary Smith');
    expect(res1.category).toBe('MULTIPLE_INDIVIDUALS');
    expect(res1.suggestedFirstName).toBe('John & Mary');
    expect(res1.suggestedLastName).toBe('Smith');

    const res2 = classifyOwnership('Smith, John & Mary');
    expect(res2.category).toBe('MULTIPLE_INDIVIDUALS');
    expect(res2.suggestedLastName).toBe('Smith');

    const res3 = classifyOwnership('John Smith and Jane Doe');
    expect(res3.category).toBe('MULTIPLE_INDIVIDUALS');

    const res4 = classifyOwnership('Robert Davis ET UX');
    expect(res4.category).toBe('MULTIPLE_INDIVIDUALS');
  });

  it('classifies estates and deceased individuals', () => {
    const res1 = classifyOwnership('Estate of John Smith');
    expect(res1.category).toBe('ESTATE');
    expect(res1.confidence).toBeGreaterThanOrEqual(0.9);

    const res2 = classifyOwnership('John Smith (DECEASED)');
    expect(res2.category).toBe('ESTATE');

    const res3 = classifyOwnership('Mary Jenkins, Executrix');
    expect(res3.category).toBe('ESTATE');

    const res4 = classifyOwnership('Heirs of Arthur Pendelton');
    expect(res4.category).toBe('ESTATE');
  });

  it('classifies trusts and trustees', () => {
    const res1 = classifyOwnership('John Smith Revocable Living Trust');
    expect(res1.category).toBe('TRUST');
    expect(res1.confidence).toBeGreaterThanOrEqual(0.9);

    const res2 = classifyOwnership('The Miller Family Trust');
    expect(res2.category).toBe('TRUST');

    const res3 = classifyOwnership('David Clark, Trustee');
    expect(res3.category).toBe('TRUST');
  });

  it('classifies LLCs', () => {
    const res1 = classifyOwnership('Cityside I & II LLC');
    expect(res1.category).toBe('LLC');

    const res2 = classifyOwnership('Baldwin Holdings LLC');
    expect(res2.category).toBe('LLC');

    const res3 = classifyOwnership('Apex Property Solutions L.L.C.');
    expect(res3.category).toBe('LLC');
  });

  it('classifies Corporations', () => {
    const res1 = classifyOwnership('Carpenters Development Rehab Inc');
    expect(res1.category).toBe('CORPORATION');

    const res2 = classifyOwnership('4490 Food Corp');
    expect(res2.category).toBe('CORPORATION');

    const res3 = classifyOwnership('Colosseo Atlantic City Inc');
    expect(res3.category).toBe('CORPORATION');
  });

  it('classifies Institutional entities (Banks/Govt/Authorities as defendant)', () => {
    const res1 = classifyOwnership('Secretary of Housing and Urban Development');
    expect(res1.category).toBe('INSTITUTIONAL');

    const res2 = classifyOwnership('Fannie Mae');
    expect(res2.category).toBe('INSTITUTIONAL');

    const res3 = classifyOwnership('Housing Authority of the City of Camden');
    expect(res3.category).toBe('INSTITUTIONAL');

    const res4 = classifyOwnership('Wells Fargo Bank NA');
    expect(res4.category).toBe('INSTITUTIONAL');
  });

  it('classifies religious and non-profit organizations as OTHER_ENTITY', () => {
    const res1 = classifyOwnership('Prince of Peace Lutheran Church of Howell');
    expect(res1.category).toBe('OTHER_ENTITY');
  });

  it('classifies empty or invalid names as UNKNOWN with manual review flag', () => {
    const res1 = classifyOwnership('');
    expect(res1.category).toBe('UNKNOWN');
    expect(res1.requiresManualReview).toBe(true);

    const res2 = classifyOwnership(null);
    expect(res2.category).toBe('UNKNOWN');
    expect(res2.requiresManualReview).toBe(true);
  });

  it('cleans court scraped auction names with legal alias chains (A/k/a)', () => {
    const res = classifyOwnership('Christopher Jones A/k/a Christoph Jones A/k/a Christoph E. Jones; .');
    expect(res.category).toBe('INDIVIDUAL');
    expect(res.suggestedFirstName).toBe('Christopher');
    expect(res.suggestedLastName).toBe('Jones');
  });

  it('strips leading dots and bullets from scraped auction names', () => {
    const res1 = classifyOwnership('    . Michael George Locacio');
    expect(res1.category).toBe('INDIVIDUAL');
    expect(res1.suggestedFirstName).toBe('Michael George');
    expect(res1.suggestedLastName).toBe('Locacio');

    const res2 = classifyOwnership('. Jane Doe');
    expect(res2.category).toBe('INDIVIDUAL');
    expect(res2.suggestedFirstName).toBe('Jane');
    expect(res2.suggestedLastName).toBe('Doe');
  });

  it('cleans court ET AL and trailing semicolons/punctuation without leaving trailing commas', () => {
    const res1 = classifyOwnership('Allen Ariza, et al');
    expect(res1.category).toBe('MULTIPLE_INDIVIDUALS');
    expect(res1.suggestedFirstName).toBe('Allen');
    expect(res1.suggestedLastName).toBe('Ariza');

    const res2 = classifyOwnership('Smith, John; .');
    expect(res2.category).toBe('INDIVIDUAL');
    expect(res2.suggestedFirstName).toBe('John');
    expect(res2.suggestedLastName).toBe('Smith');
  });
});

describe('cleanCourtScrapedName', () => {
  it('strips leading dots, bullets, and symbols', () => {
    expect(cleanCourtScrapedName('    . Michael George Locacio')).toBe('Michael George Locacio');
    expect(cleanCourtScrapedName('. Jane Doe')).toBe('Jane Doe');
    expect(cleanCourtScrapedName('* Robert Smith')).toBe('Robert Smith');
  });

  it('strips legal alias chains (A/k/a, F/k/a, etc.)', () => {
    expect(
      cleanCourtScrapedName('Christopher Jones A/k/a Christoph Jones A/k/a Christoph E. Jones; .')
    ).toBe('Christopher Jones');
    expect(cleanCourtScrapedName('John Doe A/K/A Johnny Doe')).toBe('John Doe');
  });

  it('strips trailing punctuation and court noise', () => {
    expect(cleanCourtScrapedName('Allen Ariza, et al')).toBe('Allen Ariza');
    expect(cleanCourtScrapedName('Smith, John; .')).toBe('Smith, John');
  });
});

describe('parseOwnershipName', () => {
  it('parses noisy scraped names into first and last name', () => {
    expect(
      parseOwnershipName('Christopher Jones A/k/a Christoph Jones A/k/a Christoph E. Jones; .')
    ).toEqual({ firstName: 'Christopher', lastName: 'Jones' });

    expect(parseOwnershipName('    . Michael George Locacio')).toEqual({
      firstName: 'Michael George',
      lastName: 'Locacio',
    });

    expect(parseOwnershipName('Allen Ariza, et al')).toEqual({
      firstName: 'Allen',
      lastName: 'Ariza',
    });
  });
});
