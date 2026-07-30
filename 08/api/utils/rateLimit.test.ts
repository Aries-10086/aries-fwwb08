import assert from 'node:assert/strict'
import test from 'node:test'
import { hitRateLimit } from './rateLimit.js'

test('按用户键隔离并在达到上限后拒绝请求', () => {
  const suffix = `${Date.now()}-${Math.random()}`
  const firstUser = `ai:user-a:${suffix}`
  const secondUser = `ai:user-b:${suffix}`

  assert.equal(hitRateLimit(firstUser, 2, 60_000).ok, true)
  assert.equal(hitRateLimit(firstUser, 2, 60_000).ok, true)
  const blocked = hitRateLimit(firstUser, 2, 60_000)
  assert.equal(blocked.ok, false)
  assert.ok(blocked.retryAfterSec > 0)
  assert.equal(hitRateLimit(secondUser, 2, 60_000).ok, true)
})

test('窗口过期后重新允许请求', () => {
  const key = `ai:expired:${Date.now()}-${Math.random()}`
  assert.equal(hitRateLimit(key, 1, 1).ok, true)
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(hitRateLimit(key, 1, 1).ok, true)
      resolve()
    }, 5)
  })
})
