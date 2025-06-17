import { supabase } from '../lib/supabase'
import type { Document } from '../types'

export class DocumentService {
  async uploadDocument(
    userId: string,
    file: File,
    folderPath: string = '/'
  ): Promise<Document> {
    // Upload file to Supabase Storage
    const fileName = `${userId}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Create document record
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        title: file.name,
        file_path: uploadData.path,
        file_type: file.type,
        file_size: file.size,
        folder_path: folderPath,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    // Trigger processing via Edge Function (will be implemented in Phase 2)
    try {
      await supabase.functions.invoke('document-process', {
        body: { document_id: data.id }
      })
    } catch (processingError) {
      console.warn('Document processing failed to start:', processingError)
    }

    return data
  }

  async getDocuments(userId: string, folderPath?: string): Promise<Document[]> {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (folderPath) {
      query = query.eq('folder_path', folderPath)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async getDocument(documentId: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (error) {
      console.error('Error fetching document:', error)
      return null
    }
    return data
  }

  async updateDocument(documentId: string, updates: Partial<Document>): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteDocument(documentId: string): Promise<void> {
    // Get document to get file path
    const document = await this.getDocument(documentId)
    
    // Delete from storage if file exists
    if (document?.file_path) {
      await supabase.storage
        .from('documents')
        .remove([document.file_path])
    }

    // Delete from database
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (error) throw error
  }

  async getFolders(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('folder_path')
      .eq('user_id', userId)

    if (error) throw error

    // Get unique folder paths
    const folders = [...new Set(data?.map(d => d.folder_path) || [])]
    return folders.filter(folder => folder !== '/')
  }

  async createFolder(userId: string, folderPath: string): Promise<void> {
    // Create a placeholder document to establish the folder
    const { error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        title: '.folder',
        folder_path: folderPath,
        status: 'ready',
        metadata: { type: 'folder_placeholder' }
      })

    if (error) throw error
  }

  async moveDocument(documentId: string, newFolderPath: string): Promise<Document> {
    return this.updateDocument(documentId, { folder_path: newFolderPath })
  }

  async getDocumentsByStatus(userId: string, status: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async searchDocuments(userId: string, query: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Get download URL for a document
  async getDownloadUrl(filePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) {
      console.error('Error creating download URL:', error)
      return null
    }

    return data.signedUrl
  }
}

export const documentService = new DocumentService() 