export interface ValidationReport {
  issues: {
    numErrors: number;
    numWarnings: number;
    messages: { code: string; message: string; severity: number }[];
  };
}
export function validate(
  entry: string,
  files: Map<string, ArrayBuffer>,
): Promise<ValidationReport> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./validator.worker.ts', import.meta.url),
      { type: 'module' },
    );
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error('Validation timed out. Try a smaller model.'));
    }, 30000);
    worker.onmessage = ({ data }) => {
      finish();
      if (data.ok) resolve(data.report);
      else reject(new Error(data.error));
    };
    worker.onerror = () => {
      finish();
      reject(new Error('Validation worker failed. Please retry.'));
    };
    worker.postMessage({ entry, files: [...files] });
  });
}
