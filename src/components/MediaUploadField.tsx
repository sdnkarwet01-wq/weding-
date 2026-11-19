import React, { useRef, useState } from 'react';
import { Upload, Trash2, Music, Link as LinkIcon } from 'lucide-react';
import { uploadMediaFile, deleteMediaByUrl } from '../lib/storage';
import { ResilientImage } from './ResilientImage';
import { useToast } from '../contexts/ToastContext';

interface MediaUploadFieldProps {
  label: string;
  kind: 'image' | 'audio';
  value: string;
  invitationId: string;
  folder: string;
  onChange: (url: string) => void;
  helperText?: string;
}

export function MediaUploadField({
  label,
  kind,
  value,
  invitationId,
  folder,
  onChange,
  helperText,
}: MediaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const { showToast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploading(true);
    setProgress(8);

    try {
      const res = await uploadMediaFile(file, kind, invitationId, folder, (pct) => {
        setProgress(pct);
      });
      onChange(res.url);
      showToast(
        `${kind === 'image' ? 'Photo' : 'Audio'} uploaded successfully.`,
        'success'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    const prev = value;
    onChange('');
    await deleteMediaByUrl(prev);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-[#443C35]">{label}</label>
        <button
          type="button"
          onClick={() => setShowUrlInput((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-[#737C68] hover:text-[#443C35] transition-colors whitespace-nowrap shrink-0"
        >
          <LinkIcon className="w-3 h-3" />
          {showUrlInput ? 'Hide URL' : 'Paste URL'}
        </button>
      </div>

      {showUrlInput && (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={kind === 'image' ? 'https://.../photo.jpg' : 'https://.../music.mp3'}
          className="w-full px-3 py-2 text-xs bg-white border border-[#DCD3C6] rounded-lg focus:outline-none focus:border-[#737C68]"
        />
      )}

      <div className="flex items-center gap-3 p-3 bg-white border border-[#E5DDD0] rounded-xl">
        {kind === 'image' ? (
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-[#EDE6DA]">
            <ResilientImage
              src={value}
              alt={label}
              className="w-full h-full object-cover"
              fallbackLabel="No photo"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-[#F1EAE0] flex items-center justify-center shrink-0 text-[#737C68]">
            <Music className="w-5 h-5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={kind === 'image' ? 'image/jpeg,image/png,image/webp' : 'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4'}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#FAF7F2] border border-[#D8CFC2] text-[#443C35] rounded-lg hover:bg-[#F1EAE0] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? `Uploading ${progress}%` : value ? 'Replace File' : 'Upload File'}
            </button>

            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#8B3A3A] hover:bg-[#FDF2F2] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
          </div>

          {uploading && (
            <div className="mt-2 h-1.5 w-full bg-[#F1EAE0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#737C68] transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {errorMsg ? (
            <p className="mt-1 text-xs text-[#9B2C2C]">{errorMsg}</p>
          ) : (
            <p className="mt-1 text-xs text-[#443C35]/60 truncate">
              {helperText || (kind === 'image' ? 'JPG, PNG or WebP · Max 5 MB' : 'MP3, M4A, WAV or OGG · Max 10 MB')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
