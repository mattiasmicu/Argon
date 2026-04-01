import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Save, FileText } from 'lucide-react';

interface FileViewerProps {
  instanceId: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({ instanceId, filePath, fileName, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    loadFile();
  }, [instanceId, filePath]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await invoke<string>('read_file_content', {
        instanceId,
        relativePath: filePath,
      });
      setContent(text);
      setEdited(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // TODO: Implement save functionality
    setEdited(false);
  };

  const isTextFile = () => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const textExts = ['txt', 'json', 'properties', 'yaml', 'yml', 'xml', 'md', 'cfg', 'conf', 'log', 'toml'];
    return textExts.includes(ext || '');
  };

  const getLanguage = () => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json': return 'json';
      case 'yaml':
      case 'yml': return 'yaml';
      case 'xml': return 'xml';
      case 'md': return 'markdown';
      case 'toml': return 'toml';
      case 'properties': return 'properties';
      default: return 'text';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-inner2 border border-border rounded-lg p-6 min-w-[400px]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-text-p border-t-transparent rounded-full animate-spin" />
            <span className="text-text-s">Loading file...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-inner2 border border-border rounded-lg p-6 min-w-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-text-p font-bold flex items-center gap-2">
              <FileText size={18} /> Error
            </h3>
            <button onClick={onClose} className="text-text-d hover:text-text-s">
              <X size={20} />
            </button>
          </div>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!isTextFile()) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-inner2 border border-border rounded-lg p-6 min-w-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-text-p font-bold flex items-center gap-2">
              <FileText size={18} /> {fileName}
            </h3>
            <button onClick={onClose} className="text-text-d hover:text-text-s">
              <X size={20} />
            </button>
          </div>
          <p className="text-text-d text-sm">
            This file type cannot be previewed. Only text files can be viewed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-inner2 border border-border rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-text-p" />
            <div>
              <h3 className="text-text-p font-bold text-sm">{fileName}</h3>
              <p className="text-text-d text-xs">{filePath}</p>
            </div>
            {edited && (
              <span className="text-xs text-amber-400 ml-2">• Modified</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!edited}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-text-p text-inner rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              <Save size={14} /> Save
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-text-d hover:text-text-s hover:bg-inner3 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-4 overflow-auto">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setEdited(true);
            }}
            className="w-full h-full bg-inner3 border border-border rounded p-3 text-text-s text-sm font-mono resize-none focus:outline-none focus:border-text-p"
            spellCheck={false}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-text-d">
          <span>{getLanguage()}</span>
          <span>{content.length} characters</span>
        </div>
      </div>
    </div>
  );
};
