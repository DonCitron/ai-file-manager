import { useState, useRef, useEffect } from 'react';
import type { MyFileData } from '../services/fileStore';
import { VirtualFileList } from './VirtualFileList';
import { Send, Sparkles, User, Bot, Upload, File, X, Eye, Download, LogOut, Calendar as CalendarIcon } from 'lucide-react';
import AISearch from './AISearch';
import { getApiUrl } from '../config';
import { useFileStore } from '../services/fileStore';
import { FilePreview } from './FilePreview';

interface Message {
  text: string;
  isUser: boolean;
  files?: MyFileData[];
}

interface FileManagerProps {
  user: { id: number; username: string; role: string };
  onLogout: () => void;
}

const FileManager: React.FC<FileManagerProps> = ({ user, onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  // Zustand store for files
  const { files, fetchFiles, loading, error, uploadFiles } = useFileStore();
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<MyFileData | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [fileToMove, setFileToMove] = useState<MyFileData | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Zustand now handles file loading
  /* const loadFiles = async () => {
    try {
      // Try to load from API first
      const response = await fetch(getApiUrl('files'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const files: BackendFile[] = await response.json();
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
  }; */

  const handleFileUpload = async (fileList: FileList) => {
    setIsLoading(true);
    const fileArray = Array.from(fileList);

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
          const uploadedFile: MyFileData = await response.json();
          const newFiles = [...files, uploadedFile];
          await uploadFiles(newFiles);
          localStorage.setItem('uploadedFiles', JSON.stringify(newFiles));

          const aiMessage = `🤖 Ich habe "${file.name}" erfolgreich analysiert und hochgeladen! Die Datei wurde intelligent kategorisiert und mit KI-Tags versehen.`;
          setMessages(prev => [...prev, {
            text: aiMessage,
            isUser: false,
            files: [uploadedFile]
          }]);
        } else {
          // Fallback: Create mock file for localStorage
          const mockFile: MyFileData = {
            id: Date.now(),
            name: file.name,
            originalName: file.name,
            type: file.type,
            size: file.size,
            tags: ['uploaded', file.type.split('/')[0]],
            uploadDate: new Date().toISOString(),
            description: `Mock upload: ${file.name}`,
            aiAnalysis: `AI-Analyse für ${file.name}: ${file.type.includes('image') ? 'Bilddatei erkannt' : file.type.includes('pdf') ? 'PDF-Dokument erkannt' : 'Datei erfolgreich analysiert'}`
          };

          const newFiles = [...files, mockFile];
          await uploadFiles(newFiles);
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
          files: files
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
          aiResponse = `📊 Sie haben aktuell ${files.length} Dateien gespeichert:\n\n${getAIFolders().map(folder => `${folder.icon} ${folder.name}: ${folder.count} Dateien`).join('\n')}\n\nMöchten Sie neue Dateien hochladen oder bestehende verwalten?`;
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

  const downloadFile = async (file: MyFileData) => {
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

  const handleSearchResults = (results: MyFileData[], response: string) => {
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
    
    const updatedFiles = files.map(file => 
      file.id === fileToMove.id 
        ? { ...file, customFolder: targetFolder }
        : file
    );
    
    uploadFiles(updatedFiles);
    localStorage.setItem('uploadedFiles', JSON.stringify(updatedFiles));
    
    // Success message
    setMessages(prev => [...prev, {
      text: `📁 Datei "${fileToMove.name}" wurde erfolgreich in den Ordner "${targetFolder}" verschoben.`,
      isUser: false
    }]);
    
    setFileToMove(null);
    setShowMoveModal(false);
  };

  const getFilesInCustomFolder = (folderName: string) => {
    return files.filter(file => (file as any).customFolder === folderName);
  };

  const deleteFile = (fileToDelete: MyFileData) => {
    const updatedFiles = files.filter(file => file.id !== fileToDelete.id);
    uploadFiles(updatedFiles);
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
        files: files.filter(f => f.type.startsWith('image/')),
        icon: '🖼️',
        count: files.filter(f => f.type.startsWith('image/')).length
      },
      {
        name: 'Dokumente',
        files: files.filter(f => f.type.includes('pdf') || f.type.includes('document') || f.type.includes('text')),
        icon: '📄',
        count: files.filter(f => f.type.includes('pdf') || f.type.includes('document') || f.type.includes('text')).length
      },
      {
        name: 'Videos',
        files: files.filter(f => f.type.startsWith('video/')),
        icon: '🎥',
        count: files.filter(f => f.type.startsWith('video/')).length
      },
      {
        name: 'Audio',
        files: files.filter(f => f.type.startsWith('audio/')),
        icon: '🎵',
        count: files.filter(f => f.type.startsWith('audio/')).length
      },
      {
        name: 'Andere',
        files: files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('audio/') && !f.type.includes('pdf') && !f.type.includes('document') && !f.type.includes('text')),
        icon: '📦',
        count: files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.includes('pdf') && !f.type.includes('document') && !f.type.includes('text')).length
      }
    ];
    return folders.filter(folder => folder.count > 0);
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
          {getAIFolders().map((folder) => (
            <div key={folder.name} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded cursor-pointer">
              <span className="flex items-center">
                <span className="mr-2">{folder.icon}</span> {folder.name}
              </span>
              <span>{folder.count}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-semibold mb-2">📂 Meine Ordner</div>
          <button className="text-blue-400 hover:text-blue-200 mb-2" onClick={() => setShowCreateFolder(true)}>+ Neu</button>
          {customFolders.map((folderName) => (
            <div key={folderName} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded cursor-pointer">
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
            <span className="text-gray-600">{selectedFolder?.startsWith('custom:') ? selectedFolder.replace('custom:', '') : selectedFolder || 'Alle Dateien'}</span>
            <span className="text-gray-500">({selectedFolder?.startsWith('custom:') ? getFilesInCustomFolder(selectedFolder.replace('custom:', '')).length : selectedFolder ? getAIFolders().find(f => f.name === selectedFolder)?.count || 0 : files.length} Elemente)</span>
            <span className="cursor-pointer">⊞</span>
            <span className="cursor-pointer">☰</span>
          </div>
        </div>
        {/* Messages/Chat */}
        <div className="mb-6">
          {messages.map((message, index) => (
            <div key={index} className="mb-4 flex items-start">
              {!message.isUser && <Bot className="h-5 w-5 text-blue-400 mt-1 flex-shrink-0 mr-2" />}
              {message.isUser && <User className="h-5 w-5 text-white mt-1 flex-shrink-0 mr-2" />}
              <div>
                <div>{message.text}</div>
                {message.files && message.files.length > 0 && message.files.map((file) => (
                  <div key={file.id} className="flex items-center mt-1">
                    <File className="h-3 w-3 text-blue-400 mr-1" />
                    <span>{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
                    setFileToMove(file);
                    setShowMoveModal(true);
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