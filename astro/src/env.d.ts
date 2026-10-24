/// <reference types="astro/client" />

declare module '*.html?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  /** Clés facultatives pour /api/ai : sinon le client les envoie en en-tête. */
  readonly OPENAI_API_KEY?: string;
  readonly ANTHROPIC_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
  readonly XAI_API_KEY?: string;
  readonly MISTRAL_API_KEY?: string;
  readonly COHERE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
