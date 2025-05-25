import { create } from 'zustand';

export interface MyFileData {
  id: number;
  name: string;
  originalName: string;
  type: string;
  size: number;
  tags: string[];
  uploadDate: string;
  description?: string;
  aiAnalysis?: string;
  contentHash?: string;
  duplicateGroup?: string;
  storageType?: string;
  userId?: number;
}

interface FileStore {
  files: MyFileData[];
  loading: boolean;
  error: string | null;
  fetchFiles: () => Promise<void>;
  uploadFiles: (files: MyFileData[]) => Promise<void>;
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  loading: false,
  error: null,

  fetchFiles: async () => {
    set({ loading: true });
    try {
      const response = await fetch('/files', { credentials: 'include' });
      const data = await response.json();
      set({ files: data.data, error: null });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  uploadFiles: async (files) => {
    set({ files });
  },
}));
