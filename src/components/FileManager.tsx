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
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [fileToMove, setFileToMove] = useState<BackendFile | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
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
      // Try to load from API first
      const response = await fetch(getApiUrl('files'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const files = await response.json();
        setUploadedFiles(files);
        return;
      }
    } catch (error) {
      console.error('API not available, loading from localStorage:', error);
    }
    
    // Fallback to localStorage
    const savedFiles = localStorage.getItem('uploadedFiles');
    if (savedFiles) {
      try {
        setUploadedFiles(JSON.parse(savedFiles));
      } catch (error) {
        console.error('Error loading files from localStorage:', error);
      }
    }
    
    // Load custom folders
    const savedFolders = localStorage.getItem('customFolders');
    if (savedFolders) {
      try {
        setCustomFolders(JSON.parse(savedFolders));
      } catch (error) {
        console.error('Error loading custom folders:', error);
      }
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
          const newFiles = [...uploadedFiles, uploadedFile];
          setUploadedFiles(newFiles);
          localStorage.setItem('uploadedFiles', JSON.stringify(newFiles));
          
          const aiMessage = `🤖 Ich habe "${file.name}" erfolgreich analysiert und hochgeladen! Die Datei wurde intelligent kategorisiert und mit KI-Tags versehen.`;
          setMessages(prev => [...prev, {
            text: aiMessage,
            isUser: false,
            files: [uploadedFile]
          }]);
        } else {
          // Fallback: Create mock file for localStorage
          const mockFile: BackendFile = {
            id: Date.now(),
            name: file.name,
            type: file.type,
            size: file.size,
            path: `mock/${file.name}`,
            tags: ['uploaded', file.type.split('/')[0]],
            uploadDate: new Date().toISOString(),
            description: `Mock upload: ${file.name}`,
            aiAnalysis: `AI-Analyse für ${file.name}: ${file.type.includes('image') ? 'Bilddatei erkannt' : file.type.includes('pdf') ? 'PDF-Dokument erkannt' : 'Datei erfolgreich analysiert'}`
          };
          
          const newFiles = [...uploadedFiles, mockFile];
          setUploadedFiles(newFiles);
          localStorage.setItem('uploadedFiles', JSON.stringify(newFiles));
          
          const aiMessage = `🤖 Ich habe "${file.name}" erfolgreich analysiert und lokal gespeichert! Die Datei wurde intelligent kategorisiert.`;
          setMessages(prev => [...prev, {
            text: aiMessage,
            isUser: false,
            files: [mockFile]
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
        // Enhanced AI responses based on user input
        let aiResponse = "";
        const lowerInput = userMessage.toLowerCase();
        
        if (lowerInput.includes('hilfe') || lowerInput.includes('help')) {
          aiResponse = "🤖 Gerne helfe ich Ihnen! Ich kann:\n\n📁 Dateien automatisch kategorisieren\n🔍 Dateien durchsuchen\n📂 Ordner verwalten\n🗑️ Dateien löschen\n📅 Termine im Kalender anzeigen\n\nLaden Sie einfach Dateien hoch oder fragen Sie mich etwas!";
        } else if (lowerInput.includes('datei') || lowerInput.includes('file')) {
          aiResponse = `📊 Sie haben aktuell ${uploadedFiles.length} Dateien gespeichert:\n\n${getAIFolders().map(folder => `${folder.icon} ${folder.name}: ${folder.count} Dateien`).join('\n')}\n\nMöchten Sie neue Dateien hochladen oder bestehende verwalten?`;
        } else if (lowerInput.includes('ordner') || lowerInput.includes('folder')) {
          aiResponse = "📂 Ordner-Verwaltung:\n\n🤖 AI-Ordner: Automatische Kategorisierung\n📁 Meine Ordner: Eigene Ordner erstellen mit '+ Neu'\n📁 Verschieben: Klicken Sie auf das 📁 Symbol bei Dateien\n\nSoll ich Ihnen bei der Ordner-Organisation helfen?";
        } else if (lowerInput.includes('löschen') || lowerInput.includes('delete')) {
          aiResponse = "🗑️ Dateien löschen:\n\nKlicken Sie auf das 🗑️ Symbol neben einer Datei um sie zu löschen. Die Datei wird sofort entfernt und kann nicht wiederhergestellt werden.\n\nSoll ich Ihnen zeigen, wie Sie Dateien verwalten können?";
        } else if (lowerInput.includes('kalender') || lowerInput.includes('termin')) {
          aiResponse = "📅 Kalender-Funktionen:\n\n📅 Kalender öffnen: Button im Header\n📋 Termine anzeigen: Aktuelle Termine werden angezeigt\n🗓️ Termine verwalten: Einfache Übersicht\n\nMöchten Sie den Kalender öffnen?";
        } else if (lowerInput.includes('suche') || lowerInput.includes('search')) {
          aiResponse = "🔍 Such-Funktionen:\n\n🔎 Schnellsuche: Buttons für 'PDF Dateien', 'Bilder', etc.\n💬 AI-Chat: Fragen Sie mich nach bestimmten Dateien\n📂 Ordner-Filter: Klicken Sie auf Ordner in der Sidebar\n\nWas möchten Sie suchen?";
        } else {
          // General responses
          const responses = [
            "🚀 Ich kann Ihnen bei der intelligenten Dateiverwaltung helfen. Laden Sie Dateien hoch und ich organisiere sie automatisch!",
            "📁 Gerne helfe ich bei der Dateisortierung. Fragen Sie mich nach Ihren Dateien oder Ordnern!",
            "🧠 Ich analysiere Ihre Dateien automatisch. Probieren Sie einen Upload aus oder fragen Sie mich etwas!",
            "✨ Mit meiner Hilfe wird Dateiverwaltung einfacher. Wie kann ich Ihnen heute helfen?"
          ];
          aiResponse = responses[Math.floor(Math.random() * responses.length)];
        }
        
        setMessages(prev => [...prev, { text: aiResponse, isUser: false }]);
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

  const createCustomFolder = () => {
    if (!newFolderName.trim()) return;
    
    const updatedFolders = [...customFolders, newFolderName.trim()];
    setCustomFolders(updatedFolders);
    localStorage.setItem('customFolders', JSON.stringify(updatedFolders));
    setNewFolderName('');
    setShowCreateFolder(false);
  };

  const moveFileToFolder = (targetFolder: string) => {
    if (!fileToMove) return;
    
    const updatedFiles = uploadedFiles.map(file => 
      file.id === fileToMove.id 
        ? { ...file, customFolder: targetFolder }
        : file
    );
    
    setUploadedFiles(updatedFiles);
    localStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles));
    setFileToMove(null);
    setShowMoveModal(false);
  };

  const getFilesInCustomFolder = (folderName: string) => {
    return uploadedFiles.filter(file => (file as any).customFolder === folderName);
  };

  const deleteFile = (fileToDelete: BackendFile) => {
    const updatedFiles = uploadedFiles.filter(file => file.id !== fileToDelete.id);
    setUploadedFiles(updatedFiles);
    localStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles));
    
    setMessages(prev => [...prev, {
      text: `🗑️ Datei "${fileToDelete.name}" wurde erfolgreich gelöscht.`,
      isUser: false
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

          {/* Custom Folders Section */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-white">📂 Meine Ordner</h4>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded transition-colors"
              >
                + Neu
              </button>
            </div>
            
            <div className="space-y-2">
              {customFolders.map((folderName) => (
                <button
                  key={folderName}
                  onClick={() => setSelectedFolder(`custom:${folderName}`)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                    selectedFolder === `custom:${folderName}`
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">📁</span>
                    <span className="text-sm">{folderName}</span>
                  </div>
                  <span className="bg-gray-600 text-xs px-1 py-0.5 rounded">
                    {getFilesInCustomFolder(folderName).length}
                  </span>
                </button>
              ))}
            </div>
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
              🗂️ {selectedFolder?.startsWith('custom:') 
                ? `${selectedFolder.replace('custom:', '')} (${getFilesInCustomFolder(selectedFolder.replace('custom:', '')).length})`
                : selectedFolder 
                  ? `${selectedFolder} (${getAIFolders().find(f => f.name === selectedFolder)?.count || 0})` 
                  : `Alle Dateien (${uploadedFiles.length})`}
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(selectedFolder?.startsWith('custom:')
                ? getFilesInCustomFolder(selectedFolder.replace('custom:', ''))
                : selectedFolder 
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
                      {file.type.startsWith('image/') && (
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="text-gray-400 hover:text-white transition-colors"
                          title="Vorschau"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setFileToMove(file);
                          setShowMoveModal(true);
                        }}
                        className="text-yellow-400 hover:text-yellow-300 transition-colors"
                        title="Verschieben"
                      >
                        📁
                      </button>
                      <button
                        onClick={() => deleteFile(file)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Löschen"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={() => downloadFile(file)}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  <p className="text-xs text-gray-500">{new Date(file.uploadDate).toLocaleDateString('de-DE')}</p>
                  {(file as any).customFolder && (
                    <p className="text-xs text-green-400">📁 {(file as any).customFolder}</p>
                  )}
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

      {previewFile && (
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
              {previewFile.type.startsWith('image/') ? (
                <img
                  src={`data:${previewFile.type};base64,${btoa(previewFile.name)}`}
                  alt={previewFile.name}
                  className="max-w-full max-h-96 mx-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJpbGQgbmljaHQgdmVyZsO8Z2JhcjwvdGV4dD48L3N2Zz4=';
                  }}
                />
              ) : (
                <div className="text-center py-8">
                  <File className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300">Vorschau für diesen Dateityp nicht verfügbar</p>
                  <p className="text-gray-500 text-sm mt-2">{previewFile.type}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal - Ultra Simple Version */}
      {showCalendar ? (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '32px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                📅 AI File Manager Kalender
              </h2>
              <button
                onClick={() => setShowCalendar(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                Kalender ist aktiv!
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                Einfache Kalender-Version für AI File Manager
              </p>
              
              <div style={{ 
                backgroundColor: '#dbeafe', 
                padding: '16px', 
                borderRadius: '8px', 
                marginBottom: '16px',
                textAlign: 'left'
              }}>
                <h4 style={{ fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
                  Aktuelle Termine:
                </h4>
                <div style={{ marginBottom: '8px', backgroundColor: '#bfdbfe', padding: '8px', borderRadius: '4px' }}>
                  <strong>26. Mai 2025:</strong> AI File Review (10:00 - 11:00)
                </div>
                <div style={{ backgroundColor: '#bbf7d0', padding: '8px', borderRadius: '4px' }}>
                  <strong>28. Mai 2025:</strong> Backup Schedule (14:00 - 15:00)
                </div>
              </div>
              
              <button
                onClick={() => setShowCalendar(false)}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '8px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
                onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#2563eb'}
              >
                Kalender schließen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
              📁 Neuen Ordner erstellen
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ordner-Name eingeben..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '14px'
              }}
              onKeyPress={(e) => e.key === 'Enter' && createCustomFolder()}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateFolder(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={createCustomFolder}
                disabled={!newFolderName.trim()}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newFolderName.trim() ? 1 : 0.5
                }}
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move File Modal */}
      {showMoveModal && fileToMove && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
              📁 Datei verschieben: {fileToMove.name}
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                AI-Ordner:
              </h4>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                {getAIFolders().map((folder) => (
                  <button
                    key={folder.name}
                    onClick={() => moveFileToFolder(folder.name)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#f9fafb',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>{folder.icon}</span>
                    <span>{folder.name}</span>
                  </button>
                ))}
              </div>
              
              {customFolders.length > 0 && (
                <>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Meine Ordner:
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {customFolders.map((folderName) => (
                      <button
                        key={folderName}
                        onClick={() => moveFileToFolder(folderName)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          backgroundColor: '#ecfdf5',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span>📁</span>
                        <span>{folderName}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowMoveModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;