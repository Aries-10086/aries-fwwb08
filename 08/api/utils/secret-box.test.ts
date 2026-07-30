import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decryptSecret, encryptSecret, maskSecret } from './secret-box.js'

describe('secret-box', () => {
  it('encrypts and decrypts round-trip', () => {
    process.env.AUTH_SECRET = 'test-auth-secret-16'
    const plain = 'sk-test-api-key-value'
    const packed = encryptSecret(plain)
    assert.notEqual(packed, plain)
    assert.match(packed, /^v1:/)
    assert.equal(decryptSecret(packed), plain)
  })

  it('masks secrets without leaking middle chars', () => {
    assert.equal(maskSecret('short'), '••••••••')
    assert.equal(maskSecret('sk-abcdefghijklmnop'), 'sk-••••mnop')
  })
})
