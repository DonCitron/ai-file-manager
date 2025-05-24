import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Upload, File, Folder, X, Eye, Download, Search, LogOut, Calendar as CalendarIcon } from 'lucide-react';
import Login from './components/Login';
import AISearch from './components/AISearch';
import Calendar from './components/Calendar';
import { getApiUrl } from './config';

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
  contentHash?: string;
  duplicateGroup?: string;
  similarity?: number;
  commonTags?: string[];
  r2ObjectKey?: string;
  storageType?: string;
}

interface Message {
  text: string;
  isUser: boolean;
  files?: BackendFile[];
  imagePreview?: string;
}

interface AIFolder {
  name: string;
  files: BackendFile[];
  icon: string;
  count: number;
}

function App() {
  // Authentication state
  const [user, setUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    { text: "Hallo, ich bin Pasi AI. Wie kann ich Ihnen heute helfen? Sie können Dateien hochladen und ich organisiere sie intelligent in Ordnern.", isUser: false }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<BackendFile[]>([]);
  const [aiFolders, setAiFolders] = useState<AIFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<BackendFile | null>(null);
  const [aiSearchResults, setAiSearchResults] = useState<BackendFile[]>([]);
  const [currentView, setCurrentView] = useState<'chat' | 'calendar'>('chat');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Login/Logout functions
  const handleLogin = (userData: { id: number; username: string; role: string }) => {
    setUser(userData);
    setIsLoggedIn(true);
    setMessages([
      { text: `Willkommen zurück, ${userData.username}! Ich bin Pasi AI und helfe Ihnen beim Verwalten Ihrer Dateien. Sie können Dateien hochladen und ich organisiere sie intelligent in Ordnern.`, isUser: false }
    ]);
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setUploadedFiles([]);
    setAiFolders([]);
    setMessages([]);
    setSelectedFolder('all');
    setPreviewFile(null);
    setAiSearchResults([]);
    setCurrentView('chat');
  };

  const handleAiSearchResults = (results: BackendFile[], aiResponse: string) => {
    setAiSearchResults(results);
    setSelectedFolder('ai-search');
    
    // Add AI response to chat
    setMessages(prev => [...prev,
      { text: `AI-Suche: "${aiResponse}"`, isUser: false, files: results }
    ]);
  };

  // Dateien vom Backend laden
  const fetchFiles = async () => {
    try {
      const response = await fetch(getApiUrl('files'));
      if (response.ok) {
        const result = await response.json();
        // Backend gibt ein Objekt mit message und data zurück
        const files = Array.isArray(result) ? result : (result.data || []);
        setUploadedFiles(files);
        organizeFilesIntoFolders(files);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Dateien:', error);
    }
  };

  // Dateien in AI-Ordner organisieren
  const organizeFilesIntoFolders = (files: BackendFile[]) => {
    const folders: { [key: string]: BackendFile[] } = {};
    
    files.forEach(file => {
      if (file.tags && file.tags.length > 0) {
        file.tags.forEach(tag => {
          if (!folders[tag]) {
            folders[tag] = [];
          }
          folders[tag].push(file);
        });
      }
    });

    const aiFolders: AIFolder[] = Object.entries(folders).map(([tag, files]) => ({
      name: tag,
      files,
      icon: getIconForTag(tag),
      count: files.length
    }));

    setAiFolders(aiFolders);
  };

  const getIconForTag = (tag: string): string => {
    const iconMap: { [key: string]: string } = {
      'dokument': '📄',
      'bild': '🖼️',
      'video': '🎥',
      'audio': '🎵',
      'text': '📝',
      'pdf': '📕',
      'excel': '📊',
      'powerpoint': '📈',
      'code': '💻',
      'archiv': '📦',
      'uploaded': '📤',
      'important': '⭐',
      'work': '💼',
      'personal': '👤'
    };
    return iconMap[tag.toLowerCase()] || '📁';
  };

  // Datei-Upload
  const handleFileUpload = async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(getApiUrl('upload'), {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Upload erfolgreich:', result);
        
        // Dateien neu laden
        await fetchFiles();
        
        // Chat-Nachricht hinzufügen
        const uploadedFileNames = Array.from(files).map(f => f.name).join(', ');
        setMessages(prev => [...prev,
          { text: `Dateien hochgeladen: ${uploadedFileNames}`, isUser: true },
          { text: `✅ ${files.length} Datei(en) erfolgreich hochgeladen und analysiert!`, isUser: false, files: result.files || [] }
        ]);

        // Bild-Preview für hochgeladene Bilder hinzufügen
        Array.from(files).forEach(async (file) => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setMessages(prev => [...prev, {
                text: `Bild-Preview: ${file.name}`,
                isUser: false,
                imagePreview: e.target?.result as string
              }]);
            };
            reader.readAsDataURL(file);
          }
        });

      } else {
        const errorText = await response.text();
        console.error('Upload fehlgeschlagen:', errorText);
        setMessages(prev => [...prev,
          { text: 'Upload fehlgeschlagen. Bitte versuchen Sie es erneut.', isUser: false }
        ]);
      }
    } catch (error) {
      console.error('Upload-Fehler:', error);
      setMessages(prev => [...prev, 
        { text: 'Upload-Fehler. Bitte versuchen Sie es erneut.', isUser: false }
      ]);
    }
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  // Datei-Download
  const handleDownload = async (file: BackendFile) => {
    try {
      const downloadUrl = `${getApiUrl('download')}/${encodeURIComponent(file.name)}`;
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download-Fehler:', error);
    }
  };

  // Chat-Nachricht senden
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setIsTyping(true);

    // Simuliere AI-Antwort
    setTimeout(() => {
      setIsTyping(false);
      
      if (userMessage.toLowerCase().includes('upload') || userMessage.toLowerCase().includes('hochladen')) {
        setMessages(prev => [...prev, { 
          text: "Gerne! Sie können Dateien hochladen, indem Sie auf das Upload-Symbol klicken oder Dateien einfach hierher ziehen.", 
          isUser: false 
        }]);
      } else if (userMessage.toLowerCase().includes('ordner') || userMessage.toLowerCase().includes('folder')) {
        setMessages(prev => [...prev, { 
          text: "Ich organisiere Ihre Dateien automatisch in intelligente Ordner basierend auf ihrem Inhalt und Typ. Schauen Sie in die Seitenleiste für die AI-Ordner!", 
          isUser: false 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          text: "Das ist eine interessante Frage! Ich kann Ihnen beim Verwalten Ihrer Dateien helfen. Laden Sie einfach Dateien hoch und ich organisiere sie für Sie.", 
          isUser: false 
        }]);
      }
    }, 1000);
  };

  // Dateien beim Laden der App abrufen
  useEffect(() => {
    if (isLoggedIn) {
      fetchFiles();
    }
  }, [isLoggedIn]);

  // Gefilterte Dateien basierend auf ausgewähltem Ordner
  const getFilteredFiles = () => {
    if (selectedFolder === 'all') return uploadedFiles;
    if (selectedFolder === 'ai-search') return aiSearchResults;
    
    const folder = aiFolders.find(f => f.name === selectedFolder);
    return folder ? folder.files : [];
  };


  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-8 w-8 text-blue-400" />
              <h1 className="text-xl font-bold">Pasi AI</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentView(currentView === 'chat' ? 'calendar' : 'chat')}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title={currentView === 'chat' ? 'Kalender öffnen' : 'Chat öffnen'}
              >
                {currentView === 'chat' ? <CalendarIcon className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Abmelden"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <User className="h-4 w-4" />
            <span>{user?.username} ({user?.role})</span>
          </div>
        </div>

        {/* AI Search */}
        <div className="p-4 border-b border-gray-700">
          <AISearch 
            files={uploadedFiles} 
            onSearchResults={handleAiSearchResults}
          />
        </div>

        {/* Upload Area */}
        <div className="p-4 border-b border-gray-700">
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
              isDragOver ? 'border-blue-400 bg-blue-400/10' : 'border-gray-600 hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-400">
              Dateien hierher ziehen oder klicken
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
          </div>
        </div>

        {/* Folder Navigation */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            <button
              onClick={() => setSelectedFolder('all')}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                selectedFolder === 'all' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <Folder className="h-5 w-5" />
              <span>Alle Dateien ({uploadedFiles.length})</span>
            </button>

            {aiSearchResults.length > 0 && (
              <button
                onClick={() => setSelectedFolder('ai-search')}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  selectedFolder === 'ai-search' ? 'bg-blue-600' : 'hover:bg-gray-700'
                }`}
              >
                <Search className="h-5 w-5" />
                <span>Suchergebnisse ({aiSearchResults.length})</span>
              </button>
            )}

            {aiFolders.map((folder) => (
              <button
                key={folder.name}
                onClick={() => setSelectedFolder(folder.name)}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  selectedFolder === folder.name ? 'bg-blue-600' : 'hover:bg-gray-700'
                }`}
              >
                <span className="text-lg">{folder.icon}</span>
                <span className="capitalize">{folder.name} ({folder.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {currentView === 'chat' ? (
          <>
            {/* File List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredFiles().map((file) => (
                  <div key={file.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <File className="h-5 w-5 text-blue-400" />
                        <span className="text-sm font-medium text-white truncate">{file.name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {file.type.startsWith('image/') && (
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="p-1 hover:bg-gray-600 rounded transition-colors"
                            title="Vorschau"
                          >
                            <Eye className="h-4 w-4 text-gray-400" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1 hover:bg-gray-600 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Größe: {(file.size / 1024).toFixed(1)} KB</div>
                      <div>Typ: {file.type}</div>
                      {file.uploadDate && (
                        <div>Upload: {new Date(file.uploadDate).toLocaleDateString('de-DE')}</div>
                      )}
                      {file.description && (
                        <div className="mt-2 text-xs text-gray-300">{file.description}</div>
                      )}
                      {file.tags && file.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {file.tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-600 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {getFilteredFiles().length === 0 && (
                <div className="text-center text-gray-400 mt-8">
                  <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine Dateien gefunden</p>
                </div>
              )}
            </div>

            {/* Chat Messages - moved to bottom */}
            <div className="h-64 overflow-y-auto p-6 space-y-4 border-t border-gray-700">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl p-4 rounded-lg ${
                    message.isUser 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-800 border border-gray-700'
                  }`}>
                    <div className="flex items-start space-x-3">
                      {!message.isUser && <Bot className="h-6 w-6 text-blue-400 mt-1 flex-shrink-0" />}
                      <div className="flex-1">
                        <p className="text-sm">{message.text}</p>
                        
                        {/* Image Preview in Chat */}
                        {message.imagePreview && (
                          <div className="mt-3">
                            <img 
                              src={message.imagePreview} 
                              alt="Preview" 
                              className="max-w-sm rounded-lg border border-gray-600"
                            />
                          </div>
                        )}
                        
                        {/* File List in Chat */}
                        {message.files && message.files.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.files.map((file) => (
                              <div key={file.id} className="flex items-center justify-between p-2 bg-gray-700 rounded border border-gray-600">
                                <div className="flex items-center space-x-2">
                                  <File className="h-4 w-4 text-blue-400" />
                                  <span className="text-sm">{file.name}</span>
                                  <span className="text-xs text-gray-400">
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {file.type.startsWith('image/') && (
                                    <button
                                      onClick={() => setPreviewFile(file)}
                                      className="p-1 hover:bg-gray-600 rounded transition-colors"
                                      title="Vorschau"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDownload(file)}
                                    className="p-1 hover:bg-gray-600 rounded transition-colors"
                                    title="Download"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {message.isUser && <User className="h-6 w-6 text-blue-400 mt-1 flex-shrink-0" />}
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Bot className="h-6 w-6 text-blue-400" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-6 border-t border-gray-700">
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Nachricht eingeben..."
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-3 rounded-lg transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Calendar View */
          <Calendar />
        )}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl max-h-full overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              {previewFile.type.startsWith('image/') && (
                <img
                  src={`${getApiUrl('download')}/${encodeURIComponent(previewFile.name)}`}
                  alt={previewFile.name}
                  className="max-w-full max-h-96 object-contain rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
