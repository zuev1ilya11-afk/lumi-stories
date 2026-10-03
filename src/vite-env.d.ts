/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LUMI_API_URL?: string;
  readonly VITE_LUMI_DEV_INIT_DATA?: string;
  readonly VITE_LUMI_DEV_DISPLAY_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
