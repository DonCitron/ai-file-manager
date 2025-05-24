import { useState } from 'react';
import { Search, Bot, Loader2 } from 'lucide-react';

interface BackendFile {
  id: number;
  name: string;
  type: string;
  size: number;
  path: string;
  tags: string[];
  uploadDate: string;
}

interface AISearchProps {
  files: BackendFile[];
  onSearchResults: (results: BackendFile[], aiResponse: string) => void;
}

const AISearch: React.FC<AISearchProps> = ({ files, onSearchResults }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lastResponse, setLastResponse] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    
    // Simulate AI search delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // AI-powered search logic
      const query = searchQuery.toLowerCase();
      let results: BackendFile[] = [];
      let aiResponse = '';

      if (query.includes('pdf') || query.includes('dokument')) {
        results = files.filter(f => f.type.includes('pdf') || f.tags.includes('document'));
        aiResponse = `🔍 Ich habe ${results.length} PDF-Dokumente und Textdateien gefunden. Diese sind ideal für Dokumentation und Archivierung.`;
      } else if (query.includes('bild') || query.includes('foto') || query.includes('image')) {
        results = files.filter(f => f.type.startsWith('image/') || f.tags.includes('photo'));
        aiResponse = `📸 Ich habe ${results.length} Bilder gefunden. Diese enthalten visuelle Inhalte und sind perfekt für Präsentationen.`;
      } else if (query.includes('groß') || query.includes('large')) {
        results = files.filter(f => f.size > 5 * 1024 * 1024);
        aiResponse = `📊 Ich habe ${results.length} große Dateien (>5MB) gefunden. Diese benötigen mehr Speicherplatz.`;
      } else if (query.includes('klein') || query.includes('small')) {
        results = files.filter(f => f.size < 100 * 1024);
        aiResponse = `🔍 Ich habe ${results.length} kleine Dateien (<100KB) gefunden. Diese sind platzsparend.`;
      } else if (query.includes('letzte') || query.includes('neu') || query.includes('recent')) {
        results = files.slice().sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()).slice(0, 5);
        aiResponse = `⏰ Hier sind die ${results.length} zuletzt hochgeladenen Dateien, sortiert nach Datum.`;
      } else if (query.includes('video')) {
        results = files.filter(f => f.type.startsWith('video/'));
        aiResponse = `🎥 Ich habe ${results.length} Videos gefunden. Diese enthalten audiovisuelle Inhalte.`;
      } else if (query.includes('audio') || query.includes('musik')) {
        results = files.filter(f => f.type.startsWith('audio/'));
        aiResponse = `🎵 Ich habe ${results.length} Audiodateien gefunden. Diese enthalten Musik oder Sprachaufnahmen.`;
      } else {
        // General search in names and tags
        results = files.filter(f => 
          f.name.toLowerCase().includes(query) || 
          f.tags.some(tag => tag.toLowerCase().includes(query))
        );
        aiResponse = `🔍 Ich habe ${results.length} Dateien gefunden, die "${searchQuery}" entsprechen.`;
      }

      setLastResponse(aiResponse);
      onSearchResults(results, aiResponse);
    } catch (error) {
      console.error('Search error:', error);
      setLastResponse('Entschuldigung, bei der Suche ist ein Fehler aufgetreten.');
    } finally {
      setIsSearching(false);
    }
  };

  const quickSearches = [
    { label: 'PDF Dateien', query: 'PDF Dokumente' },
    { label: 'Bilder', query: 'Bilder und Fotos' },
    { label: 'Letzte Uploads', query: 'Neueste Dateien' },
    { label: 'Große Dateien', query: 'Große Dateien' },
    { label: 'Videos', query: 'Videos' },
    { label: 'Audio', query: 'Audiodateien' }
  ];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
      <div className="flex items-center space-x-2 mb-3">
        <Bot className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">AI-Suche</h3>
      </div>
      
      <form onSubmit={handleSearch} className="mb-3">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fragen Sie die AI: 'Zeige mir alle PDFs' oder 'Große Dateien'"
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
              disabled={isSearching}
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>{isSearching ? 'Suche...' : 'Suchen'}</span>
          </button>
        </div>
      </form>

      <div className="mb-3">
        <p className="text-sm text-gray-400 mb-2">Schnellsuche:</p>
        <div className="flex flex-wrap gap-2">
          {quickSearches.map((search, index) => (
            <button
              key={index}
              onClick={() => {
                setSearchQuery(search.query);
                handleSearch(new Event('submit') as any);
              }}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1 rounded-full transition-colors"
              disabled={isSearching}
            >
              {search.label}
            </button>
          ))}
        </div>
      </div>

      {lastResponse && (
        <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Bot className="h-4 w-4 text-blue-400 mt-0.5" />
            <p className="text-sm text-gray-300">{lastResponse}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISearch;