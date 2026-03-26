import { storage } from '@/lib/firebase';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  type StorageReference,
} from 'firebase/storage';

export interface UploadResult {
  path: string;
  downloadUrl: string;
}

export async function uploadFile(
  file: File,
  path: string
): Promise<UploadResult> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  return { path, downloadUrl };
}

export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

export async function listFiles(prefix: string): Promise<StorageReference[]> {
  const storageRef = ref(storage, prefix);
  const result = await listAll(storageRef);
  return result.items;
}

export async function getFileDownloadUrl(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return await getDownloadURL(storageRef);
}
