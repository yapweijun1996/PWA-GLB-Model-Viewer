/// <reference types="vite-plugin-pwa/client" />
declare module 'gltf-validator' {
  export function validateBytes(
    data: Uint8Array,
    options: Record<string, unknown>,
  ): Promise<any>;
}
