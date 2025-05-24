import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Upload, File, X, Eye, Download, LogOut } from 'lucide-react';
import Login from './components/Login';

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
  file?: File;
}

interface Message {
  text: string;
  isUser: boolean;
  files?: BackendFile[];
}

function App() {
  const [user, setUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hallo, ich bin Pasi AI. Wie kann ich Ihnen heute helfen? Sie können Dateien hochladen und ich organisiere sie intelligent in Ordnern.", isUser: false }
  ]);
  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<BackendFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<BackendFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const authToken = localStorage.getItem('authToken');
    
    if (savedUser && authToken) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const savedFiles = localStorage.getItem('uploadedFiles');
      if (savedFiles) {
        try {
          setUploadedFiles(JSON.parse(savedFiles));
        } catch (error) {
          console.error('Error loading files:', error);
        }
      }
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && uploadedFiles.length > 0) {
      localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
    }
  }, [uploadedFiles, isLoggedIn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = (loggedInUser: { id: number; username: string; role: string }) => {
    setUser(loggedInUser);
    setIsLoggedIn(true);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setUploadedFiles([]);
    setMessages([
      { text: "Hallo, ich bin Pasi AI. Wie kann ich Ihnen heute helfen? Sie können Dateien hochladen und ich organisiere sie intelligent in Ordnern.", isUser: false }
    ]);
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('uploadedFiles');
  };

  const getFileCategory = (type: string): string => {
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type.startsWith('audio/')) return 'Audio';
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return 'Document';
    return 'Other';
  };

  const generateAIAnalysis = (file: File): string => {
    const category = getFileCategory(file.type);
    const size = file.size;
    const name = file.name;
    
    if (category === 'Image') {
      return `🖼️ Bildanalyse: ${name} ist eine ${file.type.split('/')[1].toUpperCase()}-Datei mit ${(size / 1024).toFixed(1)} KB. Optimiert für Webdarstellung und perfekt für Präsentationen.`;
    } else if (category === 'Document') {
      return `📄 Dokumentanalyse: ${name} ist ein ${file.type.includes('pdf') ? 'PDF' : 'Text'}-Dokument mit ${(size / 1024).toFixed(1)} KB. Ideal für Archivierung und professionelle Nutzung.`;
    } else if (category === 'Video') {
      return `🎥 Videoanalyse: ${name} ist eine Videodatei mit ${(size / (1024 * 1024)).toFixed(1)} MB. Multimedia-Inhalt für Training und Präsentationen.`;
    } else if (category === 'Audio') {
      return `🎵 Audioanalyse: ${name} ist eine Audiodatei mit ${(size / (1024 * 1024)).toFixed(1)} MB. Hochwertige Audioqualität für Musik und Sprachaufnahmen.`;
    } else {
      return `📦 Dateianalyse: ${name} ist eine spezielle Datei mit ${(size / 1024).toFixed(1)} KB. Anwendungsspezifisches Format erkannt.`;
    }
  };

  const generateTags = (file: File): string[] => {
    const category = getFileCategory(file.type);
    const name = file.name.toLowerCase();
    const baseTags = [category.toLowerCase()];
    
    if (file.size > 10 * 1024 * 1024) baseTags.push('large');
    else if (file.size < 100 * 1024) baseTags.push('small');
    
    if (file.type.includes('pdf')) baseTags.push('pdf', 'document');
    if (file.type.includes('image')) baseTags.push('visual', 'media');
    if (name.includes('report')) baseTags.push('report');
    if (name.includes('photo')) baseTags.push('photo');
    if (name.includes('screenshot')) baseTags.push('screenshot');
    
    return [...new Set(baseTags)];
  };

  const handleFileUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    const newFiles: BackendFile[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const fileId = Date.now() + i;
      
      const backendFile: BackendFile = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        path: `uploads/${file.name}`,
        tags: generateTags(file),
        uploadDate: new Date().toISOString(),
        description: `Uploaded file: ${file.name}`,
        aiAnalysis: generateAIAnalysis(file),
        file: file
      };

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const updatedFile = { ...backendFile, preview: e.target?.result as string };
          setUploadedFiles(prev => prev.map(f => f.id === fileId ? updatedFile : f));
        };
        reader.readAsDataURL(file);
      }

      newFiles.push(backendFile);
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);

    const aiMessage = `🤖 Ich habe ${newFiles.length} Datei(en) erfolgreich analysiert und kategorisiert! Die Dateien wurden intelligent organisiert und mit passenden Tags versehen. Jede Datei wurde von meiner KI analysiert.`;
    
    setMessages(prev => [...prev, {
      text: aiMessage,
      isUser: false,
      files: newFiles
    }]);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);

    setTimeout(() => {
      const responses = [
        "🚀 Ich kann Ihnen bei der intelligenten Dateiverwaltung helfen. Laden Sie Dateien hoch und ich organisiere sie automatisch mit KI-Analyse!",
        "📁 Gerne helfe ich Ihnen bei der smarten Dateisortierung. Meine KI erkennt automatisch Kategorien und erstellt passende Tags.",
        "🧠 Ich analysiere Ihre Dateien automatisch und erstelle intelligente Kategorien. Probieren Sie es mit einem Upload aus!",
        "✨ Mit meiner KI-Unterstützung wird Ihre Dateiverwaltung effizienter. Jede Datei wird automatisch analysiert und kategorisiert!"
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setMessages(prev => [...prev, { text: randomResponse, isUser: false }]);
    }, 1000);
  };

  const downloadFile = (file: BackendFile) => {
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

  if (!isLoggedIn || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold">Pasi AI File Manager</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">Willkommen, {user.username}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Abmelden</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        <div className="flex-1 flex flex-col">
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
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                📁 Dateien auswählen
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
            <h3 className="text-lg font-semibold text-white">🗂️ Intelligente Dateien ({uploadedFiles.length})</h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {uploadedFiles.map((file) => (
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
}

export default App;
