import React from 'react';
import { FixedSizeList } from 'react-window';
import { useFileStore } from '../services/fileStore';
import { FilePreview } from './FilePreview';
import type { MyFileData } from '../services/fileStore';

export const VirtualFileList: React.FC = () => {
  const { files } = useFileStore();

  return (
    <FixedSizeList
      height={600}
      itemCount={files.length}
      itemSize={80}
      width={'100%'}
    >
      {({ index, style }) => (
        <div style={style}>
          <FilePreview file={files[index] as MyFileData} />
        </div>
      )}
    </FixedSizeList>
  );
};
