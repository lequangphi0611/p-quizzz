// Types shared between server and web. Keep this folder free of Node- or DOM-specific imports.
export interface HealthResponse {
  status: 'ok';
  version: string;
}
