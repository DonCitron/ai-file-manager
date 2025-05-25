import { Eye, Download, X } from 'lucide-react';
import type { MyFileData } from '../services/fileStore';

interface FilePreviewProps {
  file: MyFileData;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file }) => {
  return (
    <div>
      {file.name}
      <Eye className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" key={'eye-' + file.id} />
      <Download className="text-gray-400 hover:text-white transition-colors cursor-pointer" key={'download-' + file.id} />
      <X className="text-red-400 hover:text-red-300 transition-colors cursor-pointer" key={'delete-' + file.id} />
    </div>
  );
};
