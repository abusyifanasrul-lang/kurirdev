import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { Shield, Upload, Trash2, FileText, ArrowLeft, Users, Settings, Database } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { User } from '@/types';
import type { StorageReference } from 'firebase/storage';

interface StorageFile {
  ref: StorageReference;
  name: string;
  fullPath: string;
}

export function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { users, updateUser } = useUserStore();

  const [activeTab, setActiveTab] = useState<'storage' | 'users' | 'system'>('storage');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPath, setUploadPath] = useState('backups/');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user is superadmin
  useEffect(() => {
    if (user?.role !== 'superadmin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Load storage files
  useEffect(() => {
    if (activeTab === 'storage') {
      loadStorageFiles();
    }
  }, [activeTab]);

  const loadStorageFiles = async () => {
    setLoading(true);
    try {
      const storageRef = ref(storage, '/');
      const result = await listAll(storageRef);
      const fileList: StorageFile[] = result.items.map(item => ({
        ref: item,
        name: item.name,
        fullPath: item.fullPath,
      }));
      setFiles(fileList);
    } catch (error) {
      console.error('Error loading files:', error);
      setMessage('Error loading storage files');
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const path = `${uploadPath}${selectedFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, selectedFile);
      const downloadUrl = await getDownloadURL(storageRef);
      setMessage(`File uploaded successfully! URL: ${downloadUrl}`);
      setSelectedFile(null);
      loadStorageFiles();
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('Error uploading file');
    }
    setUploading(false);
  };

  const handleDeleteFile = async (fileRef: StorageReference) => {
    if (!window.confirm(`Delete ${fileRef.name}?`)) return;

    try {
      await deleteObject(fileRef);
      setMessage(`Deleted ${fileRef.name}`);
      loadStorageFiles();
    } catch (error) {
      console.error('Delete error:', error);
      setMessage('Error deleting file');
    }
  };

  const handlePromoteToSuperAdmin = async (userId: string) => {
    if (!window.confirm('Promote this user to Super Admin?')) return;
    try {
      await updateUser(userId, { role: 'superadmin' });
      setMessage('User promoted to Super Admin');
    } catch (error) {
      setMessage('Error updating user');
    }
  };

  const handleDemoteToAdmin = async (userId: string) => {
    if (!window.confirm('Demote this user to Admin?')) return;
    try {
      await updateUser(userId, { role: 'admin' });
      setMessage('User demoted to Admin');
    } catch (error) {
      setMessage('Error updating user');
    }
  };

  if (user?.role !== 'superadmin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6" />
              <h1 className="text-lg font-semibold">Super Admin Panel</h1>
              <Badge variant="secondary" className="bg-indigo-700 text-indigo-100">
                Dev Only
              </Badge>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/admin')}
              className="text-white hover:bg-indigo-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Message */}
        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'storage'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database className="h-4 w-4" />
            Storage
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="h-4 w-4" />
            User Roles
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'system'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="h-4 w-4" />
            System
          </button>
        </div>

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Upload to Storage</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Storage Path
                  </label>
                  <input
                    type="text"
                    value={uploadPath}
                    onChange={(e) => setUploadPath(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="backups/ or files/"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select File
                  </label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                {selectedFile && (
                  <div className="text-sm text-gray-600">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </div>
                )}
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload File'}
                </Button>
              </div>
            </Card>

            {/* Files List */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Storage Files</h2>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No files in storage</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.fullPath}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.fullPath}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFile(file.ref)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">User Role Management</h2>
            <div className="space-y-2">
              {users.map((u: User) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={u.role === 'superadmin' ? 'default' : u.role === 'admin' ? 'secondary' : 'outline'}
                    >
                      {u.role}
                    </Badge>
                    {u.role !== 'superadmin' && u.role !== 'courier' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePromoteToSuperAdmin(u.id)}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        Promote
                      </Button>
                    )}
                    {u.role === 'superadmin' && u.id !== user.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDemoteToAdmin(u.id)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        Demote
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">System Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Storage Bucket</p>
                  <p className="font-medium">{import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'Not configured'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Project ID</p>
                  <p className="font-medium">{import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Not configured'}</p>
                </div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This panel is for development and maintenance only.
                  Changes made here can affect the entire system.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
