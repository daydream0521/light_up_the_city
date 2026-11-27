import { describe, expect, it, vi } from 'vitest';
import { validatePublication } from '../src/game/publication';
import { newPuzzle } from '../src/game/workshop';
import { postPublication } from '../src/server/publications';

function candidate() {
  const puzzle = newPuzzle();
  puzzle.pieces.push({ kind: 'single', at: [3, 2], state: 0, locked: false });
  return {
    puzzle, author: '夜班布光师', parentId: 'original-1',
    solution: { final: { sourceDirection: 0, pieceStates: [1], placements: [] }, moves: [{ at: [3, 2], tool: null }] },
  };
}

const request = (value: unknown) => new Request('https://example.com/api/puzzles', {
  method: 'POST', body: JSON.stringify(value),
});
const insert = () => vi.fn(async (data) => ({ ...data, id: 'server-generated', createdAt: '2026-11-26T00:00:00Z' }));

describe('publication eligibility', () => {
  it('accepts a first legal win after metadata edits and only stores public fields', async () => {
    const data = candidate();
    data.puzzle.name = '新的名字';
    data.puzzle.city = 2;
    data.puzzle.district = 1;
    const store = insert();
    const response = await postPublication(request({ ...data, verified: false, creatorMoves: 0 }), store);
    expect(response.status).toBe(201);
    expect(store).toHaveBeenCalledWith({
      puzzle: data.puzzle, author: data.author, parentId: data.parentId, creatorMoves: 1,
    });
    expect(await response.json()).not.toHaveProperty('solution');
  });

  it('preserves valid theme fields and rejects unknown cities and regions before publication', async () => {
    const data = candidate();
    const store = insert();
    const { city, ...legacy } = data.puzzle;
    expect(city).toBe(0);
    expect((await postPublication(request({ ...data, puzzle: legacy }), store)).status).toBe(201);
    expect(store.mock.calls[0][0].puzzle.city).toBeUndefined();

    for (const puzzle of [{ ...data.puzzle, city: 3 }, { ...data.puzzle, district: 4 }]) {
      expect((await postPublication(request({ ...data, puzzle }), store)).status).toBe(422);
    }
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('rejects legacy verified flags, an initial win, locked changes and stale proofs', async () => {
    const store = insert();
    const clean = candidate();
    const locked = candidate();
    locked.puzzle.pieces[0].locked = true;
    const alreadyWon = candidate();
    alreadyWon.puzzle.pieces[0].state = 1;
    const changed = candidate();
    changed.puzzle.source = [0, 4];
    for (const data of [{ ...clean, verified: true, solution: undefined }, locked, alreadyWon, changed]) {
      expect((await postPublication(request(data), store)).status).toBe(422);
    }
    expect(store).not.toHaveBeenCalled();
  });

  it('rejects a forged final state, illegal positions and play after a winning move', () => {
    const clean = candidate();
    expect(validatePublication({ ...clean, solution: {
      ...clean.solution, final: { ...clean.solution.final, sourceDirection: 2 },
    } })).toBeNull();
    expect(validatePublication({ ...clean, solution: {
      ...clean.solution, moves: [{ at: [-1, 2], tool: 'single' }],
    } })).toBeNull();
    expect(validatePublication({ ...clean, solution: {
      ...clean.solution, moves: [...clean.solution.moves, ...clean.solution.moves],
    } })).toBeNull();
  });

  it('replays legal placement and rejects extra or overlapping placements', () => {
    const data = candidate();
    data.puzzle.pieces.length = 0;
    data.puzzle.inventory.single = 1;
    expect(validatePublication({ ...data, solution: {
      final: { sourceDirection: 0, pieceStates: [], placements: [{ at: [3, 2], kind: 'single', state: 1 }] },
      moves: [{ at: [3, 2], tool: 'single' }, { at: [3, 2], tool: null }],
    } })?.creatorMoves).toBe(2);
    expect(validatePublication({ ...data, solution: {
      ...data.solution, moves: [{ at: [0, 2], tool: 'single' }, { at: [3, 2], tool: null }],
    } })).toBeNull();
  });

  it('returns a bounded error before inserting oversized input and handles store failures', async () => {
    const store = insert();
    expect((await postPublication(request('x'.repeat(128 * 1024)), store)).status).toBe(413);
    expect(store).not.toHaveBeenCalled();
    store.mockRejectedValueOnce(new Error('database offline'));
    expect((await postPublication(request(candidate()), store)).status).toBe(503);
  });
});
