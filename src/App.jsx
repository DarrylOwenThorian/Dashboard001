import { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Loader2, 
  Bell, 
  FileImage, 
  Upload, 
  CheckCircle2,
  ExternalLink,
  Images,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function App() {
  const [imageStats, setImageStats] = useState(null);
  const [allImages, setAllImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState(null);

  const fileInputRef = useRef(null);

  // Helper to extract the backend API base URL from Vite environment variables
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

  const loadData = () => {
    setLoading(true);

    fetch(`${API_BASE}/api/images/stats`)
      .then((res) => res.json())
      .then((data) => setImageStats(data))
      .catch(() => {});

    fetch(`${API_BASE}/api/images/all`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAllImages(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setUploadMessage(null);

    fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      })
      .then((data) => {
        setUploadMessage(`Uploaded: ${data.image?.filename || 'Image'}`);
        loadData();
      })
      .catch((err) => setUploadMessage(`Error: ${err.message}`))
      .finally(() => {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  // Handle DELETE image request
  const handleDeleteImage = (imageId) => {
    if (!window.confirm(`Are you sure you want to delete image #${imageId}?`)) return;

    setDeletingId(imageId);

    fetch(`${API_BASE}/api/images/${imageId}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to delete image');
        return res.json();
      })
      .then(() => {
        setUploadMessage(`Image #${imageId} deleted.`);
        loadData();
      })
      .catch((err) => setUploadMessage(`Error: ${err.message}`))
      .finally(() => setDeletingId(null));
  };

  const latestImg = imageStats?.latestImage;

  // Fixed helper: guarantees all image URLs route through the Cloudflare Tunnel URL
  const getImageUrl = (img) => {
    if (!img) return '';

    // If the database stored a full http(s) URL:
    if (img.url && img.url.startsWith('http')) {
      // If it contains localhost or 127.0.0.1, replace the origin with API_BASE
      if (img.url.includes('localhost') || img.url.includes('127.0.0.1')) {
        const pathOnly = img.url.replace(/^https?:\/\/[^\/]+/, '');
        return `${API_BASE}${pathOnly}`;
      }
      return img.url;
    }
    
    // Fallback using filename
    const cleanPath = img.filename ? `/uploads/${img.filename}` : img.url || '';
    return `${API_BASE}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10 text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-white p-4 px-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Lemme do it for u</h1>
              <p className="text-xs text-slate-500">connected to postgre</p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="rounded-full">
            <Bell className="w-5 h-5 text-slate-600" />
          </Button>
        </header>

        {/* Upload Action Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Upload u image</h3>
              <p className="text-xs text-slate-500">
                PNG, JPEG, or WEBP.
              </p>
              {uploadMessage && (
                <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {uploadMessage}
                </p>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
            />

            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? "Uploading..." : "Choose Image"}
            </Button>
          </CardContent>
        </Card>

        {/* Hero Display Card: Latest Uploaded Image */}
        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-indigo-600" />
              Latest Uploaded Image
            </CardTitle>
            <div className="text-xs font-semibold px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
              Total Files: {imageStats?.totalImages ?? allImages.length}
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="animate-spin w-8 h-8 text-indigo-600" />
              </div>
            ) : latestImg ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                
                {/* Main Preview Container */}
                <div className="relative group bg-slate-900/5 rounded-xl p-3 border border-slate-200 flex items-center justify-center overflow-hidden min-h-[240px]">
                  <img
                    src={getImageUrl(latestImg)}
                    alt={latestImg.filename}
                    className="max-h-72 w-auto max-w-full object-contain rounded-lg shadow-sm"
                  />
                </div>

                {/* Metadata Column */}
                <div className="space-y-4">
                  <div>
                    <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md uppercase tracking-wider mb-2">
                      {latestImg.file_type || 'IMAGE'}
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 break-all">
                      {latestImg.filename}
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-slate-400 font-medium">PostgreSQL ID</p>
                      <p className="text-slate-800 font-semibold mt-0.5">#{latestImg.id}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Uploaded At</p>
                      <p className="text-slate-800 font-semibold mt-0.5">{latestImg.created_at}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <a
                      href={getImageUrl(latestImg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Open Full Resolution
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleDeleteImage(latestImg.id)}
                      disabled={deletingId === latestImg.id}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline ml-auto"
                    >
                      {deletingId === latestImg.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Delete Record
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <FileImage className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No image uploaded yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Long Gallery Card: Stored Images Grid */}
        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Images className="w-5 h-5 text-indigo-600" />
              Stored Images Library ({allImages.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="animate-spin w-8 h-8 text-indigo-600" />
              </div>
            ) : allImages.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allImages.map((img) => (
                  <div 
                    key={img.id} 
                    className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 hover:shadow-md transition-shadow duration-200 flex flex-col relative group"
                  >
                    {/* Thumbnail Container */}
                    <div className="h-40 bg-slate-900/5 flex items-center justify-center p-2 border-b border-slate-100 overflow-hidden relative">
                      <img
                        src={getImageUrl(img)}
                        alt={img.filename}
                        className="max-h-full max-w-full object-contain rounded-md"
                      />
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800 truncate" title={img.filename}>
                          {img.filename}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {img.created_at}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-500 font-medium">ID: #{img.id}</span>
                        
                        <div className="flex items-center gap-2">
                          <a
                            href={getImageUrl(img)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            onClick={() => handleDeleteImage(img.id)}
                            disabled={deletingId === img.id}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors"
                            title="Delete Image"
                          >
                            {deletingId === img.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                No images stored in database yet.
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}