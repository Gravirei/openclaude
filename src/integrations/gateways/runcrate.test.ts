import { describe, expect, test } from 'bun:test'

import runcrate from './runcrate.js'

describe('runcrate gateway', () => {
  test('uses static catalog with api-key auth', () => {
    expect(runcrate.id).toBe('runcrate')
    expect(runcrate.label).toBe('Runcrate')
    expect(runcrate.category).toBe('aggregating')
    expect(runcrate.catalog?.source).toBe('static')
    expect(runcrate.setup.requiresAuth).toBe(true)
    expect(runcrate.setup.authMode).toBe('api-key')
    expect(runcrate.setup.credentialEnvVars).toEqual(['RUNCRATE_API_KEY'])
    expect(runcrate.setup.dedicatedCredentialsOnly).toBe(true)
    expect(runcrate.defaultBaseUrl).toBe('https://api.runcrate.ai/v1')
    expect(runcrate.defaultModel).toBe('deepseek-ai/DeepSeek-V4.1-Flash')
    expect(runcrate.supportsModelRouting).toBe(true)
  })

  test('curated catalog exposes flagship open models', () => {
    const models = runcrate.catalog?.models ?? []
    expect(models.some(model => model.apiName === 'deepseek-ai/DeepSeek-V4.1-Flash')).toBe(true)
    expect(models.some(model => model.apiName === 'zai-org/GLM-5.3')).toBe(true)
    expect(models.some(model => model.apiName === 'zai-org/GLM-5.3-Flash')).toBe(true)
    expect(models.some(model => model.apiName === 'Qwen/Qwen3.8-Flash')).toBe(true)
    expect(models.some(model => model.apiName === 'openai/gpt-oss-120b')).toBe(true)
  })

  test('transport is openai-compatible with standard Bearer auth', () => {
    expect(runcrate.transportConfig.kind).toBe('openai-compatible')
    const shim = runcrate.transportConfig.openaiShim
    expect(shim).toBeDefined()
    expect(shim?.supportsAuthHeaders).toBe(true)
    expect(shim?.maxTokensField).toBe('max_completion_tokens')
    expect(shim?.requiredApiFormat).toBe('chat_completions')
  })

  test('preset is configured for provider flow', () => {
    expect(runcrate.preset?.id).toBe('runcrate')
    expect(runcrate.preset?.vendorId).toBe('openai')
    expect(runcrate.preset?.apiKeyEnvVars).toEqual(['RUNCRATE_API_KEY'])
  })

  test('usage is unsupported by default', () => {
    expect(runcrate.usage?.supported).toBe(false)
  })

  test('GLM catalog entries link to shared model descriptors', () => {
    const models = runcrate.catalog?.models ?? []
    const glm53 = models.find(m => m.id === 'runcrate-glm-5.3')
    const glm53Flash = models.find(m => m.id === 'runcrate-glm-5.3-flash')
    expect(glm53?.modelDescriptorId).toBe('glm-5.3')
    expect(glm53Flash?.modelDescriptorId).toBe('glm-5.3-flash')
  })
})