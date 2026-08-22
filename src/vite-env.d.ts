/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORLD_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
