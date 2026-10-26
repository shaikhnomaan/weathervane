import { Place } from '../models/weather.models';
import { MAX_SAVED, addPlace, parseSaved, placeKey, removePlace, samePlace } from './saved-places';

const pune: Place = { name: 'Pune', latitude: 18.52, longitude: 73.86, region: 'Maharashtra', country: 'India' };
const jalgaon: Place = { name: 'Jalgaon', latitude: 21.01, longitude: 75.56 };

describe('saved-places', () => {
  it('treats nearby coordinates as the same place', () => {
    expect(samePlace(pune, { latitude: 18.525, longitude: 73.865 })).toBe(true);
    expect(samePlace(pune, jalgaon)).toBe(false);
  });

  it('does not add duplicates and keeps order', () => {
    const list = addPlace(addPlace([], pune), jalgaon);
    expect(addPlace(list, { ...pune, latitude: 18.521 })).toHaveLength(2);
    expect(list.map((p) => p.name)).toEqual(['Pune', 'Jalgaon']);
  });

  it('stops at the maximum', () => {
    let list: Place[] = [];
    for (let i = 0; i < MAX_SAVED + 3; i++) list = addPlace(list, { name: `C${i}`, latitude: i * 2, longitude: i * 2 });
    expect(list).toHaveLength(MAX_SAVED);
  });

  it('removes a place', () => {
    expect(removePlace([pune, jalgaon], pune).map((p) => p.name)).toEqual(['Jalgaon']);
  });

  it('builds a stable key', () => {
    expect(placeKey(jalgaon)).toBe('21.01,75.56');
  });

  it('ignores corrupted storage values', () => {
    expect(parseSaved('nope')).toEqual([]);
    expect(parseSaved([{ name: 5 }, null, { name: 'X', latitude: 'a', longitude: 1 }])).toEqual([]);
    expect(parseSaved([pune, { bad: true }]).map((p) => p.name)).toEqual(['Pune']);
  });
});
