import { defineGateway } from '../define.js'

export default defineGateway({
  id: 'runcrate',
  label: 'Runcrate',
  category: 'aggregating',
  defaultBaseUrl: 'https://api.runcrate.ai/v1',
  defaultModel: 'deepseek-ai/DeepSeek-V4.1-Flash',
  supportsModelRouting: true,
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['RUNCRATE_API_KEY'],
    dedicatedCredentialsOnly: true,
  },
  transportConfig: {
    kind: 'openai-compatible',
    openaiShim: {
      supportsApiFormatSelection: false,
      supportsAuthHeaders: true,
      maxTokensField: 'max_completion_tokens',
      requiredApiFormat: 'chat_completions',
    },
  },
  preset: {
    id: 'runcrate',
    description: 'Runcrate gateway',
    vendorId: 'openai',
    apiKeyEnvVars: ['RUNCRATE_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'runcrate-deepseek-v4.1-flash', apiName: 'deepseek-ai/DeepSeek-V4.1-Flash', label: 'DeepSeek V4.1 Flash' },
      { id: 'runcrate-glm-5.3', apiName: 'zai-org/GLM-5.3', label: 'GLM 5.3', modelDescriptorId: 'glm-5.3' },
      { id: 'runcrate-glm-5.3-flash', apiName: 'zai-org/GLM-5.3-Flash', label: 'GLM 5.3 Flash', modelDescriptorId: 'glm-5.3-flash' },
      { id: 'runcrate-qwen3.8-flash', apiName: 'Qwen/Qwen3.8-Flash', label: 'Qwen 3.8 Flash' },
      { id: 'runcrate-gpt-oss-120b', apiName: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
    ],
  },
  usage: { supported: false },
})