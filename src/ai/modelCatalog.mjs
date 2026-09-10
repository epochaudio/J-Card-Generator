// One explicit model owns both text generation and image understanding.
export const DEEPSEEK_CURRENT_MODEL = 'deepseek-flash';

export function supportsVision(provider, id) {
  return provider === 'deepseek' && id === DEEPSEEK_CURRENT_MODEL;
}
