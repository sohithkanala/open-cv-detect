export interface OpenCVLocateFileFn {
  (path: string, scriptDirectory: string): void;
}

export interface OpenCvRuntimeInitializedFn {
  (): void;
}

export interface OpenCVOptions {
  scriptUrl: string;
  wasmBinaryFile?: string;
  usingWasm?: boolean;
  locateFile?: OpenCVLocateFileFn;
  onRuntimeInitialized?: OpenCvRuntimeInitializedFn;
}

export interface OpenCVLoadResult {
  ready: boolean;
  error: boolean;
  loading: boolean;
}
