import React from 'react';

interface FileCardProps {
  file: {
    name: string;
    type: string;
    size: number;
  };
}

// Einfache Funktion, um ein Icon basierend auf dem Dateityp zurückzugeben
const FileTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  let icon = "📄"; // Standard-Icon
  
  if (type.startsWith('image/')) {
    icon = "🖼️";
  } else if (type.startsWith('video/')) {
    icon = "🎥";
  } else if (type.startsWith('audio/')) {
    icon = "🎵";
  } else if (type === 'application/pdf') {
    icon = "📕";
  } else if (type.includes('wordprocessingml') || type.includes('msword')) {
    icon = "📝";
  } else if (type.includes('spreadsheetml') || type.includes('excel')) {
    icon = "📊";
  } else if (type.includes('presentationml') || type.includes('powerpoint')) {
    icon = "📽️";
  } else if (type.startsWith('text/')) {
    icon = "📄";
  } else if (type === 'application/zip' || type.includes('archive')) {
    icon = "📦";
  }

  return <span className="text-3xl mb-2">{icon}</span>;
};

const FileCard: React.FC<FileCardProps> = ({ file }) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toUpperCase() || '';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors border border-gray-700 hover:border-gray-600 group cursor-pointer">
      <div className="flex flex-col items-center text-center">
        <FileTypeIcon type={file.type} />
        
        <h3 className="font-medium text-white mb-1 w-full truncate group-hover:text-blue-400 transition-colors" title={file.name}>
          {file.name}
        </h3>
        
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <span className="bg-gray-700 px-2 py-1 rounded">
            {getFileExtension(file.name)}
          </span>
          <span>{formatFileSize(file.size)}</span>
        </div>
        
        <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors">
            Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileCard;
