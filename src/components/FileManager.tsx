import React, { useState, useCallback } from 'react';
import { Upload, File, Folder, Download, Eye, X, Search } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  category: string;
  preview?: string;
  file?: File;
}

interface FileManagerProps {
  user: { id: number; username: string; role: string };
  onLogout: () => void;
}

const FileManager: React.FC<FileManagerProps> = ({ user, onLogout }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const categories = [
    { id: 'all', name: 'Alle Dateien', icon: '📁' },
    { id: 'images', name: 'Bilder', icon: '🖼️' },
    { id: 'documents', name: 'Dokumente', icon: '📄' },
    { id: 'videos', name: 'Videos', icon: '🎥' },
    { id: 'audio', name: 'Audio', icon: '🎵' },
    { id: 'other', name: 'Andere', icon: '📦' }
  ];

  const getFileCategory = (type: string): string => {
    if (type.startsWith('image/')) return 'images';
    if (type.startsWith('video/')) return 'videos';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return 'documents';
    return 'other';
  };

  const handleFileUpload = useCallback((uploadedFiles: FileList) => {
    Array.from(uploadedFiles).forEach(file => {
      const fileItem: FileItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadDate: new Date().toISOString(),
        category: getFileCategory(file.type),
        file: file
      };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id 
              ? { ...f, preview: e.target?.result as string }
              : f
          ));
        };
        reader.readAsDataURL(file);
      }

      setFiles(prev => [...prev, fileItem]);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileUpload(droppedFiles);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const downloadFile = (file: FileItem) => {
    if (file.file) {
      const url = URL.createObjectURL(file.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const deleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(file => {
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (categoryId: string): number => {
    if (categoryId === 'all') return files.length;
    return files.filter(f => f.category === categoryId).length;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Folder className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold">AI File Manager</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">Willkommen, {user.username}</span>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Dateien suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{category.icon}</span>
                  <span>{category.name}</span>
                </div>
                <span className="bg-gray-600 text-xs px-2 py-1 rounded-full">
                  {getCategoryCount(category.id)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-900/20'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-300 mb-2">
              Dateien hier ablegen oder klicken zum Auswählen
            </p>
            <p className="text-sm text-gray-500">
              Unterstützt alle Dateiformate
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg cursor-pointer transition-colors"
            >
              Dateien auswählen
            </label>
          </div>

          {/* Files Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFiles.map(file => (
              <div key={file.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <File className="h-8 w-8 text-blue-400" />
                  <div className="flex space-x-2">
                    {file.preview && (
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => downloadFile(file)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {file.preview && (
                  <div className="mb-3">
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-32 object-cover rounded"
                    />
                  </div>
                )}
                
                <h3 className="font-medium text-white truncate mb-1">{file.name}</h3>
                <p className="text-sm text-gray-400">{formatFileSize(file.size)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(file.uploadDate).toLocaleDateString('de-DE')}
                </p>
              </div>
            ))}
          </div>

          {filteredFiles.length === 0 && (
            <div className="text-center py-12">
              <File className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-xl text-gray-400 mb-2">Keine Dateien gefunden</p>
              <p className="text-gray-500">
                {files.length === 0 
                  ? 'Laden Sie Ihre ersten Dateien hoch'
                  : 'Versuchen Sie einen anderen Suchbegriff oder eine andere Kategorie'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && previewFile.preview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl max-h-full overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-medium text-white">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={previewFile.preview}
                alt={previewFile.name}
                className="max-w-full max-h-96 mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;