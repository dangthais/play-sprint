import { describe, expect, it } from 'vitest';
import { MAX_SCORE, parseGameMessage } from './protocol';

describe('parseGameMessage', () => {
  it('chấp nhận ready', () => {
    expect(parseGameMessage({ qp: 1, type: 'ready' })).toEqual({ qp: 1, type: 'ready' });
  });

  it('chấp nhận score và gameOver hợp lệ', () => {
    expect(parseGameMessage({ qp: 1, type: 'score', score: 0 })).toEqual({
      qp: 1,
      type: 'score',
      score: 0,
    });
    expect(parseGameMessage({ qp: 1, type: 'gameOver', score: MAX_SCORE })).toEqual({
      qp: 1,
      type: 'gameOver',
      score: MAX_SCORE,
    });
  });

  it('chấp nhận object prototype null', () => {
    const o = Object.assign(Object.create(null) as object, { qp: 1, type: 'ready' });
    expect(parseGameMessage(o)).toEqual({ qp: 1, type: 'ready' });
  });

  it.each([-1, 1.5, '5', NaN, Infinity, -Infinity, 1e12, MAX_SCORE + 1, null, undefined, {}, true])(
    'từ chối score không hợp lệ: %s',
    (score) => {
      expect(parseGameMessage({ qp: 1, type: 'score', score })).toBeNull();
      expect(parseGameMessage({ qp: 1, type: 'gameOver', score })).toBeNull();
    },
  );

  it('từ chối qp sai', () => {
    expect(parseGameMessage({ qp: 2, type: 'ready' })).toBeNull();
    expect(parseGameMessage({ qp: '1', type: 'ready' })).toBeNull();
    expect(parseGameMessage({ type: 'ready' })).toBeNull();
  });

  it('từ chối type lạ', () => {
    expect(parseGameMessage({ qp: 1, type: 'start' })).toBeNull();
    expect(parseGameMessage({ qp: 1, type: 'READY' })).toBeNull();
    expect(parseGameMessage({ qp: 1, type: 5 })).toBeNull();
    expect(parseGameMessage({ qp: 1 })).toBeNull();
  });

  it('từ chối key thừa hoặc thiếu', () => {
    expect(parseGameMessage({ qp: 1, type: 'ready', score: 1 })).toBeNull();
    expect(parseGameMessage({ qp: 1, type: 'ready', extra: 1 })).toBeNull();
    expect(parseGameMessage({ qp: 1, type: 'score' })).toBeNull();
    expect(parseGameMessage({ qp: 1, type: 'gameOver', score: 1, extra: 1 })).toBeNull();
  });

  it('từ chối giá trị không phải plain object', () => {
    expect(parseGameMessage(null)).toBeNull();
    expect(parseGameMessage(undefined)).toBeNull();
    expect(parseGameMessage('ready')).toBeNull();
    expect(parseGameMessage(1)).toBeNull();
    expect(parseGameMessage([{ qp: 1, type: 'ready' }])).toBeNull();
    expect(parseGameMessage(new Date())).toBeNull();
    class Fake {
      qp = 1;
      type = 'ready';
    }
    expect(parseGameMessage(new Fake())).toBeNull();
  });
});
