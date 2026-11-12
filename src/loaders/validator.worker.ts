import { validateBytes } from 'gltf-validator';
import { readDocument, inspectDocument } from './validation';
import { resolvePath } from './DependencyResolver';
self.onmessage = async ({
  data,
}: MessageEvent<{ entry: string; files: [string, ArrayBuffer][] }>) => {
  try {
    const files = new Map(data.files),
      bytes = files.get(data.entry)!;
    const doc = readDocument(bytes, /\.glb$/i.test(data.entry));
    inspectDocument(doc, data.entry, files);
    const report = await validateBytes(new Uint8Array(bytes), {
      uri: data.entry,
      maxIssues: 100,
      externalResourceFunction: async (uri: string) => {
        const resource = files.get(resolvePath(data.entry, uri));
        if (!resource) throw new Error('Missing local dependency.');
        return new Uint8Array(resource);
      },
    });
    if (report.issues.numErrors)
      throw new Error(
        `Model validation failed: ${report.issues.messages.find((m: any) => m.severity === 0)?.message ?? 'Invalid glTF.'}`,
      );
    self.postMessage({ ok: true, report });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Validation failed.',
    });
  }
};
