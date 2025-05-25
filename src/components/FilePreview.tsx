import { Eye, Download, X } from 'lucide-react';
import React, { useState } from 'react';
import type { MyFileData } from '../services/fileStore';

interface FilePreviewProps {
  file: MyFileData;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file }) => {
  const [preview, setPreview] = useState<string | null>(null);

  const getPreview = async () => {
    if (file.type.startsWith('image/')) {
      setPreview(`/download/${file.name}`);
    } else if (file.type === 'application/pdf') {
      setPreview(`/download/${file.name}`);
    } else {
      setPreview(null);
    }
  };

  React.useEffect(() => {
    getPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return (
    <div>
      {file.name}
      <Eye className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" key={'eye-' + file.id} />
      <Download className="text-gray-400 hover:text-white transition-colors cursor-pointer" key={'download-' + file.id} />
      <X className="text-red-400 hover:text-red-300 transition-colors cursor-pointer" key={'delete-' + file.id} />
    </div>
  );
};
