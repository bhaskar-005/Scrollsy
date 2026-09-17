import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toMicros, yearlySaving, type Offer } from '../src/lib/offers.ts';

/**
 * The yearly badge. Run with `npm run test:sync`.
 *
 * The prices below are the real ones planned for launch. The point of these
 * checks is that one written badge cannot be right in both countries.
 */

const offer = (plan: Offer['plan'], amount: number, price: string): Offer => ({
  plan,
  price,
  amountMicros: toMicros(amount),
  entry: null,
});

test('India, ₹49 a month against ₹499 a year, saves fifteen percent', () => {
  const saving = yearlySaving([offer('monthly', 49, '₹49'), offer('yearly', 499, '₹499')]);
  assert.equal(saving, 15);
});

test('the United States, $5 a month against $10 a year, saves eighty three percent', () => {
  const saving = yearlySaving([offer('monthly', 5, '$5.00'), offer('yearly', 10, '$10.00')]);
  assert.equal(saving, 83);
});

test('a store price with a fraction does not wobble the percentage', () => {
  /** 4.99 in floating point is not quite 4.99. Rounding to micros keeps the sum exact. */
  assert.equal(toMicros(4.99), 4_990_000);
  assert.equal(
    yearlySaving([offer('monthly', 4.99, '$4.99'), offer('yearly', 29.99, '$29.99')]),
    50,
  );
});

test('no badge when the year is barely cheaper, or dearer', () => {
  assert.equal(yearlySaving([offer('monthly', 49, '₹49'), offer('yearly', 570, '₹570')]), null);
  assert.equal(yearlySaving([offer('monthly', 49, '₹49'), offer('yearly', 700, '₹700')]), null);
});

test('no badge before the store has answered, or when a plan is missing', () => {
  assert.equal(yearlySaving([]), null);
  assert.equal(yearlySaving([offer('yearly', 499, '₹499')]), null);
  assert.equal(yearlySaving([offer('monthly', 49, '₹49')]), null);
});
