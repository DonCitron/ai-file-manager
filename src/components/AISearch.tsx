import React, { useState } from 'react';
import { Search, Bot, Loader2 } from 'lucide-react';
import { getApiUrl } from '../config';

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

const AISearch: React.FC<AISearchProps> = ({ onSearchResults }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lastResponse, setLastResponse] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    
    try {
      const response = await fetch(getApiUrl('search'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.message === 'success') {
        setLastResponse(data.aiResponse);
        onSearchResults(data.data, data.aiResponse);
      } else {
        setLastResponse('Fehler bei der Suche. Bitte versuchen Sie es erneut.');
        onSearchResults([], 'Fehler bei der Suche.');
      }
    } catch (error) {
      console.error('AI Search error:', error);
      setLastResponse('Netzwerkfehler bei der Suche.');
      onSearchResults([], 'Netzwerkfehler bei der Suche.');
    } finally {
      setIsSearching(false);
    }
  };

  const quickSearches = [
    'Bilder',
    'Dokumente',
    'PDF Dateien',
    'Letzte Uploads',
    'Große Dateien'
  ];

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
    // Automatisch suchen
    setTimeout(() => {
      const form = document.getElementById('ai-search-form') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }, 100);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center space-x-2 mb-3">
        <Bot className="h-5 w-5 text-purple-600" />
        <h3 className="font-medium text-gray-900">AI-Dateisuche</h3>
      </div>

      <form id="ai-search-form" onSubmit={handleSearch} className="mb-3">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fragen Sie die AI nach Ihren Dateien..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors flex items-center space-x-2"
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
        <p className="text-xs text-gray-500 mb-2">Schnellsuche:</p>
        <div className="flex flex-wrap gap-2">
          {quickSearches.map((query) => (
            <button
              key={query}
              onClick={() => handleQuickSearch(query)}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
            >
              {query}
            </button>
          ))}
        </div>
      </div>

      {lastResponse && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Bot className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-purple-800">{lastResponse}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISearch;