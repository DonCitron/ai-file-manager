import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Upload, File, X, Eye, Download, LogOut, Calendar as CalendarIcon } from 'lucide-react';
import AISearch from './AISearch';
import { getApiUrl } from '../config';

interface BackendFile {
  id: number;
  name: string;
  type: string;
  size: number;
  path: string;
  tags: string[];
  uploadDate: string;
  description?: string;
  aiAnalysis?: string;
  preview?: string;
}

interface Message {
  text: string;
  isUser: boolean;
  files?: BackendFile[];
}

interface FileManagerProps {
  user: { id: number; username: string; role: string };
  onLogout: () => void;
}

const FileManager: React.FC<FileManagerProps> = ({ user, onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hallo, ich bin Pasi AI. Wie kann ich Ihnen heute helfen? Sie können Dateien hochladen und ich organisiere sie intelligent in Ordnern.", isUser: false }
  ]);
  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<BackendFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<BackendFile | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadFiles = async () => {
    try {
      const response = await fetch(getApiUrl('files'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const files = await response.json();
        setUploadedFiles(files);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    setIsLoading(true);
    const fileArray = Array.from(files);
    
    try {
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id.toString());

        const response = await fetch(getApiUrl('upload'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: formData,
        });

        if (response.ok) {
          const uploadedFile = await response.json();
          setUploadedFiles(prev => [...prev, uploadedFile]);
          
          const aiMessage = `🤖 Ich habe "${file.name}" erfolgreich analysiert und hochgeladen! Die Datei wurde intelligent kategorisiert und mit KI-Tags versehen.`;
          setMessages(prev => [...prev, {
            text: aiMessage,
            isUser: false,
            files: [uploadedFile]
          }]);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessages(prev => [...prev, {
        text: "Entschuldigung, beim Upload ist ein Fehler aufgetreten.",
        isUser: false
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);

    try {
      const response = await fetch(getApiUrl('chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          message: userMessage,
          files: uploadedFiles 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { text: data.response, isUser: false }]);
      } else {
        // Fallback response
        const responses = [
          "🚀 Ich kann Ihnen bei der intelligenten Dateiverwaltung helfen. Laden Sie Dateien hoch und ich organisiere sie automatisch mit KI-Analyse!",
          "📁 Gerne helfe ich Ihnen bei der smarten Dateisortierung. Meine KI erkennt automatisch Kategorien und erstellt passende Tags.",
          "🧠 Ich analysiere Ihre Dateien automatisch und erstelle intelligente Kategorien. Probieren Sie es mit einem Upload aus!",
          "✨ Mit meiner KI-Unterstützung wird Ihre Dateiverwaltung effizienter. Jede Datei wird automatisch analysiert und kategorisiert!"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        setMessages(prev => [...prev, { text: randomResponse, isUser: false }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { text: "Entschuldigung, ich kann momentan nicht antworten.", isUser: false }]);
    }
  };

  const downloadFile = async (file: BackendFile) => {
    try {
      const response = await fetch(getApiUrl(`download/${file.id}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleSearchResults = (results: BackendFile[], response: string) => {
    setMessages(prev => [...prev, {
      text: response,
      isUser: false,
      files: results
    }]);
  };

  const getAIFolders = () => {
    const folders = [
      {
        name: 'Bilder',
        files: uploadedFiles.filter(f => f.type.startsWith('image/')),
        icon: '🖼️',
        count: uploadedFiles.filter(f => f.type.startsWith('image/')).length
      },
      {
        name: 'Dokumente',
        files: uploadedFiles.filter(f => f.type.includes('pdf') || f.type.includes('document') || f.type.includes('text')),
        icon: '📄',
        count: uploadedFiles.filter(f => f.type.includes('pdf') || f.type.includes('document') || f.type.includes('text')).length
      },
      {
        name: 'Videos',
        files: uploadedFiles.filter(f => f.type.startsWith('video/')),
        icon: '🎥',
        count: uploadedFiles.filter(f => f.type.startsWith('video/')).length
      },
      {
        name: 'Audio',
        files: uploadedFiles.filter(f => f.type.startsWith('audio/')),
        icon: '🎵',
        count: uploadedFiles.filter(f => f.type.startsWith('audio/')).length
      },
      {
        name: 'Andere',
        files: uploadedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('audio/') && !f.type.includes('pdf') && !f.type.includes('document') && !f.type.includes('text')),
        icon: '📦',
        count: uploadedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('audio/') && !f.type.includes('pdf') && !f.type.includes('document') && !f.type.includes('text')).length
      }
    ];
    return folders.filter(folder => folder.count > 0);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold">Pasi AI File Manager</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <CalendarIcon className="h-4 w-4" />
              <span>Kalender</span>
            </button>
            <span className="text-gray-300">Willkommen, {user.username}</span>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Abmelden</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* AI Folders Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-white mb-4">🤖 AI-Ordner</h3>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                selectedFolder === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">📁</span>
                <span>Alle Dateien</span>
              </div>
              <span className="bg-gray-600 text-xs px-2 py-1 rounded-full">
                {uploadedFiles.length}
              </span>
            </button>
            
            {getAIFolders().map((folder) => (
              <button
                key={folder.name}
                onClick={() => setSelectedFolder(folder.name)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  selectedFolder === folder.name
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{folder.icon}</span>
                  <span>{folder.name}</span>
                </div>
                <span className="bg-gray-600 text-xs px-2 py-1 rounded-full">
                  {folder.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {/* AI Search */}
          <div className="p-4">
            <AISearch files={uploadedFiles} onSearchResults={handleSearchResults} />
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl p-4 rounded-lg ${
                  message.isUser 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 border border-gray-700'
                }`}>
                  <div className="flex items-start space-x-3">
                    {!message.isUser && <Bot className="h-6 w-6 text-blue-400 mt-1" />}
                    {message.isUser && <User className="h-6 w-6 text-white mt-1" />}
                    <div className="flex-1">
                      <p className="text-sm">{message.text}</p>
                      {message.files && message.files.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {message.files.map((file) => (
                            <div key={file.id} className="bg-gray-700 p-3 rounded border border-gray-600">
                              <div className="flex items-center space-x-2 mb-2">
                                <File className="h-4 w-4 text-blue-400" />
                                <span className="text-sm font-medium truncate">{file.name}</span>
                              </div>
                              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                              {file.aiAnalysis && (
                                <p className="text-xs text-gray-300 mt-1 bg-gray-600 p-2 rounded">{file.aiAnalysis}</p>
                              )}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {file.tags.map((tag, tagIndex) => (
                                  <span key={tagIndex} className="bg-blue-600 text-xs px-2 py-1 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 border-t border-gray-700">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors mb-4 ${
                isDragging
                  ? 'border-blue-400 bg-blue-900/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                  handleFileUpload(files);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
            >
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-300 mb-2">🚀 Dateien hier ablegen für KI-Analyse</p>
              <p className="text-sm text-gray-400 mb-3">Automatische Kategorisierung und intelligente Tags</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 px-4 py-2 rounded-lg transition-colors"
              >
                {isLoading ? '📤 Uploading...' : '📁 Dateien auswählen'}
              </button>
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Fragen Sie Pasi AI..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              🗂️ {selectedFolder ? `${selectedFolder} (${getAIFolders().find(f => f.name === selectedFolder)?.count || 0})` : `Alle Dateien (${uploadedFiles.length})`}
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(selectedFolder 
                ? getAIFolders().find(f => f.name === selectedFolder)?.files || []
                : uploadedFiles
              ).map((file) => (
                <div key={file.id} className="bg-gray-700 p-3 rounded border border-gray-600 hover:border-blue-500 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <File className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium truncate">{file.name}</span>
                    </div>
                    <div className="flex space-x-1">
                      {file.preview && (
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => downloadFile(file)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  <p className="text-xs text-gray-500">{new Date(file.uploadDate).toLocaleDateString('de-DE')}</p>
                  {file.aiAnalysis && (
                    <p className="text-xs text-gray-300 mt-1 bg-gray-600 p-1 rounded">{file.aiAnalysis}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {file.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="bg-blue-600 text-xs px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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