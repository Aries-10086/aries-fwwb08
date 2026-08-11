import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextReviewProgress } from './wrong-book.js'

describe('nextReviewProgress', () => {
  it('待复习答对一次 → 已掌握', () => {
    const next = nextReviewProgress(0, true)
    assert.equal(next.reviewCorrectCount, 1)
    assert.equal(next.reviewStatus, 'mastered')
    assert.equal(next.removed, false)
  })

  it('已掌握再答对一次 → 移出错题本', () => {
    const next = nextReviewProgress(1, true)
    assert.equal(next.reviewCorrectCount, 2)
    assert.equal(next.removed, true)
  })

  it('已掌握第二次答错 → 回到待复习', () => {
    const next = nextReviewProgress(1, false)
    assert.equal(next.reviewCorrectCount, 0)
    assert.equal(next.reviewStatus, 'pending')
    assert.equal(next.removed, false)
  })

  it('待复习答错 → 仍为待复习', () => {
    const next = nextReviewProgress(0, false)
    assert.equal(next.reviewCorrectCount, 0)
    assert.equal(next.reviewStatus, 'pending')
    assert.equal(next.removed, false)
  })

  it('已移出（count=2）不再变更', () => {
    const next = nextReviewProgress(2, true)
    assert.equal(next.reviewCorrectCount, 2)
    assert.equal(next.removed, true)
  })
})
