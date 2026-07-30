import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessContent, getAccessibleContentIds } from './content-access.js'

type FakeResult = {
  rows: Record<string, unknown>[]
  rowCount: number
}

function runner(result: FakeResult, calls: Array<{ text: string; values?: unknown[] }>) {
  return {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values })
      return result
    },
  }
}

test('管理员可见内容列表直接来自全部内容', async () => {
  const calls: Array<{ text: string; values?: unknown[] }> = []
  const ids = await getAccessibleContentIds(
    { userId: 'admin-1', role: 'admin' },
    runner({ rows: [{ id: 'c1' }, { id: 'c2' }], rowCount: 2 }, calls),
  )

  assert.deepEqual([...ids], ['c1', 'c2'])
  assert.match(calls[0].text, /SELECT id FROM contents/)
  assert.equal(calls[0].values, undefined)
})

test('普通用户内容权限查询始终绑定当前用户', async () => {
  const calls: Array<{ text: string; values?: unknown[] }> = []
  const ids = await getAccessibleContentIds(
    { userId: 'member-1', role: 'member' },
    runner({ rows: [{ id: 'public-1' }, { id: 'task-1' }], rowCount: 2 }, calls),
  )

  assert.deepEqual([...ids], ['public-1', 'task-1'])
  assert.deepEqual(calls[0].values, ['member-1'])
  assert.match(calls[0].text, /c\.is_public = true OR u\.id IS NOT NULL/)
})

test('单内容权限检查同时绑定用户和内容编号', async () => {
  const calls: Array<{ text: string; values?: unknown[] }> = []
  const allowed = await canAccessContent(
    { userId: 'member-1', role: 'member' },
    'content-1',
    runner({ rows: [{ '?column?': 1 }], rowCount: 1 }, calls),
  )

  assert.equal(allowed, true)
  assert.deepEqual(calls[0].values, ['member-1', 'content-1'])
})

