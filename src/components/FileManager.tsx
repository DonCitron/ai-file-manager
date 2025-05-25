import { useState, useEffect } from 'react';
import type { MyFileData } from '../services/fileStore';
import { Sparkles, File, X, Eye, Download, LogOut, Calendar as CalendarIcon } from 'lucide-react';
import { useFileStore } from '../services/fileStore';
import { FilePreview } from './FilePreview';

interface FileManagerProps {
  user: { id: number; username: string; role: string };
  onLogout: () => void;
}

const FileManager: React.FC<FileManagerProps> = ({ user, onLogout }) => {
  const { files, fetchFiles } = useFileStore();
  const [customFolders] = useState<string[]>([]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const getAIFolders = () => {
    const folders = [
      {
        name: 'Bilder',
        files: files.filter((f: MyFileData) => f.type.startsWith('image/')),
        icon: '🖼️',
        count: files.filter((f: MyFileData) => f.type.startsWith('image/')).length
      },
      {
        name: 'Dokumente',
        files: files.filter((f: MyFileData) => f.type.includes('pdf') || f.type.includes('document') || f.type.includes('text')),
        icon: '📄',
        count: files.filter((f: MyFileData) => f.type.includes('pdf') || f.type.includes('document') || f.type.includes('text')).length
      },
      {
        name: 'Videos',
        files: files.filter((f: MyFileData) => f.type.startsWith('video/')),
        icon: '🎥',
        count: files.filter((f: MyFileData) => f.type.startsWith('video/')).length
      },
      {
        name: 'Audio',
        files: files.filter((f: MyFileData) => f.type.startsWith('audio/')),
        icon: '🎵',
        count: files.filter((f: MyFileData) => f.type.startsWith('audio/')).length
      },
      {
        name: 'Andere',
        files: files.filter((f: MyFileData) => !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('audio/') && !f.type.includes('pdf') && !f.type.includes('document') && !f.type.includes('text')),
        icon: '📦',
        count: files.filter((f: MyFileData) => !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.includes('pdf') && !f.type.includes('document') && !f.type.includes('text')).length
      }
    ];
    return folders.filter(folder => folder.count > 0);
  };

  const getFilesInCustomFolder = (folderName: string) => {
    return files.filter(file => (file as any).customFolder === folderName);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-4 flex-shrink-0 flex flex-col">
        <div className="flex items-center mb-8">
          <Sparkles className="h-8 w-8 text-blue-400 mr-2" />
          <span className="text-xl font-bold">Pasi AI File Manager</span>
        </div>
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <CalendarIcon className="h-4 w-4 mr-2" />
            <span>Kalender</span>
          </div>
          <div className="text-sm">Willkommen, {user.username}</div>
        </div>
        <button onClick={onLogout} className="flex items-center text-red-400 hover:text-red-200 mb-6">
          <LogOut className="h-4 w-4 mr-2" /> Abmelden
        </button>
        <div className="mb-4">
          <div className="font-semibold mb-2">🤖 AI-Ordner</div>
          <div className="flex items-center justify-between p-2 bg-gray-800 rounded mb-2">
            <span className="flex items-center">
              <span className="mr-2">📁</span> Alle Dateien
            </span>
            <span>{files.length}</span>
          </div>
          {getAIFolders().map((folder, idx) => (
            <div key={folder.name + idx} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded cursor-pointer">
              <span className="flex items-center">
                <span className="mr-2">{folder.icon}</span> {folder.name}
              </span>
              <span>{folder.count}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-semibold mb-2">📂 Meine Ordner</div>
          {/* No folder creation UI since state is removed */}
          {customFolders.map((folderName, idx) => (
            <div key={folderName + idx} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded cursor-pointer">
              <span className="flex items-center">
                <span className="mr-2">📁</span> {folderName}
              </span>
              <span>{getFilesInCustomFolder(folderName).length}</span>
            </div>
          ))}
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-2xl font-bold">Dateien</div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Alle Dateien</span>
            <span className="text-gray-500">({files.length} Elemente)</span>
            <span className="cursor-pointer">⊞</span>
            <span className="cursor-pointer">☰</span>
          </div>
        </div>
        {/* File List */}
        <div className="bg-white rounded shadow p-4">
          <div style={{ height: 600, width: '100%' }}>
            {files.map((file) => (
              <div key={file.id} className="flex items-center border-b border-gray-200 py-2">
                <FilePreview file={file} />
                <Eye className="text-blue-400 hover:text-blue-300 transition-colors ml-4 cursor-pointer" key={'eye-' + file.id} />
                <File
                  className="text-yellow-400 hover:text-yellow-300 transition-colors cursor-pointer ml-2"
                  key={'move-' + file.id}
                  onClick={() => {
                    /* setFileToMove(file); */
                  }}
                />
                <X className="text-red-400 hover:text-red-300 transition-colors cursor-pointer ml-2" key={'delete-' + file.id} />
                <Download className="text-gray-400 hover:text-white transition-colors cursor-pointer ml-2" key={'download-' + file.id} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FileManager;